/**
 * imageService.ts
 *
 * Job photo upload, retrieval, and deletion for the Namshine job-photos bucket.
 *
 * Architecture
 * ────────────
 * Storage bucket:  job-photos  (private, 5 MB limit, jpeg/png/webp only)
 * Metadata table:  booking_images
 * Path convention: {booking_id}/{uploader_uid}-{unix_ms}-{sanitised_filename}
 *
 * Signed URLs are generated on-demand (7-day expiry = 604 800 s).
 * The 7-day window is intentionally generous — the gallery re-generates URLs
 * on every open so there is no staleness risk in practice.
 *
 * Security layers
 * ───────────────
 * 1. Storage INSERT policy  — only employees / admins can put objects
 * 2. Storage SELECT policy  — any authenticated user can create signed URLs
 * 3. booking_images INSERT   — only employee assigned to the booking
 * 4. booking_images SELECT   — assigned employee, admin, customer (completed only)
 * 5. booking_images DELETE   — uploader or admin
 */

import { supabase } from "./supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BookingImage {
  id:           string;
  booking_id:   string;
  uploaded_by:  string;
  storage_path: string;
  caption:      string | null;
  created_at:   string;
  /** Populated client-side after signed URL generation */
  signedUrl?:   string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const BUCKET             = "job-photos";
export const SIGNED_URL_TTL     = 604_800;   // 7 days in seconds
export const MAX_IMAGES_PER_JOB = 10;
export const MAX_FILE_SIZE_MB   = 5;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1_048_576;
export const ALLOWED_MIME_TYPES  = ["image/jpeg", "image/jpg", "image/png", "image/webp"] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Sanitise a filename: lowercase, replace spaces/special chars with hyphens */
function sanitiseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

/** Build a deterministic storage path for a given upload */
function buildStoragePath(bookingId: string, uploaderId: string, filename: string): string {
  const ts   = Date.now();
  const safe = sanitiseName(filename);
  return `${bookingId}/${uploaderId}-${ts}-${safe}`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid:   boolean;
  errors:  string[];
}

export function validateImageFile(file: File): ValidationResult {
  const errors: string[] = [];

  if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
    errors.push(`${file.name}: Only JPEG, PNG, and WebP images are allowed.`);
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    errors.push(`${file.name}: File exceeds ${MAX_FILE_SIZE_MB} MB limit (${(file.size / 1_048_576).toFixed(1)} MB).`);
  }
  return { valid: errors.length === 0, errors };
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export interface UploadResult {
  image:  BookingImage;
  signedUrl: string;
}

/**
 * Upload a single image file and register it in booking_images.
 *
 * Steps:
 * 1. Validate file type + size
 * 2. Check max-images-per-booking limit (max 10)
 * 3. Upload to storage
 * 4. Generate a 7-day signed URL
 * 5. Insert record into booking_images
 *
 * Throws with a human-readable message on any failure.
 */
export async function uploadJobPhoto(
  bookingId:  string,
  uploaderId: string,
  file:       File,
  caption?:   string,
): Promise<UploadResult> {
  // 1. Validate
  const val = validateImageFile(file);
  if (!val.valid) throw new Error(val.errors[0]);

  // 2. Check existing count
  const { count, error: countErr } = await supabase
    .from("booking_images")
    .select("id", { count: "exact", head: true })
    .eq("booking_id", bookingId);
  if (countErr) throw new Error("Failed to check image count: " + countErr.message);
  if ((count ?? 0) >= MAX_IMAGES_PER_JOB) {
    throw new Error(`Maximum ${MAX_IMAGES_PER_JOB} photos per booking. Delete some to upload more.`);
  }

  // 3. Upload to storage
  const path = buildStoragePath(bookingId, uploaderId, file.name);
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadErr) throw new Error("Upload failed: " + uploadErr.message);

  // 4. Generate signed URL
  const { data: urlData, error: urlErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (urlErr || !urlData?.signedUrl) {
    // Non-fatal: clean up the orphan object
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    throw new Error("Failed to generate signed URL: " + (urlErr?.message || "unknown error"));
  }

  // 5. Insert metadata
  const { data: record, error: insertErr } = await supabase
    .from("booking_images")
    .insert({ booking_id: bookingId, uploaded_by: uploaderId, storage_path: path, caption: caption || null })
    .select()
    .single();
  if (insertErr) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    throw new Error("Failed to save image record: " + insertErr.message);
  }

  return {
    image:     { ...(record as BookingImage), signedUrl: urlData.signedUrl },
    signedUrl: urlData.signedUrl,
  };
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

