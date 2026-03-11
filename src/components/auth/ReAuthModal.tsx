/**
 * ReAuthModal.tsx
 *
 * Modal that gates sensitive admin actions behind password re-verification.
 * The admin must re-enter their password before the action is allowed.
 *
 * Usage via the useReAuth() hook:
 *
 *   const { requireReAuth, ReAuthGate } = useReAuth();
 *
 *   // In JSX:
 *   <ReAuthGate />
 *
 *   // Before a sensitive action:
 *   try {
 *     await requireReAuth();
 *     await deleteBooking(id);
 *   } catch {
 *     // User cancelled or wrong password — action blocked
 *   }
 *
 * Sensitive actions that should use this:
 *  - Deleting a booking
 *  - Changing a user's role
 *  - Deleting a staff member
 *  - Recording / approving commissions
 */

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Loader2, ShieldAlert, X, ShieldCheck } from "lucide-react";
import { verifyAdminPassword } from "@/lib/adminSession";
import { getSessionUser } from "@/lib/authService";
import { auditAuthEvent, getClientMeta } from "@/lib/auditService";

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns { requireReAuth, ReAuthGate }.
 *
 * Mount <ReAuthGate /> somewhere in your component tree (e.g. at the root of
 * AdminDashboard). Then call await requireReAuth() before sensitive actions.
 */
export function useReAuth() {
  const [visible,   setVisible]   = useState(false);
  const [error,     setError]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [password,  setPassword]  = useState("");
  // Resolver stored in a ref so the modal can resolve/reject the outer Promise
  const resolverRef = useRef<{ resolve: () => void; reject: (e: Error) => void } | null>(null);

  const requireReAuth = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      resolverRef.current = { resolve, reject };
      setError(""); setPassword(""); setVisible(true);
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!password) { setError("Please enter your password."); return; }
    setLoading(true); setError("");
    try {
      const user = await getSessionUser();
      if (!user?.email) throw new Error("Session lost — please log in again.");
      await verifyAdminPassword(user.email, password);
      // Audit re-auth success
      auditAuthEvent(user.id, 'auth.reauth_success', undefined, getClientMeta());
      setVisible(false);
      resolverRef.current?.resolve();
    } catch (err: any) {
      const user = await getSessionUser().catch(() => null);
      auditAuthEvent(user?.id, 'auth.reauth_failed', { reason: err?.message }, getClientMeta());
      setError("Incorrect password. Please try again.");
      setPassword("");
    } finally {
      setLoading(false);
    }
  }, [password]);

  const handleCancel = useCallback(() => {
    setVisible(false);
    resolverRef.current?.reject(new Error("Re-authentication cancelled."));
  }, []);

  const ReAuthGate = useCallback(() => (
    <AnimatePresence>
      {visible && (
        <ReAuthModal
          error={error}
          loading={loading}
          password={password}
          onPasswordChange={setPassword}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          onErrorClear={() => setError("")}
        />
      )}
    </AnimatePresence>
  ), [visible, error, loading, password, handleConfirm, handleCancel]);

  return { requireReAuth, ReAuthGate };
}

// ─── Modal UI ─────────────────────────────────────────────────────────────────

interface ModalProps {
  error:            string;
  loading:          boolean;
  password:         string;
  onPasswordChange: (v: string) => void;
  onConfirm:        () => void;
  onCancel:         () => void;
  onErrorClear:     () => void;
}

function ReAuthModal({ error, loading, password, onPasswordChange, onConfirm, onCancel, onErrorClear }: ModalProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onConfirm();
    if (e.key === "Escape") onCancel();
  };

  return (
    <motion.div
      key="reauth-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <motion.div
        key="reauth-card"
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="bg-card rounded-2xl shadow-2xl p-6 w-full max-w-sm"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">Confirm Identity</h3>
              <p className="text-xs text-muted-foreground">Re-enter your password to continue</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          This action requires you to verify your identity for security purposes.
        </p>

        {/* Password input */}
        <div className="relative mb-3">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="password"
            placeholder="Your admin password"
            value={password}
            onChange={e => { onPasswordChange(e.target.value); onErrorClear(); }}
            onKeyDown={handleKeyDown}
            autoFocus
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition text-sm"
          />
        </div>

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-2.5 mb-3">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || !password}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {loading
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying…</>
              : <><ShieldCheck className="w-3.5 h-3.5" /> Confirm</>
            }
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
