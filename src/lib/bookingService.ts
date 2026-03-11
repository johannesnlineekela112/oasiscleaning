import { supabase } from "./supabase";

// ─── Types ───────────────────────────────────────────────────────────────────
export interface ServiceRow {
  id: number;
  name: string;
  description: string | null;
  price_small: number;
  price_large: number;
  price_xl: number;
  price_truck: number;
  is_addon: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface VehicleEntry {
  plateNumber: string;
  vehicleCategory: "small" | "large" | "xl" | "truck";
  services: string[];        // service names
  subtotal: number;
}

export interface Booking {
  id?: string;
  customer_id?: string;
  assigned_employee_id?: string | null;
  service_type: string;
  vehicle_type: string;
  plate_number?: string;
  price: number;
  address_text: string;
  latitude?: number | null;
  longitude?: number | null;
  booking_date: string;
  time_slot: string;
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "late_cancelled";
  commission_amount?: number | null;
  is_vip?: boolean;
  payment_type?: string;
  created_at?: string;
  // Cancellation tracking (added in booking_cancel_fields migration)
  cancelled_at?: string | null;  // UTC ISO string, null = not cancelled
  late_cancel?:  boolean;        // true when cancelled within 30 min of service
  // Free wash tracking
  is_free_wash?:   boolean;      // true when price was zeroed via redemption
  redemption_id?:  string | null;
  original_price?: number;       // service price before free wash zeroed it
  // Extended location fields
  area_name?: string | null;   // suburb / neighbourhood (from geocoder context)
  landmark?:  string | null;   // driver hint, e.g. "Blue gate next to Checkers"
  // Payment fields (v14+)
  payment_method?:   'cash' | 'eft' | 'mobile' | 'subscription' | 'free_wash';
  payment_subtype?:  'ewallet' | 'pay2cell' | null;
  payment_status?:   'unpaid' | 'pending_verification' | 'paid' | 'cash_on_completion' | 'subscription_covered';
  proof_of_payment_url?: string | null;
  // Subscription fields
  covered_by_subscription?: boolean;
  subscription_id?: string | null;
  // Review fields
  review_eligible?:  boolean;
  review_submitted?: boolean;
  completed_at?:     string | null;
  // Normalized UI fields
  fullName?: string;
  whatsapp?: string;
  address?: string;
  date?: string;
  time?: string;
  totalPrice?: number;
  paymentType?: string;
  isVip?: boolean;
  paid?: boolean;
  assignedEmployee?: string;
  vehicles?: VehicleEntry[];
}

export interface StaffMember {
  id: string;
  full_name: string;
  email: string;
  employee_number: string;
  commission_percentage?: number;
  active?: boolean;
  cellphone?: string;
  role?: string;
}

export interface CommissionPayment {
  id?: string;
  employee_id: string;
  amount: number;
  paid_at?: string;
}

// ─── Static fallback pricing (used until DB loads) ───────────────────────────
export const DEFAULT_PRICING: Record<string, Record<string, number>> = {
  small: { "Full Detailing": 120, "Basic Wash (Exterior)": 80, "Basic Wash (Interior)": 60, "Engine Bay Cleaning": 50 },
  large: { "Full Detailing": 150, "Basic Wash (Exterior)": 100, "Basic Wash (Interior)": 80, "Engine Bay Cleaning": 50 },
  xl:    { "Full Detailing": 200, "Basic Wash (Exterior)": 130, "Basic Wash (Interior)": 100, "Engine Bay Cleaning": 50 },
  truck: { "Full Detailing": 350, "Basic Wash (Exterior)": 250, "Basic Wash (Interior)": 150, "Engine Bay Cleaning": 100 },
};

// Build PRICING matrix from DB services
export function buildPricingMatrix(services: ServiceRow[]): Record<string, Record<string, number>> {
  const matrix: Record<string, Record<string, number>> = {
    small: {}, large: {}, xl: {}, truck: {},
  };
  for (const svc of services) {
    matrix.small[svc.name] = svc.price_small;
    matrix.large[svc.name] = svc.price_large;
    matrix.xl[svc.name]    = svc.price_xl;
    matrix.truck[svc.name] = svc.price_truck;
  }
  return matrix;
}

// ─── Static constants (non-pricing) ──────────────────────────────────────────
export const VEHICLE_CATEGORIES = [
  { value: "small", label: "Small (Polo, Sedan)" },
  { value: "large", label: "Large (SUV, Bakkie)" },
  { value: "xl",    label: "XL (Quantum, Van)" },
  { value: "truck", label: "Truck (Horse/Trailer)" },
] as const;

// Keep for legacy compatibility where needed
export const PRICING = DEFAULT_PRICING;
export const SERVICES = ["Basic Wash (Interior)", "Basic Wash (Exterior)", "Full Detailing", "Engine Bay Cleaning"];
export const PRIMARY_SERVICES = ["Basic Wash (Interior)", "Basic Wash (Exterior)", "Full Detailing"];

// ─── Time Slots ───────────────────────────────────────────────────────────────
export const TIME_SLOTS = [
  { value: "08:00-09:30",     label: "08:00 – 09:30" },
  { value: "09:30-11:00",     label: "09:30 – 11:00" },
  { value: "11:00-12:30",     label: "11:00 – 12:30" },
  { value: "13:00-14:30",     label: "13:00 – 14:30" },
  { value: "14:30-16:00",     label: "14:30 – 16:00" },
  { value: "VIP 17:00-18:30", label: "⭐ VIP 17:00 – 18:30" },
  { value: "VIP 18:30-19:30", label: "⭐ VIP 18:30 – 19:30" },
];

export const VIP_MULTIPLIER = 1.5;

export function isVipTime(time: string): boolean {
  return !!time && time.startsWith("VIP");
}

// ─── Dynamic services fetch ──────────────────────────────────────────────────
export async function fetchActiveServices(): Promise<ServiceRow[]> {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return (data || []) as ServiceRow[];
}

export async function getAllServices(): Promise<ServiceRow[]> {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return (data || []) as ServiceRow[];
}

export async function createService(svc: Omit<ServiceRow, "id">): Promise<ServiceRow> {
  const { data, error } = await supabase.from("services").insert(svc).select().single();
  if (error) throw error;
  return data as ServiceRow;
}

export async function updateService(id: number, updates: Partial<ServiceRow>): Promise<void> {
  const { error } = await supabase.from("services").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteService(id: number): Promise<void> {
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) throw error;
}

// ─── Service Logic ────────────────────────────────────────────────────────────
export function isServiceAllowed(
  currentServices: string[],
  newService: string,
  allServices: ServiceRow[]
): boolean {
  const svcRow = allServices.find(s => s.name === newService);
  if (svcRow?.is_addon) return true;   // addons always allowed

  const primaryNames = allServices.filter(s => !s.is_addon).map(s => s.name);
  const hasPrimary = currentServices.some(s => primaryNames.includes(s));
  if (hasPrimary) return false;         // already has a primary service

  return true;
}

export function calculateVehicleTotal(
  category: string,
  services: string[],
  pricing: Record<string, Record<string, number>>
): number {
  return services.reduce((sum, svc) => sum + (pricing[category]?.[svc] || 0), 0);
}

export function calculateTotal(vehicles: VehicleEntry[], isVip: boolean): number {
  const base = vehicles.reduce((sum, v) => sum + v.subtotal, 0);
  return isVip ? Math.round(base * VIP_MULTIPLIER) : base;
}

// ─── WhatsApp Validation ──────────────────────────────────────────────────────
export function isValidWhatsApp(number: string): boolean {
  const stripped = number.replace(/[\s\-().+]/g, "");
  // +264 / 264 + 9 digits  →  264812345678
  if (/^264\d{9}$/.test(stripped)) return true;
  // 0 + 9 digits  →  0812345678
  if (/^0\d{9}$/.test(stripped)) return true;
  // raw 9 digits  →  812345678
  if (/^\d{9}$/.test(stripped)) return true;
  return false;
}

// ─── Namibia Timezone & Past-Slot Helpers ─────────────────────────────────────
//
// Namibia Standard Time is permanently UTC+2 (CAT — Central Africa Time).
// There is NO daylight-saving adjustment, so this offset is constant year-round.
//
// Strategy: rather than relying on the user's device timezone (which may be
// wrong or spoofed), we shift all UTC timestamps by +2 hours ourselves.  We
// use `.toISOString()` on the shifted date so that "UTC" arithmetic on the
// shifted value is equivalent to "Namibia local" arithmetic.
//
// This avoids any dependency on `Intl.DateTimeFormat` (which can behave
// inconsistently across old Android WebViews found on budget Namibian devices).

/** Namibia is permanently CAT = UTC+2 — no DST. */
export const NAMIBIA_UTC_OFFSET_MS = 2 * 60 * 60 * 1000; // 7_200_000 ms

/**
 * How many minutes before a slot's start time the slot becomes unavailable.
 * Default 60 — gives our team enough notice for same-day bookings.
 * Pass 0 for the hard backend floor (no buffer, just reject genuine past slots).
 */
export const LEAD_TIME_MINUTES = 60;

/**
 * Return the current wall-clock date in Namibia as "YYYY-MM-DD".
 * Uses UTC arithmetic shifted by +2 h so it works regardless of device locale.
 */
export function todayInNamibia(): string {
  // Add 2 h to UTC → Namibia local time expressed as a UTC ISO string
  return new Date(Date.now() + NAMIBIA_UTC_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Parse the slot start time (HH:MM) from a TIME_SLOTS value string.
 *   "08:00-09:30"     → { h: 8,  m: 0 }
 *   "VIP 17:00-18:30" → { h: 17, m: 0 }
 * Returns null if the format is unrecognised.
 */
export function parseSlotStart(slotValue: string): { h: number; m: number } | null {
  // Strip optional "VIP " prefix then match the leading HH:MM
  const match = slotValue.replace(/^VIP\s+/, "").match(/^(\d{2}):(\d{2})/);
  if (!match) return null;
  return { h: parseInt(match[1], 10), m: parseInt(match[2], 10) };
}

/**
 * Returns true when a time slot should be treated as unavailable because it
 * is in the past (or within the lead-time buffer) in Namibia local time.
 *
 * Logic:
 *   - bookingDate is a future date  → always false (slot not yet in the past)
 *   - bookingDate is a past date    → always true  (entire day is gone)
 *   - bookingDate is today (NAM)    → compare slot start − leadMinutes vs now
 *
 * @param bookingDate  "YYYY-MM-DD" — the date the customer wants to book
 * @param slotValue    e.g. "09:30-11:00" or "VIP 17:00-18:30"
 * @param leadMinutes  buffer subtracted from slot start (default: LEAD_TIME_MINUTES)
 */
export function isSlotInPast(
  bookingDate: string,
  slotValue:   string,
  leadMinutes: number = LEAD_TIME_MINUTES,
): boolean {
  const namibiaToday = todayInNamibia();

  if (bookingDate > namibiaToday) return false; // future date — nothing is past
  if (bookingDate < namibiaToday) return true;  // past date  — everything is past

  // bookingDate === today in Namibia — compare against the clock
  const slotStart = parseSlotStart(slotValue);
  if (!slotStart) return false; // unrecognised format — let it through

  // Current time-of-day in Namibia, expressed as total minutes since midnight
  const namibiaNow     = new Date(Date.now() + NAMIBIA_UTC_OFFSET_MS);
  const nowMinutes     = namibiaNow.getUTCHours() * 60 + namibiaNow.getUTCMinutes();

  // Slot becomes unavailable leadMinutes before its start
  const slotMinutes    = slotStart.h * 60 + slotStart.m;
  const cutoffMinutes  = slotMinutes - leadMinutes;

  return nowMinutes >= cutoffMinutes;
}


export async function getBookedSlots(date: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("time_slot")
    .eq("booking_date", date)
    .in("status", ["pending", "confirmed", "in_progress"]);
  if (error) throw error;
  // Deduplicate — multiple vehicles in one appointment share the same slot
  return [...new Set((data || []).map((d: any) => d.time_slot))];
}

// ─── Submit Booking ───────────────────────────────────────────────────────────
export async function submitBooking(booking: {
  customer_id?: string;
  fullName: string;
  whatsapp: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  areaName?: string | null;
  landmark?: string | null;
  date: string;
  time: string;
  vehicles: VehicleEntry[];
  paymentType: string;
  paymentMethod?: 'cash' | 'eft' | 'mobile';
  paymentSubtype?: 'ewallet' | 'pay2cell' | null;
  proofOfPaymentUrl?: string | null;
  totalPrice: number;
  isVip: boolean;
  honeypot?: string;
  fingerprint?: string;
}): Promise<string> {
  // ── Import fingerprint lazily to avoid circular dep ──────────────────────
  const { FP } = await import('./botProtection');

  // ── Call the submit-booking edge function ─────────────────────────────────
  // All validation (field checks, slot availability, rate limiting, honeypot)
  // happens server-side. The client no longer writes to `bookings` directly.
  const supabaseUrl = 'https://gzbkpwdnkhsbeygnynbh.supabase.co';

  // Include the auth header if the user is logged in (optional — anon allowed)
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6Ymtwd2Rua2hzYmV5Z255bmJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NTU1ODcsImV4cCI6MjA4NjIzMTU4N30.reLOBC1F2zbMgAD7Z6I6z_D9s37OhDC4b4Gfr-Ltig8',
  };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/submit-booking`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      honeypot:          booking.honeypot ?? '',
      fingerprint:       booking.fingerprint ?? FP,
      fullName:          booking.fullName,
      whatsapp:          booking.whatsapp,
      address:           booking.address,
      latitude:          booking.latitude   ?? null,
      longitude:         booking.longitude  ?? null,
      areaName:          booking.areaName   ?? null,
      landmark:          booking.landmark   ?? null,
      date:              booking.date,
      time:              booking.time,
      vehicles:          booking.vehicles,
      paymentType:       booking.paymentType,
      paymentMethod:     booking.paymentMethod ?? 'cash',
      paymentSubtype:    booking.paymentSubtype ?? null,
      proofOfPaymentUrl: booking.proofOfPaymentUrl ?? null,
      totalPrice:        booking.totalPrice,
      isVip:             booking.isVip,
    }),
  });

  const payload = await res.json().catch(() => ({ error: 'Invalid server response' }));

  if (!res.ok) {
    const msg  = payload?.error ?? `Server error ${res.status}`;
    const code = payload?.code  ?? '';

    // Map every known edge-function error code to a clear user-facing message.
    if (code === 'PAST_SLOT'   || msg.includes('past'))
      throw new Error('That time slot is in the past. Please select a future time.');
    if (code === 'SLOT_TAKEN'  || msg.includes('already booked'))
      throw new Error('This time slot is already booked. Please select another time.');
    if (code === 'MISSING_FIELD')
      throw new Error(`Required booking details are missing: ${msg}`);
    if (code === 'MISSING_VEHICLES')
      throw new Error('Please add at least one vehicle to your booking.');
    if (code === 'MISSING_SERVICE')
      throw new Error('Each vehicle must have at least one service selected.');
    if (code === 'INVALID_PAYMENT_METHOD')
      throw new Error('Invalid payment method. Please re-select your payment option and try again.');
    if (code === 'NO_SUBSCRIPTION_SLOTS')
      throw new Error('Your subscription has no remaining slots for this period.');
    if (code === 'EMAIL_NOT_VERIFIED')
      throw new Error('Please verify your email address before booking. Check your inbox for the confirmation link.');
    if (code === 'PROOF_UPLOAD_FAILED')
      throw new Error('Payment proof upload failed. Please try uploading again or choose a different file.');
    if (code === 'RATE_LIMITED' || code === 'RATE_LIMITED_DB')
      throw new Error('Too many booking attempts. Please wait a minute and try again.');
    if (code === 'BLOCKED')
      throw new Error(msg || 'Your booking was blocked. Please contact us on WhatsApp for assistance.');
    if (code === 'PAST_DATE')
      throw new Error('The selected booking date is in the past. Please choose today or a future date.');
    if (code === 'INVALID_DATE')
      throw new Error('Invalid date format. Please go back and re-select your booking date.');
    if (code === 'TOO_MANY_VEHICLES')
      throw new Error('A maximum of 10 vehicles can be booked at once. Please reduce your selection.');

    throw new Error(msg);
  }

  return payload.booking_id ?? '';
}

// ─── Read Bookings ────────────────────────────────────────────────────────────
export interface BookingsPage {
  bookings: Booking[];
  total:    number;
  hasMore:  boolean;
}

/**
 * Admin: fetch bookings with mandatory pagination.
 *
 * Default limit = 100, max = 500.
 * At 10x traffic this prevents unbounded result sets from
 * saturating the Supabase connection pool.
 */
export async function getBookings(opts?: {
  page?:   number;
  limit?:  number;
  status?: Booking["status"] | "all";
}): Promise<Booking[]> {
  // Legacy callers get page 0, 200 rows — no breaking change.
  const page  = opts?.page  ?? 0;
  const limit = Math.min(opts?.limit ?? 200, 500);
  const from  = page * limit;
  const to    = from + limit - 1;

  let q = supabase
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (opts?.status && opts.status !== "all") {
    q = q.eq("status", opts.status);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(normalizeBooking);
}

/**
 * Admin: paginated booking fetch with total count.
 * Use this in the dashboard list view for proper pagination UI.
 */
export async function getBookingsPage(opts?: {
  page?:   number;
  limit?:  number;
  status?: Booking["status"] | "all";
}): Promise<BookingsPage> {
  const page  = opts?.page  ?? 0;
  const limit = Math.min(opts?.limit ?? 100, 500);
  const from  = page * limit;
  const to    = from + limit - 1;

  let q = supabase
    .from("bookings")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (opts?.status && opts.status !== "all") {
    q = q.eq("status", opts.status);
  }

  const { data, error, count } = await q;
  if (error) throw error;
  const total = count ?? 0;
  return {
    bookings: (data || []).map(normalizeBooking),
    total,
    hasMore:  to < total - 1,
  };
}

export async function getUserBookings(userId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("customer_id", userId)
    .order("created_at", { ascending: false })
    .limit(200); // user's own bookings are bounded by their activity
  if (error) throw error;
  return (data || []).map(normalizeBooking);
}

export async function getEmployeeBookings(employeeId: string): Promise<Booking[]> {
  // Active-first: non-terminal statuses via the covering index idx_bookings_employee_active
  const { data: active, error: e1 } = await supabase
    .from("bookings")
    .select("*")
    .eq("assigned_employee_id", employeeId)
    .not("status", "in", '("completed","cancelled","late_cancelled")')
    .order("booking_date", { ascending: true });

  const { data: recent, error: e2 } = await supabase
    .from("bookings")
    .select("*")
    .eq("assigned_employee_id", employeeId)
    .in("status", ["completed", "cancelled", "late_cancelled"])
    .order("created_at", { ascending: false })
    .limit(50); // last 50 completed/cancelled for history

  if (e1) throw e1;
  if (e2) throw e2;

  const all = [...(active || []), ...(recent || [])];
  return all.map(normalizeBooking);
}

export function normalizeBooking(row: any): Booking {
  // Split on ' | ' with max 3 parts so addresses containing ' | ' are preserved
  const raw    = (row.address_text || "") as string;
  const idx1   = raw.indexOf(" | ");
  const idx2   = idx1 >= 0 ? raw.indexOf(" | ", idx1 + 3) : -1;
  const fullName = idx1 >= 0 ? raw.slice(0, idx1) : raw;
  const whatsapp = idx1 >= 0 && idx2 >= 0 ? raw.slice(idx1 + 3, idx2) : (idx1 >= 0 ? raw.slice(idx1 + 3) : "");
  const address  = idx2 >= 0 ? raw.slice(idx2 + 3) : "";
  const isVip    = !!(row.is_vip || (row.time_slot || "").startsWith("VIP"));
  const paid     = row.status === "in_progress" || row.status === "completed";

  return {
    ...row,
    fullName,
    whatsapp,
    address,
    date:         row.booking_date,
    time:         row.time_slot,
    totalPrice:   row.price,
    paymentType:  row.payment_type || "Cash",
    isVip,
    paid,
    assignedEmployee: row.assigned_employee_id,
    // Free wash fields — always expose so commission logic can read them
    is_free_wash:   !!(row.is_free_wash),
    original_price: Number(row.original_price) || Number(row.price) || 0,
    vehicles: [{
      plateNumber:     row.plate_number || "",
      vehicleCategory: row.vehicle_type || "small",
      services:        (row.service_type || "").split(", ").filter(Boolean),
      subtotal:        row.price,
    }],
  };
}

// ─── Update Bookings ──────────────────────────────────────────────────────────
export async function updateBookingStatus(id: string, status: Booking["status"]): Promise<void> {
  const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function updateBookingPaid(id: string, paid: boolean): Promise<void> {
  const newStatus = paid ? "in_progress" : "confirmed";
  const { error } = await supabase.from("bookings").update({ status: newStatus }).eq("id", id);
  if (error) throw error;
}

export async function assignBookingToEmployee(id: string, employeeId: string): Promise<void> {
  // Uses a DB function that preserves in_progress/completed status when reassigning
  const { error } = await supabase.rpc("assign_booking", {
    p_booking_id:  id,
    p_employee_id: employeeId || null,
  });
  if (error) throw error;
}

export async function deleteBooking(id: string): Promise<void> {
  const { error } = await supabase.from("bookings").delete().eq("id", id);
  if (error) throw error;
}

// ─── Staff / Employees ────────────────────────────────────────────────────────
export async function addStaffMember(staff: {
  name: string;
  surname: string;
  idNumber: string;
  phone?: string;
  cellphone: string;
  email: string;
  password: string;
  role: "admin" | "employee";
}): Promise<string> {
  const code     = "EMP" + String(Math.floor(1000 + Math.random() * 9000));
  const fullName = `${staff.name} ${staff.surname}`;

  // Use the edge function to create the user server-side (avoids hijacking admin session)
  const { data: fnData, error: fnError } = await supabase.functions.invoke("create-staff-user", {
    body: {
      email:     staff.email,
      password:  staff.password,
      full_name: fullName,
      role:      staff.role,
      cellphone: staff.cellphone,
      employee_number: code,
    },
  });

  if (fnError || !fnData?.user_id) {
    throw new Error(fnError?.message || fnData?.error || "Failed to create staff account. Check the edge function.");
  }

  const uid = fnData.user_id;

  if (staff.role === "employee") {
    const { error: empError } = await supabase.from("employees").insert({
      id:                    uid,
      employee_number:       code,
      commission_percentage: 20,
      active:                true,
      cellphone:             staff.cellphone,
    });
    if (empError) throw empError;
  }

  return code;
}

export async function getStaff(): Promise<StaffMember[]> {
  // Only fetch admin and employee users — customers are excluded from the staff list
  const { data: userData, error } = await supabase
    .from("users")
    .select("id, full_name, email, employee_number, role, cellphone")
    .in("role", ["admin", "employee"])
    .order("full_name");
  if (error) throw error;

  const { data: empData } = await supabase
    .from("employees")
    .select("id, commission_percentage, active, cellphone");

  const empMap = new Map((empData || []).map((e: any) => [e.id, e]));

  return (userData || []).map((u: any) => ({
    id:                    u.id,
    full_name:             u.full_name,
    email:                 u.email,
    employee_number:       u.employee_number || "",
    role:                  u.role || "customer",
    cellphone:             u.cellphone || (empMap.get(u.id) as any)?.cellphone || "",
    commission_percentage: (empMap.get(u.id) as any)?.commission_percentage ?? 20,
    active:                (empMap.get(u.id) as any)?.active ?? true,
  }));
}
// updateStaffRole intentionally removed — roles are set at registration only.

export async function deleteStaffMember(id: string): Promise<void> {
  if (!id) throw new Error('Staff member ID is required');
  // Delete employees record first (FK constraint safe — no bookings FK from employees to users)
  await supabase.from('employees').delete().eq('id', id);
  // Soft-delete the user profile by deactivating
  const { error } = await supabase.from('users').update({ role: 'deactivated' }).eq('id', id);
  if (error) throw error;
  // Auth user deletion must be done server-side via admin API — the edge function handles this
  const { error: fnError } = await supabase.functions.invoke('create-staff-user', {
    body: { action: 'delete', user_id: id },
  });
  // Non-fatal if auth deletion fails — profile is already deactivated
  if (fnError) console.warn('[deleteStaffMember] auth deletion warning:', fnError.message);
}

// ─── Commission ───────────────────────────────────────────────────────────────
export async function getCommissionPercent(): Promise<number> {
  const { data } = await supabase
    .from("employees")
    .select("commission_percentage")
    .limit(1)
    .maybeSingle();
  return (data as any)?.commission_percentage ?? 20;
}

export async function saveCommissionPercent(employeeId: string, percent: number): Promise<void> {
  if (!employeeId) throw new Error('employeeId is required to update commission percentage');
  const pct = Math.min(100, Math.max(0, percent));
  const { error } = await supabase
    .from('employees')
    .update({ commission_percentage: pct })
    .eq('id', employeeId);
  if (error) throw error;
}

/** Bulk update — only call from admin batch operations where all employees must change */
export async function saveCommissionPercentForAll(percent: number): Promise<void> {
  const pct = Math.min(100, Math.max(0, percent));
  const { error } = await supabase.from('employees').update({ commission_percentage: pct });
  if (error) throw error;
}

export async function getPricingSettings(): Promise<ServiceRow[] | null> {
  return getAllServices();
}

export async function savePricingSettings(services: ServiceRow[]): Promise<void> {
  for (const svc of services) {
    await updateService(svc.id, {
      price_small: svc.price_small,
      price_large: svc.price_large,
      price_xl:    svc.price_xl,
      price_truck: svc.price_truck,
    });
  }
}

export async function addCommissionPayment(employeeId: string, _amount: number): Promise<void> {
  const { data } = await supabase
    .from("bookings")
    .select("id, price, original_price")
    .eq("assigned_employee_id", employeeId)
    .eq("status", "completed")
    .is("commission_amount", null);

  if (data && data.length > 0) {
    for (const b of data as any[]) {
      // Use original_price for free wash bookings (price = 0) so commission
      // reflects the actual service value, not N$0.
      const commissionBase = (b.original_price && b.original_price > 0)
        ? b.original_price
        : b.price;
      await supabase
        .from("bookings")
        .update({ commission_amount: Math.round(commissionBase * 0.2) })
        .eq("id", b.id);
    }
  }
}

export async function resetEmployeeCommission(employeeId: string): Promise<void> {
  await supabase
    .from("bookings")
    .update({ commission_amount: 0 })
    .eq("assigned_employee_id", employeeId)
    .eq("status", "completed");
}

export async function getCommissionPayments(): Promise<CommissionPayment[]> {
  const { data } = await supabase
    .from("bookings")
    .select("assigned_employee_id, commission_amount")
    .eq("status", "completed")
    .not("commission_amount", "is", null)
    .gt("commission_amount", 0);

  return (data || []).map((d: any) => ({
    employee_id: d.assigned_employee_id,
    amount:      d.commission_amount,
  }));
}
// ─── Edit / Cancel cutoff constants ──────────────────────────────────────────
// Must stay in sync with the edge function constants.
export const CUTOFF_SCHEDULE_MINUTES  = 15; // time/service locked within 15 min
export const CUTOFF_LOCATION_MINUTES  = 30; // location locked within 30 min
export const CUTOFF_LATE_CANCEL_MINUTES = 30; // late cancel threshold

/**
 * Combine booking_date ("YYYY-MM-DD") and time_slot (e.g. "09:30-11:00") into
 * an absolute Date object whose .getTime() represents the correct UTC epoch.
 *
 * TIMEZONE STRATEGY (mirrors the edge function):
 * Namibia = CAT = UTC+2, no DST.
 * We form an ISO string with "+02:00" offset so the JS runtime correctly
 * converts Namibia local time to UTC regardless of device timezone.
 */
export function bookingToUTC(bookingDate: string, timeSlot: string): Date | null {
  const start = parseSlotStart(timeSlot);
  if (!start) return null;
  const hh = String(start.h).padStart(2, "0");
  const mm = String(start.m).padStart(2, "0");
  // "+02:00" suffix forces correct UTC conversion regardless of device locale
  return new Date(`${bookingDate}T${hh}:${mm}:00+02:00`);
}

/**
 * Compute minutes remaining until a booking's service starts.
 * Returns -Infinity if the date/slot cannot be parsed (treat as past).
 */
export function minutesUntilService(bookingDate: string, timeSlot: string): number {
  const serviceUTC = bookingToUTC(bookingDate, timeSlot);
  if (!serviceUTC) return -Infinity;
  return (serviceUTC.getTime() - Date.now()) / 60_000;
}

/**
 * Editability flags for a booking — computed client-side for UI gating.
 * The edge function re-validates these server-side before any write.
 */
export interface EditabilityFlags {
  canEditSchedule:  boolean;  // time-slot + service type
  canEditLocation:  boolean;  // address / lat / lng
  canCancel:        boolean;  // always true unless terminal
  isLateCancelZone: boolean;  // within 30 min → late cancel warning
  isPast:           boolean;  // service time has passed
  minutesLeft:      number;   // raw minutes until service (may be negative)
}

export function getEditability(booking: Booking): EditabilityFlags {
  const terminal = booking.status === "completed" ||
                   booking.status === "cancelled"  ||
                   booking.status === "late_cancelled";

  if (terminal) {
    return {
      canEditSchedule:  false,
      canEditLocation:  false,
      canCancel:        false,
      isLateCancelZone: false,
      isPast:           true,
      minutesLeft:      -Infinity,
    };
  }

  const mins = minutesUntilService(
    booking.booking_date || booking.date || "",
    booking.time_slot    || booking.time || "",
  );

  return {
    canEditSchedule:  mins > CUTOFF_SCHEDULE_MINUTES,
    canEditLocation:  mins > CUTOFF_LOCATION_MINUTES,
    canCancel:        true,   // always allowed
    isLateCancelZone: mins <= CUTOFF_LATE_CANCEL_MINUTES,
    isPast:           mins <= 0,
    minutesLeft:      mins,
  };
}

/**
 * Display-only conversion: UTC ISO string → Namibia local time (CAT, UTC+2).
 * Applies the fixed 2 h offset without relying on device locale.
 * Returns "—" if the input is null/undefined.
 */
export function toNamibiaDisplay(
  utcIso: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }
): string {
  if (!utcIso) return "—";
  // Add 2 h offset then re-format as UTC (which now == CAT)
  const shifted = new Date(new Date(utcIso).getTime() + NAMIBIA_UTC_OFFSET_MS);
  return shifted.toLocaleString("en-NA", { ...opts, timeZone: "UTC" });
}

// ─── Customer edge-function calls ─────────────────────────────────────────────

interface UpdateBookingEdgePayload {
  booking_date?: string;
  time_slot?:    string;
  service_type?: string;
  latitude?:     number | null;
  longitude?:    number | null;
  address_text?: string;
  area_name?:    string | null;
  landmark?:     string | null;
}

/**
 * Send an edit request through the update-booking edge function.
 * The function enforces all cutoff logic and ownership checks.
 * Throws on error with the message from the function response.
 */
export async function customerUpdateBooking(
  bookingId: string,
  updates:   UpdateBookingEdgePayload,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke("update-booking", {
    body: { bookingId, updates },
  });
  if (error) throw new Error(error.message || "Update failed");
  if (data?.error) throw new Error(data.error);
}

/**
 * Cancel a customer's own booking via the edge function.
 * Returns whether it was treated as a late cancellation.
 */
export async function customerCancelBooking(
  bookingId: string,
): Promise<{ isLate: boolean; newStatus: string }> {
  const { data, error } = await supabase.functions.invoke("update-booking", {
    body: { bookingId, updates: { action: "cancel" } },
  });
  if (error) throw new Error(error.message || "Cancellation failed");
  if (data?.error) throw new Error(data.error);
  return { isLate: data.isLate, newStatus: data.newStatus };
}

// ─── Booking export (for History + Commission export panels) ─────────────────

/**
 * Fetch all bookings in a booking_date range with customer + employee info.
 * Returns raw rows suitable for XLSX/CSV export.
 */
export async function fetchBookingsForExport(
  startDate: string,
  endDate:   string,
): Promise<Record<string, unknown>[]> {
  const { data: bData, error } = await supabase
    .from("bookings")
    .select("*")
    .gte("booking_date", startDate)
    .lte("booking_date", endDate)
    .order("booking_date", { ascending: false });

  if (error) throw error;
  const raw: any[] = bData || [];

  // Collect unique user IDs
  const ids = [
    ...new Set([
      ...raw.map((b: any) => b.customer_id).filter(Boolean),
      ...raw.map((b: any) => b.assigned_employee_id).filter(Boolean),
    ]),
  ] as string[];

  let userMap: Record<string, { email: string; full_name: string; employee_number?: string; whatsapp?: string }> = {};
  if (ids.length > 0) {
    const { data: uData } = await supabase
      .from("users")
      .select("id, email, full_name, employee_number, whatsapp")
      .in("id", ids);
    for (const u of uData as any[] || []) userMap[u.id] = u;
  }

  return raw.map((row: any) => {
    const nb         = normalizeBooking(row);
    const customer   = userMap[row.customer_id]            || {};
    const employee   = userMap[row.assigned_employee_id]   || {};
    const origPrice  = Number(row.original_price) || Number(row.price) || 0;
    const finalPrice = Number(row.price) || 0;
    const cancelType =
      row.status === "late_cancelled" ? "Late Cancellation"
      : row.status === "cancelled"    ? "Standard Cancellation"
      : "";

    return {
      booking_id:         row.id || "",
      customer_name:      (customer as any).full_name   || nb.fullName || "",
      customer_email:     (customer as any).email        || "",
      customer_phone:     (customer as any).whatsapp     || nb.whatsapp || "",
      service_type:       row.service_type     || "",
      original_price:     origPrice,
      final_price:        finalPrice,
      discount_applied:   row.is_free_wash ? origPrice - finalPrice : 0,
      loyalty_points_used:"",
      latitude:           row.latitude         ?? "",
      longitude:          row.longitude        ?? "",
      formatted_address:  nb.address           || nb.fullName       || row.address_text || "",
      assigned_employee:  (employee as any).full_name     || "",
      employee_number:    (employee as any).employee_number || "",
      booking_date:       row.booking_date     || "",
      booking_time:       row.time_slot        || "",
      status:             row.status           || "",
      cancellation_type:  cancelType,
      commission_amount:  Number(row.commission_amount) || 0,
      created_at:         row.created_at ? new Date(row.created_at).toLocaleString("en-NA") : "",
    };
  });
}

/**
 * Aggregate commission totals per employee for a booking_date range.
 * Used by the Commission tab date-range export.
 */
export async function fetchCommissionExportData(
  startDate: string,
  endDate:   string,
): Promise<Record<string, unknown>[]> {
  const [bookingRes, empRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("assigned_employee_id, price, original_price, commission_amount, status")
      .gte("booking_date", startDate)
      .lte("booking_date", endDate)
      .eq("status", "completed")
      .not("assigned_employee_id", "is", null),
    supabase
      .from("employees")
      .select("id, commission_percentage"),
  ]);

  if (bookingRes.error) throw bookingRes.error;
  const raw: any[] = bookingRes.data || [];

  // Build per-employee commission rate map
  const rateMap: Record<string, number> = {};
  for (const e of (empRes.data as any[] || [])) {
    rateMap[e.id] = Number(e.commission_percentage) || 20;
  }

  // Aggregate per employee
  const agg: Record<string, { jobs: number; revenue: number; commission: number; rate: number }> = {};
  for (const b of raw) {
    const eid  = b.assigned_employee_id as string;
    const rate = rateMap[eid] ?? 20;
    const base = (b.original_price && Number(b.original_price) > 0)
      ? Number(b.original_price) : Number(b.price) || 0;
    if (!agg[eid]) agg[eid] = { jobs: 0, revenue: 0, commission: 0, rate };
    agg[eid].jobs       += 1;
    agg[eid].revenue    += base;
    agg[eid].commission += Number(b.commission_amount) || Math.round(base * (rate / 100));
  }

  const eids = Object.keys(agg);
  let userMap: Record<string, { full_name: string; employee_number?: string }> = {};
  if (eids.length > 0) {
    const { data: uData } = await supabase
      .from("users")
      .select("id, full_name, employee_number")
      .in("id", eids);
    for (const u of uData as any[] || []) userMap[u.id] = u;
  }

  return eids.map(eid => ({
    employee_name:        (userMap[eid] as any)?.full_name      || eid,
    employee_number:      (userMap[eid] as any)?.employee_number || "",
    total_jobs_completed: agg[eid].jobs,
    total_revenue:        Number(agg[eid].revenue.toFixed(2)),
    commission_rate:      agg[eid].rate,
    total_commission:     Number(agg[eid].commission.toFixed(2)),
    date_range:           `${startDate} to ${endDate}`,
  }));
}

/**
 * Fetch late cancellations grouped by customer for the admin dashboard.
 */
export interface LateCancelStats {
  customer_id:  string;
  fullName:     string;
  count:        number;
  bookings:     Booking[];
}

export async function getLateCancellations(): Promise<Booking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("late_cancel", true)
    .order("cancelled_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeBooking);
}
