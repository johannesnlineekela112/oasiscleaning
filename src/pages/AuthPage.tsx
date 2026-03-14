import { useState, useEffect } from "react";
import { CopyrightFooter } from "@/components/CopyrightFooter";
import { motion } from "framer-motion";
import { Lock, Mail, ArrowLeft, Loader2, User, UserPlus, Phone, Gift, ShieldAlert, Eye, EyeOff, KeyRound, CheckCircle } from "lucide-react";
import { loginUser, registerUser, getUserProfile, logout } from "@/lib/authService";
import { getBoolSetting, SETTINGS_KEYS } from "@/lib/settingsService";
import { getLegalDocument, recordTCAcceptance } from "@/lib/contentService";
import { AboutModal, TCCheckbox } from "@/components/AboutModal";
import { guardAction, recordFailure } from "@/lib/botProtection";
import { useNavigate, Link } from "react-router-dom";
import logo from "@/assets/logo-brand.png";

// Namibia cellphone validator — +264 8X XXXXXXX (9 digits after country code)
// Accepts: +264812345678, 264812345678, 0812345678, 812345678
function isValidNamibiaCell(val: string): boolean {
  const stripped = val.replace(/[\s\-().+]/g, "");
  // 264 + 9 digits (e.g. 264812345678)
  if (/^264\d{9}$/.test(stripped)) return true;
  // 0 + 9 digits (e.g. 0812345678)
  if (/^0\d{9}$/.test(stripped)) return true;
  // raw 9 digits (e.g. 812345678)
  if (/^\d{9}$/.test(stripped)) return true;
  return false;
}

