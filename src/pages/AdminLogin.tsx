/**
 * AdminLogin.tsx
 *
 * Admin-only login portal at /admin/login (and legacy /admin alias).
 *
 * Three-step login flow:
 *   Step 1 — Password login         (email + password)
 *   Step 2a — MFA Challenge          (TOTP code, if factor already enrolled)
 *   Step 2b — MFA Enrollment         (QR code setup, if no factor yet)
 *   Step 3 — Dashboard redirect      (aal2 confirmed)
 *
 * Security:
 *  - Non-admin users are signed out and shown an access-denied error.
 *  - Honeypot + rate-limit guard (existing botProtection layer).
 *  - All login attempts (success + failure) written to admin_audit_log.
 *  - Session login time stamped in sessionStorage for inactivity tracking.
 */

import { useState } from "react";
import { CopyrightFooter } from "@/components/CopyrightFooter";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Mail, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { loginUser, getUserProfile, logout } from "@/lib/authService";
import { guardAction, recordFailure } from "@/lib/botProtection";
import { getAAL } from "@/lib/mfaService";
import { recordAdminLoginTime } from "@/lib/adminSession";
import { auditAuthEvent, getClientMeta } from "@/lib/auditService";
import { MFAChallenge } from "@/components/auth/MFAChallenge";
import { MFAEnroll }    from "@/components/auth/MFAEnroll";
import { useNavigate, Link } from "react-router-dom";
import logo from "@/assets/logo.png";

type Step = "credentials" | "mfa_challenge" | "mfa_enroll";

