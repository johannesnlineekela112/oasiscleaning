import { supabase } from "./supabase";
import type { User } from "@supabase/supabase-js";

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "employee" | "customer";
  employee_number?: string | null;
  whatsapp?: string | null;   // cellphone number stored in whatsapp column
  cellphone?: string | null;  // employee cellphone (staff accounts)
  created_at?: string;
}

/**
 * Register a new customer account.
 * cellphone is required (stored in the whatsapp column for backward compat).
 * referralCode is optional — if provided, awards +25 pts to the referrer.
 */
export async function registerUser(
  email:        string,
  password:     string,
  fullName:     string,
  cellphone:    string,
  referralCode?: string,
): Promise<User> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role: "customer" } },
  });
  if (error) throw error;
  if (!data.user) throw new Error("Registration failed.");

  // Upsert into users table — cellphone goes into whatsapp column (existing schema)
  await supabase.from("users").upsert(
    { id: data.user.id, full_name: fullName, email, role: "customer", whatsapp: cellphone || null },
    { onConflict: "id" }
  );

  // Process referral code (non-critical — never throws to the caller)
  if (referralCode && referralCode.trim()) {
    try {
      await supabase.rpc("record_referral", {
        p_new_user_id:   data.user.id,
        p_referral_code: referralCode.trim().toUpperCase(),
      });
    } catch { /* silent — referral is best-effort */ }
  }

  return data.user;
}

export async function loginUser(email: string, password: string): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error("Login failed.");
  return data.user;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("users").select("*").eq("id", uid).maybeSingle();
  if (error) throw error;
  return data as UserProfile | null;
}

export async function updateUserProfile(
  uid:  string,
  payload: { full_name?: string; whatsapp?: string }
): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update(payload)
    .eq("id", uid);
  if (error) throw error;
}

export async function isAdmin(uid: string): Promise<boolean> {
  const profile = await getUserProfile(uid);
  return profile?.role === "admin";
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * getSessionUser — one-shot: returns the current user or null.
 */
export async function getSessionUser(): Promise<User | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

/**
 * onAuthChange — subscribes to auth state changes.
 */
export function onAuthChange(callback: (user: User | null) => void): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => subscription.unsubscribe();
}

export type { User };
