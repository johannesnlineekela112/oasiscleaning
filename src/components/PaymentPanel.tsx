/**
 * PaymentPanel.tsx
 *
 * Replaces the old flat 3-button payment selector.
 * Renders context-sensitive detail panels for EFT and Mobile Payment.
 * Reads bank/wallet details from business_settings via prop (passed by BookingPage
 * once fetched, so the panel itself has no async calls).
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, CheckCircle2, CreditCard, Smartphone, Banknote } from "lucide-react";
import type { PaymentDetails } from "@/lib/businessService";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaymentMethod = "cash" | "eft" | "mobile_payment";
export type PaymentSubtype = "ewallet" | "pay2cell" | null;

export interface PaymentSelection {
  method:         PaymentMethod;
  subtype:        PaymentSubtype;
  proofFile:      File | null;
  proofPreviewUrl: string | null;
}

interface Props {
  value:            PaymentSelection;
  onChange:         (v: PaymentSelection) => void;
  paymentDetails:   PaymentDetails;
  /** When true, upload controls are shown (after booking is confirmed) */
  allowProof?:      boolean;
  disabled?:        boolean;
}

// ─── Sub-panel helpers ────────────────────────────────────────────────────────

const METHODS: { id: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { id: "cash",           label: "Cash",           icon: <Banknote className="w-4 h-4" /> },
  { id: "eft",            label: "EFT",             icon: <CreditCard className="w-4 h-4" /> },
  { id: "mobile_payment", label: "Mobile Payment",  icon: <Smartphone className="w-4 h-4" /> },
];

const MOBILE_SUBTYPES: { id: "ewallet" | "pay2cell"; label: string }[] = [
  { id: "ewallet",  label: "E-Wallet" },
  { id: "pay2cell", label: "Pay2Cell" },
];

function ProofUpload({
  file,
  previewUrl,
  onFile,
  disabled,
}: {
  file:       File | null;
  previewUrl: string | null;
  onFile:     (f: File | null, url: string | null) => void;
  disabled?:  boolean;
}) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) { onFile(null, null); return; }
    const url = URL.createObjectURL(f);
    onFile(f, url);
  }

  return (
    <div className="mt-3">
      <p className="text-xs text-muted-foreground mb-2 font-medium">
        Proof of payment (optional – screenshot or photo of payment confirmation)
      </p>
      {previewUrl ? (
        <div className="relative inline-block">
          <img src={previewUrl} alt="Proof" className="h-24 rounded-lg object-cover border border-border" />
          <button
            type="button"
            disabled={disabled}
            onClick={() => onFile(null, null)}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-white flex items-center justify-center"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="mt-1 flex items-center gap-1 text-xs text-green-600">
            <CheckCircle2 className="w-3 h-3" /> {file?.name}
          </div>
        </div>
      ) : (
        <label className={`flex items-center gap-2 border-2 border-dashed border-border rounded-xl px-4 py-3 cursor-pointer hover:border-orange-300 transition text-sm text-muted-foreground ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
          <Upload className="w-4 h-4 shrink-0" />
          <span>Upload proof of payment</span>
          <input
            type="file"
            className="sr-only"
            accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
            onChange={handleChange}
            disabled={disabled}
          />
        </label>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PaymentPanel({ value, onChange, paymentDetails, allowProof = true, disabled = false }: Props) {
  const { method, subtype, proofFile, proofPreviewUrl } = value;

  function select(m: PaymentMethod) {
    onChange({
      method:          m,
      subtype:         m === "mobile_payment" ? (subtype ?? "ewallet") : null,
      proofFile:       null,
      proofPreviewUrl: null,
    });
  }

  function selectSubtype(s: "ewallet" | "pay2cell") {
    onChange({ ...value, subtype: s, proofFile: null, proofPreviewUrl: null });
  }

  function setProof(f: File | null, url: string | null) {
    onChange({ ...value, proofFile: f, proofPreviewUrl: url });
  }

  // Resolve active payment instructions
  const eft      = paymentDetails?.eft;
  const ewallet  = paymentDetails?.ewallet;
  const pay2cell = paymentDetails?.pay2cell;

  const mobileInfo = subtype === "pay2cell" ? pay2cell : ewallet;

  return (
    <div>
      {/* Method selector */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {METHODS.map(m => (
          <motion.button
            key={m.id}
            type="button"
            disabled={disabled}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => select(m.id)}
            className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-bold transition border-2 ${
              method === m.id
                ? "border-orange-400 text-white"
                : "border-border bg-background text-muted-foreground hover:border-orange-200"
            }`}
            style={method === m.id ? { background: "#FF8C00" } : {}}
          >
            {m.icon}
            {m.label}
          </motion.button>
        ))}
      </div>

      {/* Detail panels */}
      <AnimatePresence mode="wait">
        {method === "cash" && (
          <motion.div
            key="cash"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-muted/40 rounded-xl p-4 text-sm text-muted-foreground flex items-start gap-2">
              <Banknote className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>Payment will be collected upon service completion. Please have the exact amount ready.</span>
            </div>
          </motion.div>
        )}

        {method === "eft" && (
          <motion.div
            key="eft"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm space-y-2">
              <p className="font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4" /> EFT Bank Details
              </p>
              {eft ? (
                <div className="space-y-1 text-blue-700 dark:text-blue-200">
                  <div className="flex justify-between"><span className="text-muted-foreground">Bank</span><span className="font-medium">{eft.bank_name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Account name</span><span className="font-medium">{eft.account_name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Account no.</span><span className="font-mono font-bold tracking-wider">{eft.account_number}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Branch code</span><span className="font-medium">{eft.branch_code}</span></div>
                  {eft.reference_hint && (
                    <div className="pt-1 mt-1 border-t border-blue-200 dark:border-blue-800">
                      <span className="text-blue-600 dark:text-blue-300 text-xs">Reference: {eft.reference_hint}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">EFT details will be provided via WhatsApp confirmation.</p>
              )}
              {allowProof && (
                <ProofUpload file={proofFile} previewUrl={proofPreviewUrl} onFile={setProof} disabled={disabled} />
              )}
            </div>
          </motion.div>
        )}

        {method === "mobile_payment" && (
          <motion.div
            key="mobile"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 text-sm">
              {/* Sub-type selector */}
              <div className="flex gap-2 mb-3">
                {MOBILE_SUBTYPES.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => selectSubtype(s.id)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border-2 transition ${
                      subtype === s.id
                        ? "border-green-500 bg-green-500 text-white"
                        : "border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 hover:border-green-400"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <p className="font-semibold text-green-800 dark:text-green-300 mb-2 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4" /> {subtype === "pay2cell" ? "Pay2Cell" : "E-Wallet"} Details
              </p>

              {mobileInfo ? (
                <div className="space-y-1 text-green-700 dark:text-green-200">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Number</span>
                    <span className="font-bold tracking-wider">{mobileInfo.number}</span>
                  </div>
                  {mobileInfo.instructions && (
                    <p className="text-xs text-muted-foreground pt-1 border-t border-green-200 dark:border-green-800 mt-1">
                      {mobileInfo.instructions}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Payment details will be provided via WhatsApp confirmation.</p>
              )}

              {allowProof && (
                <ProofUpload file={proofFile} previewUrl={proofPreviewUrl} onFile={setProof} disabled={disabled} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
