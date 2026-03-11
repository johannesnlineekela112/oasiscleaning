/**
 * SignUpConversion.tsx
 *
 * Two variants:
 * 1. <SignUpBanner />  – Inline banner on BookingPage before submission (subtle, dismissable)
 * 2. <SignUpModal />   – Modal shown after booking confirmation (stronger CTA)
 *
 * Neither forces sign-up. Benefits list is prop-driven (not hardcoded per business).
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, UserPlus, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const DEFAULT_BENEFITS = [
  "Track all your bookings in one place",
  "Save your address for faster rebooking",
  "Access subscription plan discounts",
  "Earn loyalty points & free washes",
  "Exclusive promotions and early access",
];

interface BannerProps {
  onDismiss?: () => void;
  benefits?:  string[];
}

export function SignUpBanner({ onDismiss, benefits = DEFAULT_BENEFITS }: BannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
        className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/10 border border-orange-200 dark:border-orange-800/40 rounded-2xl p-4 relative"
      >
        {onDismiss && (
          <button
            type="button"
            onClick={() => { setDismissed(true); onDismiss(); }}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "#FF8C00" }}>
            <UserPlus className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 pr-6">
            <p className="font-bold text-sm mb-1">Create a free account</p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 mb-3">
              {benefits.slice(0, 4).map(b => (
                <li key={b} className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-3 h-3 shrink-0 text-green-500" /> {b}
                </li>
              ))}
            </ul>
            <Link
              to="/auth"
              className="inline-flex items-center gap-1 text-xs font-bold text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition"
              style={{ background: "#FF8C00" }}
            >
              Sign Up Free <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

interface ModalProps {
  fullName:  string;
  onDismiss: () => void;
  benefits?: string[];
}

export function SignUpModal({ fullName, onDismiss, benefits = DEFAULT_BENEFITS }: ModalProps) {
  const firstName = fullName.split(" ")[0] || "there";

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onDismiss}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        onClick={e => e.stopPropagation()}
        className="bg-card rounded-3xl shadow-2xl p-6 max-w-sm w-full relative"
      >
        <button type="button" onClick={onDismiss} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: "linear-gradient(135deg, #FF8C00, #ffb347)" }}>
            <UserPlus className="w-7 h-7 text-white" />
          </div>
          <h3 className="text-xl font-display font-bold">Thanks, {firstName}!</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Create a free account to unlock perks on your next visit.
          </p>
        </div>

        <ul className="space-y-2 mb-5">
          {benefits.map(b => (
            <li key={b} className="flex items-center gap-2.5 text-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-green-500" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          <Link
            to="/auth"
            className="w-full py-3 rounded-2xl text-center font-bold text-white text-sm hover:opacity-90 transition"
            style={{ background: "linear-gradient(135deg, #FF8C00, #ffb347)" }}
          >
            Create Free Account
          </Link>
          <button
            type="button"
            onClick={onDismiss}
            className="w-full py-3 rounded-2xl text-center font-semibold text-sm text-muted-foreground hover:text-foreground transition"
          >
            Maybe later
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
