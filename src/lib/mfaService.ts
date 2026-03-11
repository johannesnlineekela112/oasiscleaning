/**
 * mfaService.ts
 *
 * All Supabase TOTP MFA operations for admin users.
 *
 * Flow for a first-time admin:
 *   1. enrollTOTP()        → returns QR code SVG + factorId
 *   2. verifyTOTPEnroll()  → confirms the code; factor becomes "verified"
 *      After success, session is upgraded to aal2 automatically.
 *
 * Flow on every subsequent login:
 *   1. After signInWithPassword, call getAAL()
 *   2. If nextLevel === 'aal2' && currentLevel === 'aal1': show TOTP challenge
 *   3. challengeAndVerifyTOTP() → upgrades session to aal2
 *
 * MFA is enforced at two layers:
 *   - Frontend: RouteGuard checks AAL before rendering AdminDashboard
 *   - Database: restrictive RLS policy `require_aal2_for_admin_audit` and
 *               `require_aal2_for_role_updates` block aal1 sessions at the
 *               Postgres level even if the frontend check is bypassed.
 */

import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AAL = 'aal1' | 'aal2';

export interface AALStatus {
  currentLevel: AAL;
  nextLevel:    AAL;
  /** true when the user has an enrolled+verified TOTP factor */
  hasMFA:       boolean;
  /** true when MFA is enrolled but this session hasn't verified it yet */
  mfaRequired:  boolean;
}

export interface TOTPEnrollResult {
  factorId: string;
  qrCode:   string;   // SVG data URL — pass directly to <img src={qrCode} />
  secret:   string;   // Manual entry fallback
  uri:      string;   // otpauth:// URI
}

// ─── AAL ─────────────────────────────────────────────────────────────────────

/**
 * Returns the current session's authenticator assurance level.
 * This is a fast, usually-local operation (no network call in most cases).
 */
export async function getAAL(): Promise<AALStatus> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;

  const currentLevel = (data.currentLevel ?? 'aal1') as AAL;
  const nextLevel    = (data.nextLevel    ?? 'aal1') as AAL;

  return {
    currentLevel,
    nextLevel,
    hasMFA:      nextLevel    === 'aal2',
    mfaRequired: nextLevel    === 'aal2' && currentLevel !== 'aal2',
  };
}

// ─── Enrollment ───────────────────────────────────────────────────────────────

/**
 * Start TOTP enrollment.  Call once after the admin is authenticated (aal1).
 * Returns the QR code SVG and factorId needed for the verify step.
 */
export async function enrollTOTP(friendlyName = 'Oasis Admin'): Promise<TOTPEnrollResult> {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType:   'totp',
    friendlyName,
  });
  if (error) throw error;

  return {
    factorId: data.id,
    // Supabase returns the QR as a raw SVG string; turn it into a data URL
    qrCode:   `data:image/svg+xml;utf8,${encodeURIComponent(data.totp.qr_code)}`,
    secret:   data.totp.secret,
    uri:      data.totp.uri,
  };
}

/**
 * Confirm enrollment by verifying the first TOTP code the user enters.
 * On success Supabase immediately upgrades the session to aal2.
 */
export async function verifyTOTPEnroll(factorId: string, code: string): Promise<void> {
  const { data: challengeData, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) throw challengeError;

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code,
  });
  if (error) throw error;
}

// ─── Challenge (login step) ───────────────────────────────────────────────────

/**
 * Complete the MFA challenge during login.
 * Call when getAAL() returns { mfaRequired: true }.
 * On success the session is upgraded to aal2.
 */
export async function challengeAndVerifyTOTP(code: string): Promise<void> {
  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) throw factorsError;

  const totpFactor = factors.totp.find(f => f.status === 'verified');
  if (!totpFactor) throw new Error('No verified TOTP factor found. Please enrol MFA first.');

  const { data: challengeData, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
  if (challengeError) throw challengeError;

  const { error } = await supabase.auth.mfa.verify({
    factorId:    totpFactor.id,
    challengeId: challengeData.id,
    code,
  });
  if (error) throw error;
}

// ─── Unenroll ─────────────────────────────────────────────────────────────────

/**
 * Remove a TOTP factor.  Requires aal2 session.
 * After unenroll, refresh the session so the AAL downgrades immediately.
 */
export async function unenrollTOTP(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
  // Force session refresh so aal2→aal1 downgrade takes effect immediately
  await supabase.auth.refreshSession();
}

/**
 * List all enrolled TOTP factors for the current user.
 */
export async function listTOTPFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return data.totp;
}
