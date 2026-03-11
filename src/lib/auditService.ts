/**
 * auditService.ts
 *
 * Client-side wrapper that records admin actions to the admin_audit_log table.
 *
 * Design decisions:
 *  - Non-critical: auditLog() never throws. A failed audit write must never
 *    block the action that triggered it.
 *  - Best-effort: for hardened audit requirements in the future, move this
 *    logic to a server-side Edge Function so logs cannot be skipped even if
 *    the client crashes.
 *  - Schema: target_id is stored as text so it works for both uuid and integer
 *    primary keys without type gymnastics at the call site.
 */

import { supabase } from './supabase';

// ─── Action catalogue ─────────────────────────────────────────────────────────

export type AuditAction =
  // Bookings
  | 'booking.status_changed'
  | 'booking.paid_toggled'
  | 'booking.assigned'
  | 'booking.deleted'
  // Staff
  | 'employee.created'
  | 'employee.deleted'
  // Services
  | 'service.created'
  | 'service.updated'
  | 'service.deleted'
  | 'service.toggled'
  // Commission
  | 'commission.rate_changed'
  | 'commission.payment_recorded'
  | 'commission.approved'
  | 'commission.paid'
  // Settings
  | 'settings.referral_toggled'
  | 'settings.whatsapp_updated'
  // Content
  | 'content.document_saved'
  | 'content.team_member_created'
  | 'content.team_member_updated'
  | 'content.team_member_deleted'
  // Ads
  | 'ad.created'
  | 'ad.updated'
  | 'ad.deleted'
  // Security
  | 'security.abuse_unblocked'
  // Authentication events (admin-specific)
  | 'auth.admin_login'
  | 'auth.admin_login_failed'
  | 'auth.admin_logout'
  | 'auth.password_changed'
  | 'auth.role_changed'
  | 'auth.mfa_enrolled'
  | 'auth.mfa_unenrolled'
  | 'auth.session_expired'
  | 'auth.reauth_success'
  | 'auth.reauth_failed';

// ─── Logger ───────────────────────────────────────────────────────────────────

/**
 * Write an audit entry.
 *
 * @param adminId    - The auth.uid() of the acting admin.
 * @param action     - One of the AuditAction strings above.
 * @param targetType - The entity type: 'booking', 'employee', 'service', etc.
 * @param targetId   - The PK of the affected row (string or number, stored as text).
 * @param payload    - Optional snapshot: { before, after } or action params.
 */
export async function auditLog(
  adminId:     string | null | undefined,
  action:      AuditAction,
  targetType?: string,
  targetId?:   string | number | null,
  payload?:    Record<string, unknown>,
): Promise<void> {
  if (!adminId) return; // no-op if admin session not yet resolved
  try {
    await supabase.from('admin_audit_log').insert({
      admin_id:    adminId,
      action,
      target_type: targetType ?? null,
      target_id:   targetId != null ? String(targetId) : null,
      payload:     payload ?? null,
    });
  } catch {
    // Intentionally swallowed — audit failure must never surface to the user
    // or block the underlying operation.
  }
}

// ─── Auth event metadata ──────────────────────────────────────────────────────

export interface AuthEventMeta {
  /** Email of the actor — used for failed logins where admin_id is unknown */
  actorEmail?: string;
  ipAddress?:  string;
  userAgent?:  string;
  sessionId?:  string;
}

/**
 * Audit log specifically for auth events (login, failed login, MFA, etc.)
 * Unlike the base auditLog(), adminId is optional here — for failed logins
 * we may not have an authenticated user.
 */
export async function auditAuthEvent(
  adminId:    string | null | undefined,
  action:     AuditAction,
  payload?:   Record<string, unknown>,
  meta?:      AuthEventMeta,
): Promise<void> {
  if (!adminId && !meta?.actorEmail) return;
  try {
    await supabase.from('admin_audit_log').insert({
      admin_id:    adminId ?? null,
      action,
      target_type: 'auth',
      target_id:   null,
      payload:     payload ?? null,
      actor_email: meta?.actorEmail ?? null,
      ip_address:  meta?.ipAddress  ?? null,
      user_agent:  meta?.userAgent  ?? null,
      session_id:  meta?.sessionId  ?? null,
    });
  } catch {
    // Never throw — audit failure must not block the auth flow
  }
}

/** Collect browser-side user-agent for audit records. */
export function getClientMeta(): Pick<AuthEventMeta, 'userAgent'> {
  return { userAgent: navigator.userAgent.slice(0, 512) };
}
