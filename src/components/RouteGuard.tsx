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
 * MFA enforcement only applies to exclusively-admin routes (admin/dashboard,
 * /platform). Mixed routes like /dashboard that also permit customers/employees
 * do NOT require MFA — otherwise customers would be sent to the admin login.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getSessionUser, getUserProfile } from '@/lib/authService';
import { getAAL } from '@/lib/mfaService';
import { type AppRole, getRoleHomeRoute } from '@/lib/permissions';

const ADMIN_ONLY_ROLES: AppRole[] = ['admin', 'super_admin'];

interface RouteGuardProps {
  requiredRoles: AppRole[];
  loginPath?: string;
  /** When true, ALL users on this route must have aal2 (admin-only routes). */
  requireMFA?: boolean;
  children: ReactNode;
}

type GuardState = 'checking' | 'authorized' | 'redirecting';

export function RouteGuard({
  requiredRoles,
  loginPath = '/auth',
  requireMFA,
  children,
}: RouteGuardProps) {
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

      // ── MFA enforcement ────────────────────────────────────────────────────
      // Only enforce MFA on routes that are EXCLUSIVELY for admin/super_admin.
      // Mixed routes (/dashboard, /employee) must NOT require MFA — customers
      // and employees don't have TOTP enrolled.
      const isAdminOnlyRoute =
        requireMFA === true ||
        requiredRoles.every(r => ADMIN_ONLY_ROLES.includes(r as AppRole));

      if (isAdminOnlyRoute) {
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
