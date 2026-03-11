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
} as const;