/**
 * Fetch all images for a booking with fresh signed URLs.
 * Returns an empty array (not an error) if there are no photos.
 */
export async function getBookingImages(bookingId: string): Promise<BookingImage[]> {
  const { data, error } = await supabase
    .from("booking_images")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });
  if (error) throw new Error("Failed to load images: " + error.message);

  const rows = (data || []) as BookingImage[];
  if (rows.length === 0) return [];

  // Generate signed URLs for all rows in parallel
  const withUrls = await Promise.all(
    rows.map(async (row) => {
      const { data: urlData } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(row.storage_path, SIGNED_URL_TTL);
      return { ...row, signedUrl: urlData?.signedUrl ?? undefined };
    }),
  );

  return withUrls;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Delete a job photo: removes both the storage object and the metadata record.
 * Employees can only delete their own uploads (enforced by RLS).
 */
export async function deleteJobPhoto(imageId: string): Promise<void> {
  // 1. Fetch the record to get the storage path
  const { data: record, error: fetchErr } = await supabase
    .from("booking_images")
    .select("storage_path")
    .eq("id", imageId)
    .single();
  if (fetchErr) throw new Error("Failed to find image: " + fetchErr.message);

  // 2. Delete from storage (best-effort; proceed even if storage delete fails)
  await supabase.storage.from(BUCKET).remove([(record as any).storage_path]).catch(() => {});

  // 3. Delete metadata record (RLS enforces ownership)
  const { error: deleteErr } = await supabase
    .from("booking_images")
    .delete()
    .eq("id", imageId);
  if (deleteErr) throw new Error("Failed to delete image record: " + deleteErr.message);
}

// ─── Count helper ─────────────────────────────────────────────────────────────

/** Returns the count of images for a booking without fetching their content. */
export async function getBookingImageCount(bookingId: string): Promise<number> {
  const { count, error } = await supabase
    .from("booking_images")
    .select("id", { count: "exact", head: true })
    .eq("booking_id", bookingId);
  if (error) return 0;
  return count ?? 0;
}

// ─── Proof of payment upload ──────────────────────────────────────────────────

export const PROOF_BUCKET = 'job-photos';  // reuse same bucket with a different path prefix

/**
 * Upload a proof-of-payment file to storage.
 * Returns a public-accessible signed URL stored on the booking record.
 * Stored at: proof/{booking_id}/{uid}-{ts}-{filename}
 */
export async function uploadProofOfPayment(
  bookingId: string,
  file: File,
): Promise<string> {
  const val = validateImageFile(file);
  // Also allow PDFs for proof
  const isPDF = file.type === 'application/pdf';
  if (!val.valid && !isPDF) throw new Error(val.errors[0]);

  const ts   = Date.now();
  const safe = file.name.toLowerCase().replace(/[^a-z0-9.\-_]/g, '-').replace(/-+/g, '-').slice(0, 60);
  const path = `proof/${bookingId}/${ts}-${safe}`;

  const { error: uploadErr } = await supabase.storage
    .from(PROOF_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadErr) throw new Error('Proof upload failed: ' + uploadErr.message);

  const { data: urlData, error: urlErr } = await supabase.storage
    .from(PROOF_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 30); // 30-day URL
  if (urlErr || !urlData?.signedUrl) throw new Error('Failed to get proof URL');

  return urlData.signedUrl;
}
