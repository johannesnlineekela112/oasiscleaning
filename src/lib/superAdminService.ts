/**
 * superAdminService.ts
 *
 * Centralized service for all platform-level super_admin operations.
 * All mutations route through the super-admin-action edge function.
 * All reads use SECURITY DEFINER RPC functions.
 *
 * ── PERMISSION REGISTRY ──────────────────────────────────────────────────────
 * The canonical list of what super_admin can do. Use hasPermission() in UI
 * to gate controls — never scatter role checks in components.
 */

import { supabase } from './supabase';

const SUPABASE_URL = 'https://gzbkpwdnkhsbeygnynbh.supabase.co';
const ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6Ymtwd2Rua2hzYmV5Z255bmJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NTU1ODcsImV4cCI6MjA4NjIzMTU4N30.reLOBC1F2zbMgAD7Z6I6z_D9s37OhDC4b4Gfr-Ltig8';

// ─── Permission Registry ──────────────────────────────────────────────────────
export const SA_PERMISSIONS = [
  'platform:manage',
  'tenant:create',
  'tenant:update',
  'tenant:suspend',
  'tenant:assign_admin',
  'license:manage',
  'feature_flags:manage',
  'domain_mapping:manage',
  'platform_analytics:view',
  'tenant_analytics:view_all',
  'security_logs:view_all',
  'audit_logs:view_all',
  'tenant_support:read',
  'tenant_support:act_as_admin',
  'sessions:revoke',
  'mfa_policy:manage',
  'platform_maintenance:toggle',
] as const;

export type SAPermission = typeof SA_PERMISSIONS[number];

