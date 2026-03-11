/**
 * permissions.ts
 *
 * Single source of truth for all role-based access control in the application.
 *
 * Principles:
 *  - Roles and permissions are defined once, here.
 *  - No page or component should hardcode permission logic.
 *  - Backend (RLS + Edge Functions) is the authoritative enforcement layer.
 *    This file drives the frontend UX only — it does not replace server-side checks.
 *  - super_admin is scaffolded for future use; identical to admin today.
 *
 * Usage:
 *   import { can, isAdminRole, getRoleHomeRoute } from '@/lib/permissions';
 *   if (can(profile.role, 'bookings:delete')) { ... }
 */

// ─── Roles ────────────────────────────────────────────────────────────────────

export type AppRole = 'customer' | 'employee' | 'admin' | 'super_admin';

// Numeric hierarchy used by the authorize edge function and helpers below.
export const ROLE_HIERARCHY: Record<AppRole, number> = {
  customer:    1,
  employee:    2,
  admin:       3,
  super_admin: 4,
};

// ─── Permissions ──────────────────────────────────────────────────────────────

export type Permission =
  // Bookings
  | 'bookings:read_own'
  | 'bookings:read_all'
  | 'bookings:create'
  | 'bookings:update_status'
  | 'bookings:delete'
  | 'bookings:assign_employee'
  | 'bookings:mark_paid'
  // Staff / Employees
  | 'employees:read'
  | 'employees:create'
  | 'employees:delete'
  // Services
  | 'services:manage'
  // Settings
  | 'settings:manage'
  // Commission
  | 'commission:read_own'
  | 'commission:read_all'
  | 'commission:approve'
  | 'commission:mark_paid'
  | 'commission:rate_change'
  // Loyalty
  | 'loyalty:read_own'
  | 'loyalty:read_all'
  // Marketing
  | 'ads:manage'
  // Content
  | 'content:manage'
  // Security
  | 'security:read'
  // Audit
  | 'audit:read'
  // Payouts
  | 'payouts:manage'
  // Photos
  | 'photos:upload'
  | 'photos:read_assigned'
  | 'photos:read_own_completed';

// ─── Permission matrix ────────────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<AppRole, Set<Permission>> = {
  customer: new Set<Permission>([
    'bookings:read_own',
    'bookings:create',
    'loyalty:read_own',
    'photos:read_own_completed',
  ]),

  employee: new Set<Permission>([
    'bookings:read_own',      // own assigned bookings
    'bookings:update_status', // mark in-progress / completed
    'commission:read_own',
    'photos:upload',
    'photos:read_assigned',
  ]),

  admin: new Set<Permission>([
    'bookings:read_own',
    'bookings:read_all',
    'bookings:create',
    'bookings:update_status',
    'bookings:delete',
    'bookings:assign_employee',
    'bookings:mark_paid',
    'employees:read',
    'employees:create',
    'employees:delete',
    'services:manage',
    'settings:manage',
    'commission:read_own',
    'commission:read_all',
    'commission:approve',
    'commission:mark_paid',
    'commission:rate_change',
    'loyalty:read_own',
    'loyalty:read_all',
    'ads:manage',
    'content:manage',
    'security:read',
    'audit:read',
    'payouts:manage',
    'photos:upload',
    'photos:read_assigned',
    'photos:read_own_completed',
  ]),

  // super_admin: identical to admin today.
  // Add exclusive super_admin permissions here as the business grows.
  super_admin: new Set<Permission>([
    'bookings:read_own',
    'bookings:read_all',
    'bookings:create',
    'bookings:update_status',
    'bookings:delete',
    'bookings:assign_employee',
    'bookings:mark_paid',
    'employees:read',
    'employees:create',
    'employees:delete',
    'services:manage',
    'settings:manage',
    'commission:read_own',
    'commission:read_all',
    'commission:approve',
    'commission:mark_paid',
    'commission:rate_change',
    'loyalty:read_own',
    'loyalty:read_all',
    'ads:manage',
    'content:manage',
    'security:read',
    'audit:read',
    'payouts:manage',
    'photos:upload',
    'photos:read_assigned',
    'photos:read_own_completed',
  ]),
};

// ─── Core permission check ─────────────────────────────────────────────────────

/**
 * Returns true if `role` has the given `permission`.
 * Use this to gate UI elements. Server-side checks (RLS / Edge Functions) are
 * always the authoritative enforcement layer.
 */
export function can(
  role: AppRole | string | null | undefined,
  permission: Permission,
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role as AppRole]?.has(permission) ?? false;
}

/**
 * Returns true if the role meets or exceeds the minimum required role level.
 * Useful for hierarchical gates: atLeast('admin') passes for admin + super_admin.
 */
export function atLeast(
  role: AppRole | string | null | undefined,
  minRole: AppRole,
): boolean {
  if (!role) return false;
  const userLevel    = ROLE_HIERARCHY[role as AppRole]    ?? 0;
  const requiredLevel = ROLE_HIERARCHY[minRole] ?? 99;
  return userLevel >= requiredLevel;
}

// ─── Role classification helpers ─────────────────────────────────────────────

export function isAdminRole(role: AppRole | string | null | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

export function isEmployeeOrAbove(role: AppRole | string | null | undefined): boolean {
  return role === 'employee' || isAdminRole(role);
}

export function isCustomer(role: AppRole | string | null | undefined): boolean {
  return role === 'customer';
}

// ─── Route definitions ────────────────────────────────────────────────────────

/** Which roles are allowed on each protected route. */
export const ROUTE_ROLE_MAP: Record<string, AppRole[]> = {
  '/dashboard':       ['customer', 'admin', 'super_admin'],
  '/employee':        ['employee', 'admin', 'super_admin'],
  '/admin/dashboard': ['admin', 'super_admin'],
  '/platform':        ['super_admin'],
};

/**
 * Returns the home route for a given role after successful login.
 * Used to redirect users to the right dashboard.
 */
export function getRoleHomeRoute(role: AppRole | string): string {
  switch (role) {
    case 'super_admin': return '/platform';
    case 'admin':       return '/admin/dashboard';
    case 'employee':    return '/employee';
    default:            return '/dashboard';
  }
}

/**
 * Returns the login route appropriate for a role.
 * Admins have a dedicated login; everyone else uses /auth.
 */
export function getRoleLoginRoute(role?: AppRole | string | null): string {
  return isAdminRole(role) ? '/admin' : '/auth';
}
