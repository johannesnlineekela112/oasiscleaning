/**
 * AdminPaymentVerification.tsx
 *
 * Admin panel for reviewing and approving/rejecting payment proof submissions.
 * All actions are routed through the admin-payment-action edge function
 * and written to admin_audit_log.
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard, Smartphone, Banknote, Search, CheckCircle2,
  XCircle, Eye, RefreshCcw, Loader2, ChevronDown, ExternalLink,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Booking } from "@/lib/bookingService";

// ─── Constants ────────────────────────────────────────────────────────────────

const SUPABASE_URL = "https://gzbkpwdnkhsbeygnynbh.supabase.co";

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  unpaid:                { label: "Unpaid",       color: "text-red-600",    bg: "bg-red-100 dark:bg-red-900/30" },
  pending_verification:  { label: "Pending",      color: "text-amber-600",  bg: "bg-amber-100 dark:bg-amber-900/30" },
  paid:                  { label: "Paid",          color: "text-green-600",  bg: "bg-green-100 dark:bg-green-900/30" },
  cash_on_completion:    { label: "Cash on Day",   color: "text-blue-600",   bg: "bg-blue-100 dark:bg-blue-900/30" },
  subscription_covered:  { label: "Subscription",  color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-900/30" },
};

const METHOD_ICONS: Record<string, React.ReactNode> = {
  cash:         <Banknote  className="w-4 h-4 text-amber-500"  />,
  eft:          <CreditCard className="w-4 h-4 text-blue-500"  />,
  mobile:       <Smartphone className="w-4 h-4 text-green-500" />,
  subscription: <CheckCircle2 className="w-4 h-4 text-purple-500" />,
  free_wash:    <CheckCircle2 className="w-4 h-4 text-orange-500" />,
};

type PaymentFilter = "all" | "unpaid" | "pending_verification" | "paid";

interface BookingRow extends Booking {
  // Extra fields from join
  _customer_name?: string;
  _customer_phone?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? { label: status, color: "text-muted-foreground", bg: "bg-muted" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${s.bg} ${s.color}`}>
      {s.label}
    </span>
  );
}

async function callPaymentAction(
  action: string,
  bookingId: string,
  note = "",
  status?: string,
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-payment-action`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, booking_id: bookingId, note, status }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Action failed (${res.status})`);
}

// ─── Proof preview modal ──────────────────────────────────────────────────────

function ProofModal({ url, onClose }: { url: string; onClose: () => void }) {
  const isPDF = url.toLowerCase().includes(".pdf") || url.includes("pdf");
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9 }} animate={{ scale: 1 }}
        onClick={e => e.stopPropagation()}
        className="bg-card rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden relative"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <p className="font-semibold text-sm">Proof of Payment</p>
          <div className="flex items-center gap-2">
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ExternalLink className="w-3.5 h-3.5" /> Open
            </a>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground ml-2">✕</button>
          </div>
        </div>
        <div className="p-4">
          {isPDF ? (
            <iframe src={url} className="w-full h-96 rounded-lg" title="Proof of payment" />
          ) : (
            <img src={url} alt="Proof of payment" className="w-full max-h-96 object-contain rounded-lg" />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function PaymentRow({
  booking,
  onAction,
}: {
  booking: BookingRow;
  onAction: (id: string, action: string, note?: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const doAction = async (action: string) => {
    setLoading(true);
    setError("");
    try {
      await onAction(booking.id!, action, note);
    } catch (e: any) {
      setError(e.message ?? "Action failed");
    } finally {
      setLoading(false);
    }
  };

  const status = booking.payment_status ?? "unpaid";
  const method = booking.payment_method ?? "cash";
  const hasProof = !!booking.proof_of_payment_url;

  // Extract customer name/whatsapp from address_text
  const parts = (booking.address_text ?? "").split(" | ");
  const customerName = parts[0] || booking._customer_name || "—";
  const whatsapp     = parts[1] || booking._customer_phone || "—";

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Summary row */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition"
      >
        <div className="shrink-0">{METHOD_ICONS[method] ?? <Banknote className="w-4 h-4 text-muted-foreground" />}</div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{customerName}</p>
          <p className="text-xs text-muted-foreground">
            {booking.booking_date} · {booking.time_slot}
            {method === "mobile" && booking.payment_subtype && ` · ${booking.payment_subtype}`}
          </p>
        </div>
        <StatusBadge status={status} />
        {hasProof && (
          <span className="text-xs text-green-600 font-semibold shrink-0 ml-1">Proof ✓</span>
        )}
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {/* Detail panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="p-4 space-y-3 bg-muted/10">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{customerName}</span></div>
                <div><span className="text-muted-foreground">WhatsApp:</span> <span className="font-medium">{whatsapp}</span></div>
                <div><span className="text-muted-foreground">Method:</span> <span className="font-medium capitalize">{method} {booking.payment_subtype ? `(${booking.payment_subtype})` : ""}</span></div>
                <div><span className="text-muted-foreground">Amount:</span> <span className="font-medium">N$ {booking.price ?? 0}</span></div>
              </div>

              {/* Proof preview */}
              {hasProof && (
                <button
                  type="button"
                  onClick={() => setPreviewUrl(booking.proof_of_payment_url!)}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Eye className="w-4 h-4" /> View Proof of Payment
                </button>
              )}
              {!hasProof && (method === "eft" || method === "mobile") && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> No proof uploaded
                </p>
              )}

              {/* Note field */}
              <input
                type="text"
                placeholder="Add a note (optional)…"
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full text-xs bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-orange-400"
              />

              {error && <p className="text-xs text-destructive">{error}</p>}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                {status !== "paid" && (
                  <button
                    type="button" disabled={loading}
                    onClick={() => doAction("approve")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 hover:bg-green-700 text-white disabled:opacity-60 transition"
                  >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Approve / Mark Paid
                  </button>
                )}
                {status !== "unpaid" && status !== "cash_on_completion" && (
                  <button
                    type="button" disabled={loading}
                    onClick={() => doAction("reject")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white disabled:opacity-60 transition"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject / Mark Unpaid
                  </button>
                )}
                {status !== "pending_verification" && status !== "cash_on_completion" && (
                  <button
                    type="button" disabled={loading}
                    onClick={() => doAction("reset")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-60 transition"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" /> Reset to Pending
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {previewUrl && <ProofModal url={previewUrl} onClose={() => setPreviewUrl(null)} />}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminPaymentVerification() {
  const [filter,    setFilter]    = useState<PaymentFilter>("pending_verification");
  const [bookings,  setBookings]  = useState<BookingRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [toast,     setToast]     = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("bookings")
        .select("*")
        .in("payment_method", ["eft", "mobile", "cash"])
        .order("created_at", { ascending: false })
        .limit(200);

      if (filter !== "all") q = q.eq("payment_status", filter);

      const { data, error } = await q;
      if (error) throw error;
      setBookings((data || []) as BookingRow[]);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (bookingId: string, action: string, note = "") => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Not authenticated");

    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-payment-action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action, booking_id: bookingId, note }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Action failed");

    setToast(`Payment ${action === "approve" ? "approved ✓" : action === "reject" ? "rejected" : "updated"}`);
    setTimeout(() => setToast(""), 3000);
    await load();
  };

  const filtered = bookings.filter(b => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.address_text?.toLowerCase().includes(q) ||
      b.booking_date?.includes(q) ||
      b.id?.includes(q)
    );
  });

  const FILTERS: { key: PaymentFilter; label: string }[] = [
    { key: "pending_verification", label: "Pending Verification" },
    { key: "unpaid",               label: "Unpaid" },
    { key: "paid",                 label: "Paid" },
    { key: "all",                  label: "All" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-orange-500" /> Payment Verification
        </h2>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
          <RefreshCcw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
              filter === f.key
                ? "border-orange-400 text-white"
                : "border-border text-muted-foreground hover:border-orange-200"
            }`}
            style={filter === f.key ? { background: "#FF8C00" } : {}}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name, date, or booking ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/40"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No {filter === "all" ? "" : filter.replace("_", " ")} payments found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(b => (
            <PaymentRow key={b.id} booking={b} onAction={handleAction} />
          ))}
          {filtered.length >= 200 && (
            <p className="text-xs text-center text-muted-foreground">Showing up to 200 records.</p>
          )}
        </div>
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] px-5 py-3 bg-green-600 text-white rounded-2xl shadow-lg text-sm font-semibold"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
