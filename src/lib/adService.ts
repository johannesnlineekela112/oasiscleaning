import { supabase } from "./supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdPlacement = "banner_top" | "inline" | "popup" | "sidebar";

export interface MarketingAd {
  id:          string;
  title:       string;
  message:     string;
  image_url:   string | null;
  button_text: string | null;
  button_link: string | null;
  placement:   AdPlacement;
  active:      boolean;
  start_date:  string | null;   // ISO date "YYYY-MM-DD" or null
  end_date:    string | null;   // ISO date "YYYY-MM-DD" or null
  priority:    number;
  created_at:  string;
  updated_at:  string;
}

export type CreateAdPayload = Omit<MarketingAd, "id" | "created_at" | "updated_at">;
export type UpdateAdPayload = Partial<CreateAdPayload>;

// ─── Public fetch (booking page) ─────────────────────────────────────────────
// RLS enforces: active=true AND schedule window covers today.
// Client-side ORDER BY priority ASC (lower = higher priority).

export async function fetchActiveAds(placement?: AdPlacement): Promise<MarketingAd[]> {
  let query = supabase
    .from("marketing_ads")
    .select("*")
    .order("priority", { ascending: true });

  if (placement) {
    query = query.eq("placement", placement);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as MarketingAd[];
}

// Convenience wrappers per placement slot
export const fetchBannerAds  = () => fetchActiveAds("banner_top");
export const fetchInlineAds  = () => fetchActiveAds("inline");
export const fetchPopupAds   = () => fetchActiveAds("popup");
export const fetchSidebarAds = () => fetchActiveAds("sidebar");

// ─── Admin — read all (ignores RLS schedule / active filter) ─────────────────
// Admin client uses the is_admin() policy which has no date restriction.

export async function getAllAds(): Promise<MarketingAd[]> {
  const { data, error } = await supabase
    .from("marketing_ads")
    .select("*")
    .order("priority", { ascending: true });
  if (error) throw error;
  return (data || []) as MarketingAd[];
}

// ─── Admin — create ───────────────────────────────────────────────────────────

export async function createAd(payload: CreateAdPayload): Promise<MarketingAd> {
  const { data, error } = await supabase
    .from("marketing_ads")
    .insert({
      title:       payload.title.trim(),
      message:     payload.message.trim(),
      image_url:   payload.image_url   || null,
      button_text: payload.button_text || null,
      button_link: payload.button_link || null,
      placement:   payload.placement,
      active:      payload.active,
      start_date:  payload.start_date  || null,
      end_date:    payload.end_date    || null,
      priority:    payload.priority,
    })
    .select()
    .single();
  if (error) throw error;
  return data as MarketingAd;
}

// ─── Admin — update ───────────────────────────────────────────────────────────

export async function updateAd(id: string, updates: UpdateAdPayload): Promise<void> {
  const clean: Record<string, unknown> = {};
  if (updates.title       !== undefined) clean.title       = updates.title.trim();
  if (updates.message     !== undefined) clean.message     = updates.message.trim();
  if (updates.image_url   !== undefined) clean.image_url   = updates.image_url   || null;
  if (updates.button_text !== undefined) clean.button_text = updates.button_text || null;
  if (updates.button_link !== undefined) clean.button_link = updates.button_link || null;
  if (updates.placement   !== undefined) clean.placement   = updates.placement;
  if (updates.active      !== undefined) clean.active      = updates.active;
  if (updates.start_date  !== undefined) clean.start_date  = updates.start_date  || null;
  if (updates.end_date    !== undefined) clean.end_date    = updates.end_date    || null;
  if (updates.priority    !== undefined) clean.priority    = updates.priority;

  const { error } = await supabase
    .from("marketing_ads")
    .update(clean)
    .eq("id", id);
  if (error) throw error;
}

// ─── Admin — quick-toggle active ──────────────────────────────────────────────

export async function toggleAdActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase
    .from("marketing_ads")
    .update({ active })
    .eq("id", id);
  if (error) throw error;
}

// ─── Admin — delete ───────────────────────────────────────────────────────────

export async function deleteAd(id: string): Promise<void> {
  const { error } = await supabase
    .from("marketing_ads")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const PLACEMENT_LABELS: Record<AdPlacement, string> = {
  banner_top: "Banner — Top of page",
  inline:     "Inline — Between sections",
  popup:      "Popup — On page load",
  sidebar:    "Sidebar — Floating panel",
};

export const AD_PLACEMENTS: AdPlacement[] = [
  "banner_top",
  "inline",
  "popup",
  "sidebar",
];

export function isAdCurrentlyActive(ad: MarketingAd): boolean {
  if (!ad.active) return false;
  const today = new Date().toISOString().split("T")[0];
  if (ad.start_date && ad.start_date > today) return false;
  if (ad.end_date   && ad.end_date   < today) return false;
  return true;
}

export function emptyAdForm(): CreateAdPayload {
  return {
    title:       "",
    message:     "",
    image_url:   null,
    button_text: null,
    button_link: null,
    placement:   "banner_top",
    active:      true,
    start_date:  null,
    end_date:    null,
    priority:    0,
  };
}
