/**
 * MFAEnroll.tsx
 *
 * Shown when an admin has logged in successfully (aal1) but has NOT yet
 * enrolled a TOTP factor. We require enrollment before allowing access to
 * the dashboard. The admin cannot skip this step.
 *
 * Props:
 *  onEnrolled  — called after successful TOTP enrollment + verification
 *  onCancel    — called if the admin wants to abort (will force logout)
 */

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Loader2, ShieldCheck, Copy, Check, KeyRound, AlertTriangle } from "lucide-react";
import { enrollTOTP, verifyTOTPEnroll } from "@/lib/mfaService";

interface Props {
  onEnrolled: (factorId: string) => void;
  onCancel:   () => void;
}

export function MFAEnroll({ onEnrolled, onCancel }: Props) {
  const [factorId,  setFactorId]  = useState("");
  const [qrCode,    setQrCode]    = useState("");
  const [secret,    setSecret]    = useState("");
  const [code,      setCode]      = useState("");
  const [error,     setError]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [enrolling, setEnrolling] = useState(true);
  const [copied,    setCopied]    = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Start enrollment on mount
  useEffect(() => {
    (async () => {
      try {
        const result = await enrollTOTP("Oasis Admin Portal");
        setFactorId(result.factorId);
        setQrCode(result.qrCode);
        setSecret(result.secret);
        setEnrolling(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      } catch (err: any) {
        setError(err?.message ?? "Failed to start MFA enrollment. Please refresh.");
        setEnrolling(false);
      }
    })();
  }, []);

  const copySecret = () => {
    navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) { setError("Please enter the 6-digit code."); return; }
    setError(""); setLoading(true);
    try {
      await verifyTOTPEnroll(factorId, code);
      onEnrolled(factorId);
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("incorrect"))
        setError("Incorrect code — make sure you scanned the QR code correctly, then try again.");
      else
        setError(msg || "Verification failed. Please try again.");
      setCode("");
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  if (enrolling) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Setting up MFA…</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* Header */}
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <KeyRound className="w-7 h-7 text-primary" />
        </div>
        <h3 className="font-bold text-lg text-foreground">Set Up Two-Factor Authentication</h3>
        <p className="text-sm text-muted-foreground mt-1">
          MFA is required for all admin accounts. Scan the QR code to get started.
        </p>
      </div>

      {/* Mandatory notice */}
      <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>MFA is mandatory for admin access. You cannot access the dashboard until this step is complete.</span>
      </div>

      {/* Step 1: QR code */}
      <div className="bg-muted/40 rounded-xl p-4">
        <p className="text-xs font-semibold text-foreground mb-3">
          Step 1 — Scan with your authenticator app
        </p>
        {qrCode ? (
          <div className="flex justify-center">
            <div className="bg-white p-3 rounded-xl shadow-sm">
              <img src={qrCode} alt="TOTP QR code" className="w-44 h-44 block" />
            </div>
          </div>
        ) : (
          <div className="flex justify-center items-center h-44 text-muted-foreground text-sm">
            QR code unavailable
          </div>
        )}
        <p className="text-xs text-muted-foreground text-center mt-2">
          Use Google Authenticator, Authy, 1Password, or any TOTP app.
        </p>
      </div>

      {/* Manual secret */}
      {secret && (
        <div>
          <p className="text-xs font-semibold text-foreground mb-1">
            Can't scan? Enter the secret manually:
          </p>
          <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2">
            <code className="text-xs font-mono text-foreground flex-1 break-all">{secret}</code>
            <button onClick={copySecret} className="flex-shrink-0 text-muted-foreground hover:text-foreground transition">
              {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Verify */}
      <form onSubmit={handleVerify} className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-foreground mb-1.5">
            Step 2 — Enter the 6-digit code from your app
          </p>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            value={code}
            onChange={e => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
            maxLength={6}
            className="w-full text-center text-2xl font-mono tracking-[0.4em] px-4 py-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
          />
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
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Activating MFA…</>
            : <><ShieldCheck className="w-4 h-4" /> Activate MFA & Continue</>
          }
        </button>
      </form>

      <button
        onClick={onCancel}
        className="text-xs text-muted-foreground hover:text-foreground transition w-full text-center"
      >
        Cancel & sign out
      </button>
    </motion.div>
  );
}
