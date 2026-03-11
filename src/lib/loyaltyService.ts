/**
 * loyaltyService.ts
 *
 * Client-side service layer for the Namshine loyalty & free wash redemption system.
 *
 * Architecture overview
 * ─────────────────────
 * All mutating operations (redeem_points, attach_to_booking, expire_stale) flow
 * through the `loyalty-redeem` edge function which uses a service-role client.
 * This prevents race conditions and enforces server-side guards that can't be
 * bypassed by a malicious client.
 *
 * Read operations (SELECT) go through the regular supabase client so that RLS
 * policies are enforced — customers see only their own rows.
 *
 * Point economics (baked into the DB, mirrored here for UI display only):
 *   +10  per completed booking
 *   +20  milestone bonus every 5 completed bookings
 *   -15  per late cancellation   (redeemable only, never lifetime)
 *   +25  per successful referral
 *   100  redeemable_points = 1 free Standard wash
 *
 * Tier thresholds (lifetime_points only):
 *   Bronze   < 500
 *   Silver   500 – 1499
 *   Gold     1500 – 2999
 *   Platinum ≥ 3000
 *
 * Abuse guards (enforced in DB / edge function):
 *   - Max 2 redemptions per calendar month
 *   - Free wash requires non-VIP booking
 *   - Max 1 redemption per booking
 *   - Unused redemptions expire after 90 days with automatic points refund
 */

import { supabase } from "./supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserLoyalty {
  id:                      string;
  user_id:                 string;
  total_points:            number;
  lifetime_points:         number;
  redeemable_points:       number;
  tier:                    string;
  free_washes_earned:      number;
  free_washes_used:        number;
  completed_bookings_count: number;
  referral_code:           string | null;
  referred_by:             string | null;
  total_referrals:         number;
  updated_at:              string;
}

export interface FreeWashRedemption {
  id:           string;
  user_id:      string;
  booking_id:   string | null;
  points_used:  number;
  status:       "reserved" | "completed" | "cancelled";
  redeemed_at:  string;
  expires_at:   string;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at:   string;
}