const AdminLogin = () => {
  const [step,     setStep]     = useState<Step>("credentials");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [honeypot, setHoneypot] = useState("");
  // Holds the authenticated user id for audit logging across steps
  const [authedUid, setAuthedUid] = useState<string | null>(null);
  const navigate = useNavigate();

  // ── Step 1: Password authentication ──────────────────────────────────────
  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const meta = { ...getClientMeta(), actorEmail: email };

    try {
      // Bot / rate-limit guard
      const guard = await guardAction("login", { honeypotValue: honeypot });
      if (!guard.allowed) {
        setError(guard.reason ?? "Request blocked. Please try again.");
        await auditAuthEvent(null, "auth.admin_login_failed", { reason: "rate_limited" }, meta);
        return;
      }

      // Authenticate with Supabase
      const user = await loginUser(email, password);

      // Check role — only admin / super_admin may proceed here
      const profile = await getUserProfile(user.id);
      if (!profile || !["admin", "super_admin"].includes(profile.role)) {
        await recordFailure("login", user.id, "non_admin_login_attempt");
        await auditAuthEvent(user.id, "auth.admin_login_failed",
          { reason: "non_admin_role", role: profile?.role }, meta);
        // Sign out the non-admin so they don't hold a dangling session
        await logout();
        setError("Access denied. This account does not have admin privileges.");
        return;
      }

      setAuthedUid(user.id);

      // Check AAL — do we need MFA challenge or enrollment?
      const aal = await getAAL();

      if (aal.hasMFA && aal.mfaRequired) {
        // Admin has MFA enrolled → ask for TOTP code
        setStep("mfa_challenge");
        return;
      }

      if (!aal.hasMFA) {
        // Admin has NO MFA factor → must enrol now
        setStep("mfa_enroll");
        return;
      }

      // Already aal2 (rare: e.g. session refresh with existing aal2 token)
      await finishLogin(user.id);

    } catch (err: any) {
      await recordFailure("login", undefined, err?.message);
      await auditAuthEvent(null, "auth.admin_login_failed", { reason: err?.message }, meta);
      const msg = err?.message ?? "";
      if (msg.includes("Invalid login") || msg.includes("credentials"))
        setError("Wrong email or password. Please try again.");
      else if (msg.includes("Email not confirmed"))
        setError("Please verify your email before logging in.");
      else
        setError(msg || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2a: MFA challenge success ────────────────────────────────────────
  const handleMFASuccess = async () => {
    await finishLogin(authedUid!);
  };

  // ── Step 2b: MFA enrollment complete ─────────────────────────────────────
  const handleEnrolled = async (factorId: string) => {
    await auditAuthEvent(authedUid, "auth.mfa_enrolled",
      { factorId }, { ...getClientMeta(), actorEmail: email });
    await finishLogin(authedUid!);
  };

  // ── Final: record login + redirect ───────────────────────────────────────
  const finishLogin = async (uid: string) => {
    recordAdminLoginTime();
    await auditAuthEvent(uid, "auth.admin_login",
      undefined, { ...getClientMeta(), actorEmail: email });
    // Route super_admin to the platform console, admins to the regular dashboard
    const { getUserProfile } = await import("@/lib/authService");
    const profile = await getUserProfile(uid).catch(() => null);
    navigate(profile?.role === "super_admin" ? "/platform" : "/admin/dashboard");
  };

  // ── Cancel MFA → back to credentials (sign out first) ────────────────────
  const handleMFACancel = async () => {
    await logout();
    setAuthedUid(null);
    setStep("credentials");
    setError("");
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 car-pattern-bg bg-navy-gradient overflow-auto">
      <div className="min-h-full grid grid-rows-[1fr_auto]">
        <div className="flex items-center justify-center p-4 py-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-card rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-md"
          >
            {/* Logo block */}
            <div className="text-center mb-8">
              <button onClick={() => window.location.reload()} className="mx-auto block group">
                <div className="bg-[#0a1628] rounded-2xl px-6 py-4 inline-block shadow-xl border border-white/10 group-hover:shadow-orange-500/20 transition-shadow mb-3">
                  <img src={logo} alt="Oasis Pure Cleaning CC" className="h-32 w-auto object-contain drop-shadow-2xl" />
                </div>
              </button>
              <h2 className="font-display text-2xl font-bold">Admin Portal</h2>
              <p className="text-sm text-muted-foreground mt-1">Restricted access — authorised staff only</p>
              <div className="w-12 h-1 bg-secondary rounded-full mx-auto mt-3" />
            </div>

            {/* Step panels */}
            <AnimatePresence mode="wait">
              {step === "credentials" && (
                <motion.div key="credentials" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <form onSubmit={handleCredentials} className="space-y-4">
                    {/* Honeypot */}
                    <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px", opacity: 0, height: 0, overflow: "hidden", pointerEvents: "none" }}>
                      <input type="text" name="website_url" tabIndex={-1} autoComplete="off" value={honeypot} onChange={e => setHoneypot(e.target.value)} />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                        Email <span className="text-destructive">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="email"
                          placeholder="admin@oasispurecleaning.com"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          required autoComplete="email"
                          className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                        Password <span className="text-destructive">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          required autoComplete="current-password"
                          className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                        />
                      </div>
                    </div>

                    {error && (
                      <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-3">{error}</p>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-primary text-primary-foreground py-3.5 rounded-lg font-bold uppercase tracking-widest text-sm hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {loading
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
                        : <><ShieldCheck className="w-4 h-4" /> Admin Sign In</>
                      }
                    </button>
                  </form>
                </motion.div>
              )}

              {step === "mfa_challenge" && (
                <MFAChallenge
                  key="mfa_challenge"
                  email={email}
                  onSuccess={handleMFASuccess}
                  onCancel={handleMFACancel}
                />
              )}

              {step === "mfa_enroll" && (
                <MFAEnroll
                  key="mfa_enroll"
                  onEnrolled={handleEnrolled}
                  onCancel={handleMFACancel}
                />
              )}
            </AnimatePresence>

            {step === "credentials" && (
              <Link
                to="/"
                className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground hover:text-foreground transition"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Booking
              </Link>
            )}
          </motion.div>
        </div>
        <div className="relative z-10"><CopyrightFooter /></div>
      </div>
    </div>
  );
};

export default AdminLogin;
