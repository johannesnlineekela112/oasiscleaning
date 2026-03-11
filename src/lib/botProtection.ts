/**
 * botProtection.ts
 *
 * Client-side bot protection layer.
 *
 * Security architecture (v2):
 *
 *   BEFORE (vulnerable)           AFTER (hardened)
 *   ─────────────────────────     ──────────────────────────────
 *   anon INSERT → security_logs   anon EXECUTE → log_security_event() RPC
 *   anon INSERT → abuse_blocks    edge fn call → record-abuse (secret-gated)
 *   anon INSERT → bookings        edge fn call → submit-booking (all validated)
 *
 * The client can still call checkLocalRate() and checkHoneypot() locally for
 * instant feedback, but all database writes go through server-controlled paths.
 *
 * Fingerprint note:
 *   Client fingerprints are browser heuristics (UA + timezone + resolution).
 *   They are NOT cryptographically secure identifiers. They are used to make
 *   mass automated abuse harder, not to uniquely identify users.
 */

import { supabase } from './supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export type BotAction =
  | 'register'
  | 'login'
  | 'booking'
  | 'cancel';

export interface ProtectionResult {
  allowed:     boolean;
  reason?:     string;
  retryAfter?: number; // seconds
}

// ── Client fingerprint (approximation of IP) ──────────────────────────────────

function getFingerprint(): string {
  try {
    const parts = [
      navigator.userAgent.slice(0, 60),
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.language,
      screen.width + 'x' + screen.height,
    ];
    // djb2 hash → hex
    let h = 5381;
    const s = parts.join('|');
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return (h >>> 0).toString(16).padStart(8, '0');
  } catch {
    return 'unknown';
  }
}

export const FP = getFingerprint();

// ── In-memory rate-limit counters (reset on page load) ────────────────────────

const RATE_LIMITS: Record<BotAction, { perMinute: number }> = {
  register: { perMinute: 3  },
  login:    { perMinute: 10 },
  booking:  { perMinute: 5  },
  cancel:   { perMinute: 5  },
};

const _counters: Record<string, { windowStart: number; count: number }> = {};

function checkLocalRate(action: BotAction): boolean {
  const key   = action;
  const limit = RATE_LIMITS[action].perMinute;
  const now   = Date.now();
  const entry = _counters[key];
  if (!entry || now - entry.windowStart > 60_000) {
    _counters[key] = { windowStart: now, count: 1 };
    return true;
  }
  _counters[key].count++;
  return _counters[key].count <= limit;
}

// ── Honeypot ──────────────────────────────────────────────────────────────────

export function checkHoneypot(honeypotValue: string): boolean {
  return honeypotValue.length > 0; // true = bot detected
}

// ── Security logging via SECURITY DEFINER RPC ─────────────────────────────────
// Direct INSERT into security_logs is now blocked for anon users.
// Use the log_security_event() RPC instead — it validates and sanitises input.

async function logAction(
  action:  string,
  result:  'allowed' | 'blocked',
  userId?: string | null,
  reason?: string,
  meta?:   Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.rpc('log_security_event', {
      p_fingerprint: FP,
      p_user_id:     userId ?? null,
      p_action:      action,
      p_result:      result,
      p_reason:      reason ?? null,
      p_metadata:    meta ?? null,
    });
  } catch {
    // Non-critical — never throw. If the RPC fails, the UX is unaffected.
  }
}

// ── Abuse block check ─────────────────────────────────────────────────────────
// READ from abuse_blocks is still allowed for anon (needed for self-check).

async function isBlocked(userId?: string | null): Promise<string | null> {
  try {
    const identifiers = [FP, ...(userId ? [userId] : [])];
    const { data } = await supabase
      .from('abuse_blocks')
      .select('identifier, reason, expires_at')
      .in('identifier', identifiers)
      .gt('expires_at', new Date().toISOString())
      .limit(1);
    if (data && data.length > 0) {
      const b = data[0];
      const expiresIn = Math.max(0, Math.round(
        (new Date(b.expires_at).getTime() - Date.now()) / 60_000
      ));
      return `${b.reason}. Try again in ${expiresIn} minute${expiresIn !== 1 ? 's' : ''}.`;
    }
    return null;
  } catch {
    return null; // fail open — don't block legitimate users on DB errors
  }
}

// ── Escalate to record-abuse edge function ────────────────────────────────────
// The submit-booking edge function calls this server-to-server.
// From the client we use the SECURITY DEFINER check_and_block_abuse() RPC
// which was already deployed and handles abuse escalation safely.

async function maybeBlock(action: BotAction, userId?: string | null): Promise<void> {
  try {
    // check_and_block_abuse is a SECURITY DEFINER function that:
    //   1. counts recent failures from security_logs
    //   2. if over threshold, inserts into abuse_blocks directly (DEFINER bypass)
    // This replaces the old pattern of direct client INSERT into abuse_blocks.
    await supabase.rpc('check_and_block_abuse', {
      p_identifier: FP,
      p_action:     action,
    });
  } catch {
    // Non-critical
  }
}

// ── Main guard ────────────────────────────────────────────────────────────────

export async function guardAction(
  action: BotAction,
  opts?: {
    honeypotValue?: string;
    userId?:        string | null;
    meta?:          Record<string, unknown>;
  },
): Promise<ProtectionResult> {
  const { honeypotValue = '', userId, meta } = opts ?? {};

  // 1. Honeypot (instant, no network)
  if (checkHoneypot(honeypotValue)) {
    await logAction(action, 'blocked', userId, 'honeypot_filled', meta);
    return { allowed: false, reason: 'Submission rejected.' };
  }

  // 2. Check existing abuse block
  const blockReason = await isBlocked(userId);
  if (blockReason) {
    await logAction(action, 'blocked', userId, 'abuse_block: ' + blockReason, meta);
    return { allowed: false, reason: blockReason, retryAfter: 3600 };
  }

  // 3. Local rate limit (in-memory, resets on page load)
  const localOk = checkLocalRate(action);
  if (!localOk) {
    await logAction(action, 'blocked', userId, 'rate_limit_local', meta);
    await maybeBlock(action, userId);
    return {
      allowed: false,
      reason:  `Too many ${action} attempts. Please wait a minute and try again.`,
      retryAfter: 60,
    };
  }

  // 4. Log allowed (for login/register — bookings are logged by the edge fn)
  if (action !== 'booking') {
    await logAction(action, 'allowed', userId, undefined, meta);
  }
  return { allowed: true };
}

export async function recordFailure(
  action:  BotAction,
  userId?: string | null,
  reason?: string,
): Promise<void> {
  await logAction(action, 'blocked', userId, reason ?? 'failed_attempt');
  await maybeBlock(action, userId);
}

// ── Email verification check ──────────────────────────────────────────────────

export async function isEmailVerified(userId: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== userId) return false;
    return !!user.email_confirmed_at;
  } catch {
    return true; // fail open
  }
}
