import { supabase } from "./supabase";

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface LegalDocument {
  id: string;
  document_key: string;
  title: string;
  content: string;
  version: number;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  full_name: string;
  title: string;
  bio: string;
  image_url: string | null;
  display_order: number;
  created_at: string;
}

// ─── Legal Documents ───────────────────────────────────────────────────────────
export async function getLegalDocument(key: string): Promise<LegalDocument | null> {
  const { data, error } = await supabase
    .from("legal_documents")
    .select("*")
    .eq("document_key", key)
    .maybeSingle();
  if (error) throw error;
  return data as LegalDocument | null;
}

export async function getAllLegalDocuments(): Promise<LegalDocument[]> {
  const { data, error } = await supabase
    .from("legal_documents")
    .select("*")
    .order("document_key");
  if (error) throw error;
  return (data || []) as LegalDocument[];
}

export async function upsertLegalDocument(
  key: string,
  updates: { title: string; content: string }
): Promise<void> {
  // Increment version on update
  const existing = await getLegalDocument(key);
  const newVersion = (existing?.version || 0) + 1;

  const { error } = await supabase.from("legal_documents").upsert(
    {
      document_key: key,
      title: updates.title,
      content: updates.content,
      version: newVersion,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "document_key" }
  );
  if (error) throw error;
}

// ─── Team Members ──────────────────────────────────────────────────────────────
export async function getTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .order("display_order");
  if (error) throw error;
  return (data || []) as TeamMember[];
}

export async function createTeamMember(
  member: Omit<TeamMember, "id" | "created_at">
): Promise<TeamMember> {
  const { data, error } = await supabase
    .from("team_members")
    .insert(member)
    .select()
    .single();
  if (error) throw error;
  return data as TeamMember;
}

export async function updateTeamMember(
  id: string,
  updates: Partial<Omit<TeamMember, "id" | "created_at">>
): Promise<void> {
  const { error } = await supabase
    .from("team_members")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteTeamMember(id: string): Promise<void> {
  const { error } = await supabase.from("team_members").delete().eq("id", id);
  if (error) throw error;
}

// ─── Image Upload ──────────────────────────────────────────────────────────────
export async function uploadTeamImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `member-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from("team").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from("team").getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteTeamImage(imageUrl: string): Promise<void> {
  // Extract path from URL
  const match = imageUrl.match(/\/team\/(.+)$/);
  if (!match) return;
  await supabase.storage.from("team").remove([match[1]]);
}

// ─── T&C Acceptance ────────────────────────────────────────────────────────────
export async function recordTCAcceptance(
  userId: string,
  version: number
): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({
      accepted_terms_version: version,
      accepted_terms_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;
}