const AuthPage = () => {
  const [isSignUp,     setIsSignUp]     = useState(false);
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [fullName,     setFullName]     = useState("");
  const [cellphone,    setCellphone]    = useState("+264");
  const [referralCode, setReferralCode] = useState("");
  const [referralMsg,  setReferralMsg]  = useState<{ text: string; ok: boolean } | null>(null);
  const [referralEnabled, setReferralEnabled] = useState(true);
  const [error,        setError]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [tcAccepted,   setTcAccepted]   = useState(false);
  const [tcError,      setTcError]      = useState("");
  const [showTC,       setShowTC]       = useState(false);
  // Honeypot — hidden from real users, filled by bots
  const [honeypot,     setHoneypot]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // Forgot / reset password
  const [view,         setView]         = useState<"login" | "forgot" | "reset_sent">("login");
  const [resetEmail,   setResetEmail]   = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError,   setResetError]   = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    getBoolSetting(SETTINGS_KEYS.REFERRAL_SYSTEM_ENABLED, true)
      .then(setReferralEnabled)
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setReferralMsg(null);
    setLoading(true);
    try {
      // ── Bot protection ──────────────────────────────────────────────────────
      const action = isSignUp ? "register" : "login";
      const guard  = await guardAction(action, { honeypotValue: honeypot });
      if (!guard.allowed) {
        setError(guard.reason ?? "Request blocked. Please try again later.");
        setLoading(false);
        return;
      }
      // ────────────────────────────────────────────────────────────────────────

      if (isSignUp) {
        if (!fullName.trim()) throw new Error("Full name is required.");
        if (!cellphone.trim() || cellphone === "+264") throw new Error("Cellphone number is required.");
        if (!isValidNamibiaCell(cellphone)) throw new Error("Enter a valid Namibia cellphone number, e.g. +264812345678.");
        if (!tcAccepted) {
          setTcError("You must agree to the Terms & Conditions to create an account.");
          setLoading(false);
          return;
        }
        setTcError("");

        const user = await registerUser(email, password, fullName, cellphone, referralCode.trim() || undefined);

        // Record T&C acceptance
        try {
          const tc = await getLegalDocument("terms_conditions");
          if (tc) await recordTCAcceptance(user.id, tc.version);
        } catch { /* non-critical */ }

        navigate("/dashboard");
      } else {
        const user = await loginUser(email, password);
        const profile = await getUserProfile(user.id);
        if (profile?.role === "admin") {
          navigate("/admin/dashboard");
        } else if (profile?.role === "employee") {
          navigate("/employee");
        } else {
          navigate("/dashboard");
        }
      }
    } catch (err: any) {
      await recordFailure(isSignUp ? "register" : "login", undefined, err?.message);
      setError(err?.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    if (!resetEmail.trim()) { setResetError("Please enter your email address."); return; }
    setResetLoading(true);
    try {
      const { error } = await import("@/lib/supabase").then(m =>
        m.supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
          redirectTo: window.location.origin + "/auth?reset=1",
        })
      );
      if (error) throw error;
      setView("reset_sent");
    } catch (err: any) {
      setResetError(err?.message ?? "Failed to send reset email. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 car-pattern-bg bg-navy-gradient overflow-auto">
      {showTC && <AboutModal initialTab="tc" onClose={() => setShowTC(false)} />}

      {/* Outer: full viewport height grid — card always centred regardless of content */}
      <div className="min-h-full grid grid-rows-[1fr_auto]">
        <div className="flex items-center justify-center p-4 py-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-card rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-md"
          >

        {/* ── Forgot password view ──────────────────────────────────────── */}
        {view === "forgot" && (
          <div>
            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(255,140,0,0.1)" }}>
                <KeyRound className="w-7 h-7" style={{ color: "#FF8C00" }} />
              </div>
              <h2 className="font-display text-2xl font-bold">Reset Password</h2>
              <p className="text-sm text-muted-foreground mt-1">Enter your email and we will send you a reset link.</p>
            </div>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  placeholder="Your email address"
                  required
                  className="w-full px-4 py-3 pl-11 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                />
              </div>
              {resetError && <p className="text-sm text-destructive">{resetError}</p>}
              <button
                type="submit"
                disabled={resetLoading}
                className="w-full py-3 rounded-xl font-bold text-white transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "#FF8C00" }}
              >
                {resetLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><KeyRound className="w-5 h-5" /> Send Reset Link</>}
              </button>
              <button type="button" onClick={() => setView("login")}
                className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition flex items-center justify-center gap-1">
                <ArrowLeft className="w-4 h-4" /> Back to login
              </button>
            </form>
          </div>
        )}

        {/* ── Reset email sent view ─────────────────────────────────────── */}
        {view === "reset_sent" && (
          <div className="text-center py-4">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h2 className="font-display text-xl font-bold mb-2">Check your email</h2>
            <p className="text-sm text-muted-foreground mb-6">
              We sent a password reset link to <strong>{resetEmail}</strong>.<br />
              Check your inbox and click the link to set a new password.
            </p>
            <button onClick={() => setView("login")}
              className="text-sm font-semibold text-secondary hover:text-secondary/80 transition">
              Back to login
            </button>
          </div>
        )}

        {/* ── Main login / signup view ──────────────────────────────────── */}
        {view === "login" && (
        <div className="text-center mb-8">
          <button onClick={() => window.location.reload()} className="mx-auto block group">
            <img
              src={logo}
              alt="Oasis Pure Cleaning CC"
              className="h-36 sm:h-44 w-auto max-w-[300px] object-contain mx-auto mb-3"
            />
          </button>
          <h2 className="font-display text-2xl font-bold">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isSignUp ? "Sign up to book & track your washes" : "Log in to your Oasis account"}
          </p>
          <div className="w-12 h-1 bg-secondary rounded-full mx-auto mt-3" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Honeypot — hidden from real users, bots fill it automatically */}
          <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px", opacity: 0, height: 0, overflow: "hidden", pointerEvents: "none" }}>
            <input type="text" name="company_website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={e => setHoneypot(e.target.value)} />
          </div>

          {isSignUp && (
            <>
              {/* Full Name */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  Full Name <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Your full name"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                  />
                </div>
              </div>

              {/* Cellphone — required */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  Cellphone Number <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="tel"
                    placeholder="+264812345678"
                    value={cellphone}
                    onChange={e => setCellphone(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Used for booking confirmations. Format: +264 8X XXX XXXX</p>
              </div>

              {/* Referral Code — conditional on setting */}
              {referralEnabled && (
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  Referral Code <span className="text-muted-foreground font-normal normal-case">(optional)</span>
                </label>
                <div className="relative">
                  <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="e.g. AB12CD34"
                    value={referralCode}
                    onChange={e => setReferralCode(e.target.value.toUpperCase())}
                    maxLength={10}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-background text-foreground font-mono placeholder:text-muted-foreground placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-ring transition tracking-widest"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Got a referral code? Enter it to reward the person who invited you (+25 pts to them).
                </p>
                {referralMsg && (
                  <p className={`text-xs font-semibold mt-1 ${referralMsg.ok ? "text-green-600" : "text-amber-600"}`}>
                    {referralMsg.text}
                  </p>
                )}
              </div>
              )}
            </>
          )}

          {/* Email */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Email <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
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
                required
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
              />
            </div>
          </div>

          {isSignUp && (
            <div>
              <TCCheckbox
                checked={tcAccepted}
                onChange={v => { setTcAccepted(v); if (v) setTcError(""); }}
                onViewTC={() => setShowTC(true)}
                error={tcError}
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-3.5 rounded-lg font-bold uppercase tracking-widest text-sm hover:opacity-90 transition flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isSignUp ? <UserPlus className="w-4 h-4" /> : null}
            {isSignUp ? "Create Account" : "Sign In"}
          </button>
        </form>

        <button
          onClick={() => { setIsSignUp(!isSignUp); setError(""); setReferralMsg(null); }}
          className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition text-center"
        >
          {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
        </button>

        <Link to="/" className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="w-4 h-4" /> Back to Booking
        </Link>
        )} {/* end view === login */}
      </motion.div>
      </div>{/* end centred card */}

        {/* Footer row — always at bottom of grid */}
        <div className="relative z-10">
          <CopyrightFooter />
        </div>
      </div>{/* end grid */}
    </div>
  );
};

export default AuthPage;
