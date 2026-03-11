/**
 * RouteGuard.tsx
 *
 * Reusable authentication + role guard for protected routes.
 *
 * Wraps a page component in App.tsx to:
 *  1. Check session (via Supabase Auth)
 *  2. Load user profile and verify the role
 *  3. Show a loading spinner while checking
 *  4. Redirect unauthorized users to the correct destination
 *
 * Usage in App.tsx:
 *   <Route path="/admin/dashboard" element={
 *     <RouteGuard requiredRoles={['admin', 'super_admin']} loginPath="/admin">
 *       <AdminDashboard />
 *     </RouteGuard>
 *   } />
 *
 * The page-level auth checks in AdminDashboard, EmployeeDashboard, and
 * UserDashboard still exist as a defence-in-depth fallback. The RouteGuard
 * provides a unified loading state and prevents the page from mounting at all
 * if the session is invalid.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getSessionUser, getUserProfile } from '@/lib/authService';
import { getAAL } from '@/lib/mfaService';
import { type AppRole, getRoleHomeRoute } from '@/lib/permissions';

const ADMIN_ROLES: AppRole[] = ['admin', 'super_admin'];

interface RouteGuardProps {
  /** Roles that are permitted on this route. */
  requiredRoles: AppRole[];
  /**
   * Where to send unauthenticated users (no session).
   * Defaults to '/auth'.
   */
  loginPath?: string;
  children: ReactNode;
}

type GuardState = 'checking' | 'authorized' | 'redirecting';

export function RouteGuard({ requiredRoles, loginPath = '/auth', children }: RouteGuardProps) {
  const [state, setState] = useState<GuardState>('checking');
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const user = await getSessionUser();

      if (!user) {
        if (!cancelled) {
          setState('redirecting');
          navigate(loginPath, { replace: true });
        }
        return;
      }

      const profile = await getUserProfile(user.id).catch(() => null);
      const role = profile?.role as AppRole | undefined;

      if (!role || !requiredRoles.includes(role)) {
        if (!cancelled) {
          setState('redirecting');
          navigate(role ? getRoleHomeRoute(role) : loginPath, { replace: true });
        }
        return;
      }

      // ── MFA enforcement for admin routes ────────────────────────────────
      // Admin and super_admin users MUST have aal2 to access protected routes.
      // If they somehow arrive here with only aal1 (e.g. direct URL navigation,
      // stale tab, or expired MFA session), redirect them back to the admin
      // login page to complete the MFA challenge.
      const isAdminRoute = requiredRoles.some(r => ADMIN_ROLES.includes(r));
      if (isAdminRoute) {
        const aal = await getAAL().catch(() => null);
        if (!aal || aal.currentLevel !== 'aal2') {
          if (!cancelled) {
            setState('redirecting');
            navigate('/admin/login', { replace: true });
          }
          return;
        }
      }

      if (!cancelled) setState('authorized');
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-9 h-9 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium">Verifying session…</p>
        </div>
      </div>
    );
  }

  if (state === 'redirecting') return null;

  return <>{children}</>;
}
