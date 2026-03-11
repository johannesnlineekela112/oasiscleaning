/**
 * MFAChallenge.tsx
 *
 * Shown after a successful password login when the admin has MFA enrolled
 * but hasn't verified their TOTP code yet (aal1 → need aal2).
 *
 * Props:
 *  onSuccess  — called after TOTP code is verified (session is now aal2)
 *  onCancel   — called if the user wants to go back / abort
 *  email      — shown in the subtitle for confirmation
 */

import { useState, useRef, useEffect } from "react";
import { Loader2, ShieldCheck, ArrowLeft, KeyRound } from "lucide-react";
import { motion } from "framer-motion";
import { challengeAndVerifyTOTP } from "@/lib/mfaService";

interface Props {
  onSuccess: () => void;
  onCancel:  () => void;
  email?:    string;
}

export function MFAChallenge({ onSuccess, onCancel, email }: Props) {
  const [code,    setCode]    = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) { setError("Please enter the 6-digit code."); return; }
    setError(""); setLoading(true);
    try {
      await challengeAndVerifyTOTP(code);
      onSuccess();
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("incorrect"))
        setError("Incorrect code. Please check your authenticator app and try again.");
      else if (msg.toLowerCase().includes("expired"))
        setError("Code expired. Please generate a new code from your app.");
      else
        setError(msg || "Verification failed. Please try again.");
      setCode("");
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit when 6 digits are entered
  const handleChange = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    setError("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <KeyRound className="w-7 h-7 text-primary" />
        </div>
        <h3 className="font-bold text-lg text-foreground">Two-Factor Authentication</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {email ? `Signed in as ${email}` : "Enter the code from your authenticator app"}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
            Authenticator Code
          </label>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            value={code}
            onChange={e => handleChange(e.target.value)}
            maxLength={6}
            className="w-full text-center text-2xl font-mono tracking-[0.4em] px-4 py-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
          />
          <p className="text-xs text-muted-foreground mt-1.5 text-center">
            Open your authenticator app (Google Authenticator, Authy, etc.) and enter the 6-digit code.
          </p>
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full bg-primary text-primary-foreground py-3.5 rounded-lg font-bold uppercase tracking-widest text-sm hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
            : <><ShieldCheck className="w-4 h-4" /> Verify & Continue</>
          }
        </button>
      </form>

      <button
        onClick={onCancel}
        className="flex items-center justify-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to login
      </button>
    </motion.div>
  );
}
