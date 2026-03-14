/**
 * CookieBanner.tsx
 *
 * GDPR/POPIA-style cookie consent banner.
 * - First visit: shows a bottom banner asking the user to accept/decline analytics.
 * - Accept → grants GA4 analytics_storage consent + fires page_view.
 * - Decline → keeps analytics_storage denied; GA4 still loads but collects nothing.
 * - Preference stored in localStorage so the banner only appears once.
 * - "Manage" button in footer lets user revoke consent at any time.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X, Settings, CheckCircle, ShieldCheck } from "lucide-react";

const STORAGE_KEY = "oasis_cookie_consent";
const GA_ID       = "G-E4864S683S";

// ── GA4 helpers ───────────────────────────────────────────────────────────────

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

function grantConsent() {
  window.gtag?.("consent", "update", {
    analytics_storage: "granted",
    ad_storage:        "denied",   // we don't run ads
  });
  window.gtag?.("config", GA_ID, { send_page_view: true });
  window.gtag?.("event", "cookie_consent_granted");
}

function denyConsent() {
  window.gtag?.("consent", "update", {
    analytics_storage: "denied",
    ad_storage:        "denied",
  });
}

// ── Consent state ─────────────────────────────────────────────────────────────

type ConsentStatus = "pending" | "accepted" | "declined";

function getStoredConsent(): ConsentStatus {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "accepted") return "accepted";
    if (v === "declined") return "declined";
  } catch { /* SSR / private mode */ }
  return "pending";
}

function storeConsent(status: "accepted" | "declined") {
  try { localStorage.setItem(STORAGE_KEY, status); } catch { /* ignore */ }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CookieBanner({ forceShowManage = false, onClose }: { forceShowManage?: boolean; onClose?: () => void } = {}) {
  const [status,     setStatus]     = useState<ConsentStatus>("pending");
  const [showManage, setShowManage] = useState(forceShowManage);
  const [visible,    setVisible]    = useState(false);

  // On mount: read stored consent and apply it immediately
  useEffect(() => {
    const stored = getStoredConsent();
    setStatus(stored);
    if (stored === "accepted") {
      grantConsent();
    } else if (stored === "declined") {
      denyConsent();
    } else {
      // Show banner after 1.2s so the page has a moment to render
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const accept = () => {
    storeConsent("accepted");
    setStatus("accepted");
    setVisible(false);
    setShowManage(false);
    grantConsent();
  };

  const decline = () => {
    storeConsent("declined");
    setStatus("declined");
    setVisible(false);
    setShowManage(false);
    denyConsent();
  };

  const revokeConsent = () => {
    storeConsent("declined");
    setStatus("declined");
    setShowManage(false);
    denyConsent();
    // Reload so GA4 stops any in-progress collection
    window.location.reload();
  };

  return (
    <>
      {/* ── Cookie consent banner ───────────────────────────────────────── */}
      <AnimatePresence>
        {visible && status === "pending" && (
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-[900] px-3 pb-3 sm:px-6 sm:pb-5"
            role="dialog"
            aria-label="Cookie consent"
            aria-live="polite"
          >
            <div className="max-w-2xl mx-auto bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
              {/* Accent bar */}
              <div className="h-1 w-full" style={{ background: "linear-gradient(90deg,#FF8C00,#ffb347)" }} />

              <div className="p-4 sm:p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "linear-gradient(135deg,#FF8C00,#ffb347)" }}>
                    <Cookie className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold text-sm sm:text-base leading-tight">
                      We use cookies
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                      We use analytics cookies to understand how you use our site and improve your experience.
                      We never sell your data. You can change your mind at any time.{" "}
                      <button
                        onClick={() => setShowManage(true)}
                        className="underline text-foreground font-semibold hover:text-secondary transition"
                      >
                        Learn more
                      </button>
                    </p>
                  </div>
                  <button
                    onClick={decline}
                    className="p-1.5 rounded-lg hover:bg-muted transition text-muted-foreground shrink-0"
                    title="Decline and close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
                  <button
                    onClick={decline}
                    className="order-2 sm:order-1 px-5 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition"
                  >
                    Decline
                  </button>
                  <button
                    onClick={accept}
                    className="order-1 sm:order-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
                    style={{ background: "#FF8C00" }}
                  >
                    Accept All Cookies
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Manage consent modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {showManage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[950] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowManage(false); }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="h-1 w-full" style={{ background: "linear-gradient(90deg,#FF8C00,#ffb347)" }} />
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display font-bold text-lg flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-secondary" /> Cookie Preferences
                  </h2>
                  <button onClick={() => { setShowManage(false); onClose?.(); }}
                    className="p-1.5 rounded-lg hover:bg-muted transition text-muted-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Necessary cookies — always on */}
                <div className="bg-muted/50 rounded-xl p-4 mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-sm flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" /> Necessary Cookies
                    </p>
                    <span className="text-xs font-bold text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                      Always On
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Required for the site to work — login sessions, booking state, and security. Cannot be disabled.
                  </p>
                </div>

                {/* Analytics cookies — toggle */}
                <div className="bg-muted/50 rounded-xl p-4 mb-5">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-sm flex items-center gap-2">
                      <Settings className="w-4 h-4 text-blue-500" /> Analytics Cookies
                    </p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      status === "accepted"
                        ? "text-green-600 bg-green-100 dark:bg-green-900/30"
                        : "text-muted-foreground bg-muted"
                    }`}>
                      {status === "accepted" ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                    We use Google Analytics (GA4) to understand which pages are popular and how customers
                    navigate our booking flow. No personal data is sold. IP addresses are anonymised.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Provider: Google LLC · Purpose: Usage analytics · Retention: 14 months
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  {status === "accepted" ? (
                    <button
                      onClick={revokeConsent}
                      className="w-full px-5 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition"
                    >
                      Withdraw Analytics Consent
                    </button>
                  ) : (
                    <button
                      onClick={accept}
                      className="w-full px-5 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
                      style={{ background: "#FF8C00" }}
                    >
                      Accept Analytics Cookies
                    </button>
                  )}
                  <button
                    onClick={() => { setShowManage(false); onClose?.(); }}
                    className="w-full px-5 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </>
  );
}

// ── Utility: track custom events (call anywhere in the app) ───────────────────
export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  try {
    window.gtag?.("event", eventName, params);
  } catch { /* never throw */ }
}
