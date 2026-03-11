/**
 * useInactivityLogout.ts
 *
 * React hook that wires up two session guards for admin pages:
 *
 *  1. Inactivity timer  — signs out after 15 min of no mouse/keyboard/scroll
 *  2. Session age guard — signs out if the session is older than 4 hours
 *     even if the user has been continuously active
 *
 * Mount once at the top of AdminDashboard:
 *
 *   function AdminDashboard() {
 *     useInactivityLogout();
 *     ...
 *   }
 *
 * Shows a 60-second countdown toast before logging out so the admin can
 * click "Stay logged in" to reset the timer.
 */

import { useEffect, useRef, useState } from "react";
import {
  setupInactivityLogout,
  setupSessionAgeGuard,
  forceAdminLogout,
  ADMIN_IDLE_TIMEOUT_MS,
} from "@/lib/adminSession";
import { auditAuthEvent, getClientMeta } from "@/lib/auditService";
import { getSessionUser } from "@/lib/authService";

// Warn the admin 60 s before auto-logout
const WARN_BEFORE_MS = 60_000;

export function useInactivityLogout() {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown,   setCountdown]   = useState(60);
  const warningTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInt  = useRef<ReturnType<typeof setInterval> | null>(null);
  const logoutPending = useRef(false);

  // Dismiss the warning and reset the idle clock
  const stayLoggedIn = () => {
    setShowWarning(false);
    setCountdown(60);
    logoutPending.current = false;
    if (countdownInt.current) clearInterval(countdownInt.current);
    // The inactivity listener will reset itself on the next user interaction
  };

  const doLogout = async (reason: 'inactivity' | 'session_expired') => {
    if (logoutPending.current) return; // guard against double-fire
    logoutPending.current = true;
    const user = await getSessionUser().catch(() => null);
    auditAuthEvent(user?.id, 'auth.session_expired', { reason }, getClientMeta());
    await forceAdminLogout(reason);
  };

  useEffect(() => {
    // Build a callback that shows the warning first, then logs out
    const onIdle = () => {
      if (logoutPending.current) return;
      setShowWarning(true);
      setCountdown(WARN_BEFORE_MS / 1000);

      countdownInt.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (countdownInt.current) clearInterval(countdownInt.current);
            doLogout('inactivity');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    // Inactivity guard — fires WARN_BEFORE_MS before the real timeout
    const cleanupIdle = setupInactivityLogout(
      onIdle,
      ADMIN_IDLE_TIMEOUT_MS - WARN_BEFORE_MS,
    );

    // Session age guard
    const cleanupAge = setupSessionAgeGuard(() => doLogout('session_expired'));

    return () => {
      cleanupIdle();
      cleanupAge();
      if (warningTimer.current)  clearTimeout(warningTimer.current);
      if (countdownInt.current)  clearInterval(countdownInt.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { showWarning, countdown, stayLoggedIn };
}

// ─── Inactivity warning banner ────────────────────────────────────────────────

/**
 * Drop this anywhere in AdminDashboard to render the countdown warning.
 *
 *   const { showWarning, countdown, stayLoggedIn } = useInactivityLogout();
 *   return (
 *     <>
 *       <InactivityWarning show={showWarning} countdown={countdown} onStay={stayLoggedIn} />
 *       { ... rest of dashboard ... }
 *     </>
 *   );
 */
export function InactivityWarning({
  show, countdown, onStay,
}: { show: boolean; countdown: number; onStay: () => void }) {
  if (!show) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm">
      <div className="bg-amber-600 text-white rounded-xl shadow-2xl px-4 py-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium">
          Logging out due to inactivity in <strong>{countdown}s</strong>
        </p>
        <button
          onClick={onStay}
          className="bg-white text-amber-700 px-3 py-1 rounded-lg text-xs font-bold hover:bg-amber-50 transition flex-shrink-0"
        >
          Stay logged in
        </button>
      </div>
    </div>
  );
}