// All permissions are granted to super_admin.
// This function is the single place to check — extend here for future granular roles.
export function hasPermission(_role: string, permission: SAPermission): boolean {
  return SA_PERMISSIONS.includes(permission);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BusinessOverview {
  id: string;
  business_name: string;
  status: 'active' | 'suspended' | 'archived';
  country: string;
  currency: string;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
  updated_at: string | null;
  suspended_at: string | null;
  suspend_reason: string | null;
  archived_at: string | null;
  license_type: string;
  license_status: string;
  max_employees: number;
  max_bookings_per_month: number;
  expiry_date: string | null;
  subscriptions_enabled: boolean;
  review_system_enabled: boolean;
  analytics_enabled: boolean;
  mobile_payments_enabled: boolean;
  admin_count: number;
  employee_count: number;
  customer_count: number;
}

export interface CrossTenantSummary {
  business_id: string;
  business_name: string;
  total_bookings_30d: number;
  completed_30d: number;
  pending_30d: number;
  cancelled_30d: number;
  revenue_30d: number;
}

export interface PlatformAuditEntry {
  id: string;
  actor_user_id: string;
  actor_role: string;
  actor_email: string | null;
  target_business_id: string | null;
  business_name: string | null;
  target_entity_type: string | null;
  target_entity_id: string | null;
  action: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  reason: string | null;
  impersonation_mode: boolean;
  support_session_id: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface PlatformSettings {
  maintenance_mode: boolean;
  maintenance_message: string | null;
  maintenance_started_at: string | null;
  mfa_enforcement_policy: 'none' | 'admin_only' | 'all_users';
}

export interface SupportSession {
  id: string;
  super_admin_id: string;
  target_business_id: string;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
  actions_log: Record<string, unknown>[];
  ip_address: string | null;
  end_reason: string | null;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function getSession() {
  let { data: { session } } = await supabase.auth.getSession();
  const expiringSoon = !session?.access_token ||
    (session.expires_at != null && session.expires_at * 1000 - Date.now() < 60_000);
  if (expiringSoon) {
    const { data: r } = await supabase.auth.refreshSession();
    session = r.session;
  }
  if (!session?.access_token) throw new Error('Session expired. Please log in again.');
  return session;
}

async function callAction(action: string, payload: Record<string, unknown> = {}): Promise<any> {
  const session = await getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/super-admin-action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) {
    if (res.status === 401 || res.status === 403)
      throw new Error('Access denied. Super admin privileges required.');
    throw new Error(data.error ?? `Action failed (${res.status})`);
  }
  return data;
}

async function callRpc<T = unknown>(fn: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn as any, params);
  if (error) throw new Error(error.message);
  return data as T;
}

// ─── Platform reads ───────────────────────────────────────────────────────────

export async function fetchBusinessesOverview(): Promise<BusinessOverview[]> {
  return callRpc<BusinessOverview[]>('sa_get_businesses_overview');
}

export async function fetchCrossTenantSummary(): Promise<CrossTenantSummary[]> {
  return callRpc<CrossTenantSummary[]>('sa_get_cross_tenant_summary');
}

export async function fetchPlatformAudit(filters: {
  business_id?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<PlatformAuditEntry[]> {
  return callRpc<PlatformAuditEntry[]>('sa_get_platform_audit', {
    p_business_id: filters.business_id ?? null,
    p_action:      filters.action      ?? null,
    p_from:        filters.from        ?? null,
    p_to:          filters.to          ?? null,
    p_limit:       filters.limit       ?? 100,
    p_offset:      filters.offset      ?? 0,
  });
}

export async function fetchSecurityOverview(limit = 200) {
  return callRpc('sa_get_security_overview', { p_limit: limit });
}

export async function fetchPlatformSettings(): Promise<PlatformSettings> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('maintenance_mode, maintenance_message, maintenance_started_at, mfa_enforcement_policy')
    .limit(1)
    .single();
  if (error) throw new Error(error.message);
  return data as PlatformSettings;
}

export async function fetchSupportSessions(activeOnly = false): Promise<SupportSession[]> {
  let q = supabase
    .from('platform_support_sessions')
    .select('*')
    .order('started_at', { ascending: false });
  if (activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as SupportSession[];
}

// ─── Business mutations ───────────────────────────────────────────────────────

export const createBusiness = (p: {
  business_name: string; country?: string; currency?: string;
  contact_email?: string; contact_phone?: string;
}) => callAction('business.create', p as any);

export const updateBusiness = (business_id: string, updates: Record<string, unknown>) =>
  callAction('business.update', { business_id, updates });

export const suspendBusiness = (business_id: string, reason: string) =>
  callAction('business.suspend', { business_id, reason });

export const activateBusiness = (business_id: string, reason = 'Reactivated') =>
  callAction('business.activate', { business_id, reason });

export const archiveBusiness = (business_id: string, reason: string) =>
  callAction('business.archive', { business_id, reason });

// ─── License mutations ────────────────────────────────────────────────────────

export const updateLicense = (p: {
  business_id: string; license_type: string; max_employees: number;
  max_bookings_per_month: number; status: string; expiry_date?: string | null; notes?: string;
}) => callAction('license.update', p as any);

// ─── Feature flag mutations ───────────────────────────────────────────────────

export const updateFeatureFlags = (business_id: string, flags: Record<string, boolean>) =>
  callAction('feature_flags.update', { business_id, flags });

// ─── Domain mutations ─────────────────────────────────────────────────────────

export const upsertDomain = (business_id: string, domain: string, branding_config?: unknown) =>
  callAction('domain.upsert', { business_id, domain, branding_config });

export const approveDomain = (business_id: string, domain_id: string) =>
  callAction('domain.approve', { business_id, domain_id });

export const rejectDomain = (business_id: string, domain_id: string) =>
  callAction('domain.reject', { business_id, domain_id });

// ─── Admin assignment ─────────────────────────────────────────────────────────

export const assignAdmin = (user_id: string, business_id: string) =>
  callAction('user.assign_admin', { user_id, business_id });

export const revokeAdmin = (user_id: string) =>
  callAction('user.revoke_admin', { user_id });

// ─── Support sessions ─────────────────────────────────────────────────────────

export const startSupportSession = (business_id: string): Promise<{ session_id: string }> =>
  callAction('support_session.start', { business_id });

export const endSupportSession = (session_id: string, reason?: string) =>
  callAction('support_session.end', { session_id, reason });

// ─── Platform settings ────────────────────────────────────────────────────────

export const toggleMaintenance = (enabled: boolean, message?: string) =>
  callAction('platform.maintenance_toggle', { enabled, message });

export const setMfaPolicy = (policy: 'none' | 'admin_only' | 'all_users') =>
  callAction('platform.mfa_policy', { policy });
