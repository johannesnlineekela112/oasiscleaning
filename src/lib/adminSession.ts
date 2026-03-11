/**
 * adminSession.ts
 *
 * Session hardening for admin users.
 *
 * Three protections:
 *
 *  1. INACTIVITY LOGOUT
 *     After ADMIN_IDLE_TIMEOUT_MS (15 min) of no mouse/keyboard/scroll
 *     activity, the admin is signed out automatically.
 *     The countdown resets on every user interaction.
 *
 *  2. SHORT SESSION EXPIRY ENFORCEMENT
 *     Supabase JWTs expire after 1 hour (project-wide setting). We cannot
 *     reduce this only for admins via Supabase config, so we enforce a
 *     shorter client-side limit: ADMIN_SESSION_MAX_MS (4 hours).
 *     On every page-focus event we check the session age against the login
 *     timestamp stored in sessionStorage and sign out if exceeded.
 *
 *  3. RE-AUTHENTICATION GATE
 *     requireReAuth() returns a Promise that resolves when the user has
 *     successfully re-verified their password (or TOTP if MFA enrolled).
 *     It is used before destructive actions (delete booking, role change, etc.)
 *     via the <ReAuthModal /> component and the `useReAuth` hook.
 *
 * Usage (in a top-level admin component):
 *   useInactivityLogout();   // call once in AdminDashboard
 *
 * Usage (before a sensitive action):
 *   const { requireReAuth, ReAuthModal } = useReAuth();
 *   await requireReAuth();
 *   // ... perform the sensitive action
 */

import { supabase } from './supabase';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Sign out after 15 minutes of inactivity. */
export const ADMIN_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

/** Maximum absolute session duration for admins, even if active. */
export const ADMIN_SESSION_MAX_MS = 4 * 60 * 60 * 1000;

/** sessionStorage key for login timestamp. */
const ADMIN_LOGIN_TS_KEY = 'oasis_admin_login_ts';

// ─── Login timestamp ──────────────────────────────────────────────────────────

/** Called immediately after a successful admin login. */
export function recordAdminLoginTime(): void {
  sessionStorage.setItem(ADMIN_LOGIN_TS_KEY, String(Date.now()));
}

/** Returns ms since admin logged in, or Infinity if timestamp is missing. */
export function adminSessionAge(): number {
  const ts = sessionStorage.getItem(ADMIN_LOGIN_TS_KEY);
  return ts ? Date.now() - Number(ts) : Infinity;
}

/** Clear the login timestamp on logout. */
export function clearAdminSessionData(): void {
  sessionStorage.removeItem(ADMIN_LOGIN_TS_KEY);
}

// ─── Inactivity logout (used by useInactivityLogout hook) ────────────────────

type LogoutCallback = () => void;

/**
 * Sets up inactivity detection.
 * Returns a cleanup function — call it in the useEffect cleanup.
 *
 * @param onLogout   Called when inactivity timeout fires.
 * @param timeoutMs  Override the default timeout (for testing).
 */
export function setupInactivityLogout(
  onLogout:  LogoutCallback,
  timeoutMs: number = ADMIN_IDLE_TIMEOUT_MS,
): () => void {
  let timer: ReturnType<typeof setTimeout>;

  const reset = () => {
    clearTimeout(timer);
    timer = setTimeout(onLogout, timeoutMs);
  };

  const EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
  EVENTS.forEach(ev => window.addEventListener(ev, reset, { passive: true }));

  // Start the initial timer
  reset();

  return () => {
    clearTimeout(timer);
    EVENTS.forEach(ev => window.removeEventListener(ev, reset));
  };
}

// ─── Session age check (used by useAdminSessionGuard hook) ───────────────────

/**
 * Registers a visibilitychange / focus listener that signs the admin out
 * if the absolute session age exceeds ADMIN_SESSION_MAX_MS.
 *
 * Returns a cleanup function.
 */
export function setupSessionAgeGuard(
  onExpired: LogoutCallback,
  maxAgeMs:  number = ADMIN_SESSION_MAX_MS,
): () => void {
  const check = () => {
    if (adminSessionAge() > maxAgeMs) onExpired();
  };

  document.addEventListener('visibilitychange', check);
  window.addEventListener('focus', check);

  // Also check immediately (handles page refreshes)
  check();

  return () => {
    document.removeEventListener('visibilitychange', check);
    window.removeEventListener('focus', check);
  };
}

// ─── Force logout ─────────────────────────────────────────────────────────────

/**
 * Sign out the admin and clear all session data.
 * Can be called from any inactivity/age guard.
 */
export async function forceAdminLogout(reason: 'inactivity' | 'session_expired'): Promise<void> {
  clearAdminSessionData();
  console.warn(`[AdminSession] Logging out: ${reason}`);
  await supabase.auth.signOut();
  // Hard redirect to admin login — ensures no stale React state persists
  window.location.replace('/admin/login');
}

// ─── Re-authentication ────────────────────────────────────────────────────────

/**
 * Re-verify the admin's password using Supabase's reauthentication API.
 * This asks Supabase to send an OTP to the admin's email, which can then
 * be confirmed via `supabase.auth.verifyOtp`.
 *
 * For a simpler UX we re-verify by re-signing in with the stored email
 * and a password the user enters in the ReAuthModal.
 *
 * Returns true on success, throws on failure.
 */
export async function verifyAdminPassword(email: string, password: string): Promise<true> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return true;
}

// ─── Cookie domain hint ───────────────────────────────────────────────────────

/**
 * The Supabase client is configured with cookieOptions.domain = '.oasispureshine.com'
 * (see supabase.ts) so sessions created on admin.oasispureshine.com are
 * accessible on the main domain and vice-versa.
 *
 * This is a documentation note — the actual config lives in supabase.ts.
 */
export const COOKIE_DOMAIN = '.oasispureshine.com';