/** Row from admin_loyalty_overview view — one row per customer */
export interface AdminLoyaltyRow {
  user_id:                 string;
  full_name:               string;
  email:                   string;
  lifetime_points:         number;
  redeemable_points:       number;
  tier:                    string;
  free_washes_earned:      number;
  free_washes_used:        number;
  free_washes_available:   number;
  completed_bookings_count: number;
  total_referrals:         number;
  referral_code:           string | null;
  updated_at:              string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Points needed to redeem one free Standard wash */
export const FREE_WASH_COST = 100;

/**
 * Tier config — thresholds use lifetime_points only (never decreases).
 * next is the lifetime_points target for the next tier (Infinity for Platinum).
 */
export const TIER_CONFIG: Record<string, {
  label:   string;
  min:     number;
  next:    number;
  emoji:   string;
  color:   string;          // Tailwind text class
  bg:      string;          // Tailwind bg class
  badge:   string;          // Tailwind border class for card accent
}> = {
  Bronze: {
    label: "Bronze",  min: 0,    next: 500,      emoji: "🥉",
    color: "text-amber-700",      bg: "bg-amber-100 dark:bg-amber-900/30",
    badge: "border-amber-400",
  },
  Silver: {
    label: "Silver",  min: 500,  next: 1500,     emoji: "🥈",
    color: "text-slate-600 dark:text-slate-300",  bg: "bg-slate-100 dark:bg-slate-800/40",
    badge: "border-slate-400",
  },
  Gold: {
    label: "Gold",    min: 1500, next: 3000,     emoji: "🥇",
    color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-900/20",
    badge: "border-yellow-400",
  },
  Platinum: {
    label: "Platinum", min: 3000, next: Infinity, emoji: "💎",
    color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/20",
    badge: "border-purple-400",
  },
};

/**
 * Points needed to reach a given tier from 0.
 * Used for progress-bar calculations.
 */
export function tierProgress(lifetimePoints: number): {
  currentTier: string;
  nextTier:    string | null;
  progress:    number;   // 0–1 fraction within the current tier band
  pointsToNext: number;  // points still needed to reach next tier
} {
  const tiers = ["Bronze", "Silver", "Gold", "Platinum"];
  let currentTier = "Bronze";
  for (const t of tiers) {
    if (lifetimePoints >= TIER_CONFIG[t].min) currentTier = t;
  }
  const idx = tiers.indexOf(currentTier);
  const next = idx < tiers.length - 1 ? tiers[idx + 1] : null;
  if (!next) {
    return { currentTier, nextTier: null, progress: 1, pointsToNext: 0 };
  }
  const min  = TIER_CONFIG[currentTier].min;
  const max  = TIER_CONFIG[next].min;
  const progress = Math.min(1, (lifetimePoints - min) / (max - min));
  return {
    currentTier,
    nextTier: next,
    progress,
    pointsToNext: Math.max(0, max - lifetimePoints),
  };
}

/**
 * Progress toward the next free wash (based on redeemable_points).
 * Returns a 0–1 fraction.
 */
export function freeWashProgress(redeemablePoints: number): number {
  return Math.min(1, (redeemablePoints % FREE_WASH_COST) / FREE_WASH_COST);
}

/** How many free washes the user can currently redeem */
export function availableFreeWashes(redeemablePoints: number): number {
  return Math.floor(redeemablePoints / FREE_WASH_COST);
}

// ─── Read operations ──────────────────────────────────────────────────────────

/**
 * Fetch the loyalty row for the given user.
 * Returns null if the row doesn't exist yet (very new user).
 */
export async function fetchMyLoyalty(userId: string): Promise<UserLoyalty | null> {
  const { data, error } = await supabase
    .from("user_loyalty")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as UserLoyalty | null;
}

/**
 * Fetch all free wash redemptions for the given user, newest first.
 */
export async function fetchMyRedemptions(userId: string): Promise<FreeWashRedemption[]> {
  const { data, error } = await supabase
    .from("free_wash_redemptions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as FreeWashRedemption[];
}

/**
 * Fetch all loyalty rows for the admin overview.
 * Uses the admin_loyalty_overview view (pre-joined with users).
 * RLS on user_loyalty ensures only admin can read all rows.
 */
export async function fetchAdminLoyaltyOverview(): Promise<AdminLoyaltyRow[]> {
  const { data, error } = await supabase
    .from("admin_loyalty_overview")
    .select("*");
  if (error) throw error;
  return (data || []) as AdminLoyaltyRow[];
}

/**
 * Fetch all redemptions for a given user (admin use).
 */
export async function fetchUserRedemptions(userId: string): Promise<FreeWashRedemption[]> {
  const { data, error } = await supabase
    .from("free_wash_redemptions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as FreeWashRedemption[];
}

// ─── Mutating operations (via edge function) ──────────────────────────────────

/**
 * Redeem 100 redeemable_points for a free wash reservation.
 * Calls loyalty-redeem with action='redeem_points'.
 * Returns the new redemption ID.
 *
 * Throws with a human-readable message on:
 *   - Insufficient points (< 100)
 *   - Monthly cap reached (≥ 2 per month)
 */
export async function redeemFreeWash(): Promise<string> {
  const { data, error } = await supabase.functions.invoke("loyalty-redeem", {
    body: { action: "redeem_points" },
  });
  if (error) throw new Error(error.message || "Redemption failed");
  if (data?.error) throw new Error(data.error);
  return data.redemptionId as string;
}

/**
 * Attach an existing 'reserved' redemption to a booking.
 * Sets booking.price = 0 and booking.is_free_wash = true.
 *
 * Must be called AFTER the booking has been successfully created
 * (so we have a bookingId).
 *
 * Throws with a human-readable message on:
 *   - Redemption already used
 *   - Redemption expired (auto-refunds points)
 *   - VIP booking (ineligible)
 *   - Booking already has a free wash attached
 */
export async function attachFreeWashToBooking(
  redemptionId: string,
  bookingId:    string,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke("loyalty-redeem", {
    body: { action: "attach_to_booking", redemptionId, bookingId },
  });
  if (error) throw new Error(error.message || "Failed to attach free wash");
  if (data?.error) throw new Error(data.error);
}

/**
 * Admin-only: expire all stale (overdue) reservations and refund their points.
 * Returns the count of redemptions expired.
 */
export async function expireStaleRedemptions(): Promise<number> {
  const { data, error } = await supabase.functions.invoke("loyalty-redeem", {
    body: { action: "expire_stale" },
  });
  if (error) throw new Error(error.message || "Expiry failed");
  if (data?.error) throw new Error(data.error);
  return (data?.expiredCount ?? 0) as number;
}

// ─── Display helpers ──────────────────────────────────────────────────────────

/** Format a redemption's expiry as a short string, e.g. "Expires 2 Sep 2025" */
export function formatExpiry(isoString: string): string {
  const d = new Date(isoString);
  const now = Date.now();
  const diffDays = Math.floor((d.getTime() - now) / 86_400_000);
  if (diffDays < 0)  return "Expired";
  if (diffDays === 0) return "Expires today";
  if (diffDays === 1) return "Expires tomorrow";
  if (diffDays < 7)  return `Expires in ${diffDays} days`;
  return `Expires ${d.toLocaleDateString("en-NA", { day: "numeric", month: "short", year: "numeric" })}`;
}

/** Redemption status label + color for display */
export const REDEMPTION_STATUS: Record<string, { label: string; color: string }> = {
  reserved:  { label: "Available",  color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  completed: { label: "Used",       color: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelled",  color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
};
