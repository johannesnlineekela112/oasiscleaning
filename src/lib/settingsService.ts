import { supabase } from "./supabase";

export interface AppSetting {
  key:        string;
  value:      string;
  updated_at: string;
}

export async function getSetting(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}

export async function getBoolSetting(key: string, defaultValue = false): Promise<boolean> {
  try {
    const val = await getSetting(key);
    if (val === null) return defaultValue;
    return val.toLowerCase() === "true";
  } catch {
    return defaultValue;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
}

export async function setBoolSetting(key: string, value: boolean): Promise<void> {
  await setSetting(key, value ? "true" : "false");
}

export const SETTINGS_KEYS = {
  REFERRAL_SYSTEM_ENABLED:  "referral_system_enabled",
  WHATSAPP_AGENT_NUMBER:    "whatsapp_agent_number",
  BOOKING_TIMESLOTS:        "booking_timeslots",
} as const;

// ── Timeslot type ─────────────────────────────────────────────────────────────
export interface TimeSlotSetting {
  value:  string;   // e.g. "09:30-11:00" or "VIP 17:00-18:30"
  label:  string;   // display label
  is_vip: boolean;
}

export const DEFAULT_TIMESLOTS: TimeSlotSetting[] = [
  { value: "08:00-09:30",     label: "08:00 – 09:30",          is_vip: false },
  { value: "09:30-11:00",     label: "09:30 – 11:00",          is_vip: false },
  { value: "11:00-12:30",     label: "11:00 – 12:30",          is_vip: false },
  { value: "13:00-14:30",     label: "13:00 – 14:30",          is_vip: false },
  { value: "14:30-16:00",     label: "14:30 – 16:00",          is_vip: false },
  { value: "VIP 17:00-18:30", label: "⭐ VIP 17:00 – 18:30",   is_vip: true  },
  { value: "VIP 18:30-19:30", label: "⭐ VIP 18:30 – 19:30",   is_vip: true  },
];

export async function getTimeslots(): Promise<TimeSlotSetting[]> {
  try {
    const raw = await getSetting(SETTINGS_KEYS.BOOKING_TIMESLOTS);
    if (!raw) return DEFAULT_TIMESLOTS;
    return JSON.parse(raw) as TimeSlotSetting[];
  } catch {
    return DEFAULT_TIMESLOTS;
  }
}

export async function saveTimeslots(slots: TimeSlotSetting[]): Promise<void> {
  await setSetting(SETTINGS_KEYS.BOOKING_TIMESLOTS, JSON.stringify(slots));
}
