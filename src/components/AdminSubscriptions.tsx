/**
 * AdminSubscriptions.tsx
 *
 * Admin panel for managing customer subscriptions.
 * Reads plans dynamically from subscription_plans table.
 * All mutations go through admin-subscription-action edge function + audit log.
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Plus, RefreshCcw, Loader2, Search, ChevronDown,
  CheckCircle2, PauseCircle, XCircle, AlertCircle, Calendar,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchSubscriptionPlans, type SubscriptionPlan } from "@/lib/subscriptionService";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "https://gzbkpwdnkhsbeygnynbh.supabase.co";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SubRecord {
  id: string;
  customer_id: string;
  plan_id: string;
  start_date: string;
  renewal_date: string;
  allowed_bookings_per_month: number;
  used_bookings_count: number;
  status: string;
  notes: string | null;
  created_at: string;
  subscription_plans?: { plan_name: string; monthly_price: number };
  users?: { full_name: string; email: string; cellphone: string };
}

interface UserSearchResult {
  id: string;
  full_name: string;
  email: string;
  cellphone: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function callSubAction(action: string, payload: Record<string, unknown>) {
  // Refresh proactively if token is missing or expiring within 60 seconds.
  let { data: { session } } = await supabase.auth.getSession();
  const isExpiredOrExpiringSoon =
    !session?.access_token ||
    (session.expires_at != null && session.expires_at * 1000 - Date.now() < 60_000);
  if (isExpiredOrExpiringSoon) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    session = refreshed.session;
  }
  if (!session?.access_token) throw new Error("Session expired. Please log out and log back in.");
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-subscription-action`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Failed (${res.status})`);
  return data;
}

const STATUS_STYLES: Record<string, string> = {
  pending_payment:          "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  pending_admin_approval:   "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  active:                   "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  paused:                   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  cancelled:                "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  expired:                  "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<string, string> = {
  pending_payment:        "Waiting for payment",
  pending_admin_approval: "Waiting for approval",
  active:                 "Active",
  paused:                 "Paused",
  cancelled:              "Cancelled",
  expired:                "Expired",
};

function UsageBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  return (
    <div className="w-full bg-muted rounded-full h-1.5">
      <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 90 ? "#ef4444" : "#FF8C00" }} />
    </div>
  );
}

// ─── Assign subscription modal ────────────────────────────────────────────────

function AssignModal({
  plans,
  onClose,
  onAssigned,
}: {
  plans: SubscriptionPlan[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [search,       setSearch]       = useState("");
  const [customers,    setCustomers]    = useState<UserSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [renewalDate,  setRenewalDate]  = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [notes,   setNotes]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const searchCustomers = useCallback(async (q: string) => {
    if (q.length < 2) { setCustomers([]); return; }
    const { data } = await supabase
      .from("users")
      .select("id, full_name, email, cellphone")
      .eq("role", "customer")
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,cellphone.ilike.%${q}%`)
      .limit(10);
    setCustomers((data || []) as UserSearchResult[]);
  }, []);

  useEffect(() => { searchCustomers(search); }, [search, searchCustomers]);

  const handleAssign = async () => {
    if (!selectedUser) { setError("Select a customer"); return; }
    if (!selectedPlan) { setError("Select a plan"); return; }
    if (!renewalDate)  { setError("Set a renewal date"); return; }
    setLoading(true);
    setError("");
    try {
      await callSubAction("assign", {
        customer_id:  selectedUser.id,
        plan_id:      selectedPlan,
        renewal_date: renewalDate,
        notes:        notes || null,
      });
      onAssigned();
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Failed to assign plan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        onClick={e => e.stopPropagation()}
        className="bg-card rounded-3xl shadow-2xl p-6 max-w-md w-full space-y-4"
      >
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Plus className="w-5 h-5 text-orange-500" /> Assign Subscription Plan
        </h3>

        {/* Customer search */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">Customer</label>
          {selectedUser ? (
            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl text-sm">
              <div>
                <p className="font-semibold">{selectedUser.full_name}</p>
                <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-xs text-muted-foreground hover:text-destructive">✕</button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, email, or phone…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
              {customers.length > 0 && (
                <div className="absolute top-full mt-1 w-full bg-card border border-border rounded-xl shadow-xl z-10 overflow-hidden">
                  {customers.map(c => (
                    <button key={c.id} type="button"
                      onClick={() => { setSelectedUser(c); setSearch(""); setCustomers([]); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-muted transition text-sm"
                    >
                      <p className="font-medium">{c.full_name}</p>
                      <p className="text-xs text-muted-foreground">{c.email} · {c.cellphone}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Plan select */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">Plan</label>
          <select
            value={selectedPlan}
            onChange={e => setSelectedPlan(e.target.value)}
            className="w-full py-2.5 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
          >
            <option value="">Select a plan…</option>
            {plans.map(p => (
              <option key={p.id} value={p.id}>
                {p.plan_name} · {p.monthly_price > 0 ? `N$ ${p.monthly_price}/mo` : "Custom"} ({p.allowed_bookings_per_month} bookings)
              </option>
            ))}
          </select>
        </div>

        {/* Renewal date */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">Renewal Date</label>
          <input
            type="date"
            value={renewalDate}
            min={new Date().toISOString().slice(0, 10)}
            onChange={e => setRenewalDate(e.target.value)}
            className="w-full py-2.5 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Paid cash, 3-month deal…"
            className="w-full py-2.5 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="button" onClick={handleAssign} disabled={loading}
            className="flex-1 py-3 rounded-2xl font-bold text-white text-sm disabled:opacity-60 transition hover:opacity-90"
            style={{ background: "#FF8C00" }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Assign Plan"}
          </button>
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-2xl font-semibold text-sm text-muted-foreground hover:text-foreground border border-border transition">
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Subscription row ─────────────────────────────────────────────────────────

function SubRow({ sub, onRefresh }: { sub: SubRecord; onRefresh: () => void }) {
  const [expanded,  setExpanded]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [reason,    setReason]    = useState("");
  const [adjustVal, setAdjustVal] = useState("");
  const [adjustField, setAdjustField] = useState<"used" | "allowed">("used");

  const doAction = async (action: string, extra: Record<string, unknown> = {}) => {
    setLoading(true);
    setError("");
    try {
      await callSubAction(action, { subscription_id: sub.id, ...extra });
      onRefresh();
    } catch (e: any) {
      setError(e.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  const customer = sub.users;
  const plan     = sub.subscription_plans;
  const remaining = Math.max(0, sub.allowed_bookings_per_month - sub.used_bookings_count);
  const isExpired = new Date(sub.renewal_date) < new Date();

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition"
      >
        <Zap className="w-4 h-4 text-orange-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{customer?.full_name ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{plan?.plan_name ?? "—"} · renews {sub.renewal_date}</p>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLES[sub.status] ?? STATUS_STYLES.expired}`}>
          {STATUS_LABELS[sub.status] ?? sub.status}
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="p-4 space-y-3 bg-muted/10">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Email:</span> <span className="font-medium text-xs">{customer?.email ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{customer?.cellphone ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Started:</span> <span className="font-medium">{sub.start_date}</span></div>
                <div><span className="text-muted-foreground">Price:</span> <span className="font-medium">{plan?.monthly_price ? `N$ ${plan.monthly_price}/mo` : "—"}</span></div>
              </div>

              {/* Usage bar */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{sub.used_bookings_count} of {sub.allowed_bookings_per_month} used</span>
                  <span className={remaining <= 0 ? "text-destructive font-semibold" : "text-foreground font-medium"}>
                    {remaining} remaining
                  </span>
                </div>
                <UsageBar used={sub.used_bookings_count} total={sub.allowed_bookings_per_month} />
              </div>

              {isExpired && (
                <p className="flex items-center gap-1 text-xs text-amber-600">
                  <AlertCircle className="w-3.5 h-3.5" /> Renewal date has passed
                </p>
              )}

              {sub.notes && <p className="text-xs text-muted-foreground italic">Note: {sub.notes}</p>}

              {/* Status actions */}
              <div className="flex flex-wrap gap-2">
                {/* Pending payment: admin confirms they received payment */}
                {sub.status === "pending_payment" && (
                  <button type="button" disabled={loading}
                    onClick={() => doAction("update", { status: "pending_admin_approval" })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white disabled:opacity-60 transition hover:bg-blue-700">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Confirm Payment Received
                  </button>
                )}
                {/* Pending approval: admin approves and activates */}
                {sub.status === "pending_admin_approval" && (
                  <button type="button" disabled={loading}
                    onClick={() => doAction("update", { status: "active" })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 text-white disabled:opacity-60 transition hover:bg-green-700">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve and Activate
                  </button>
                )}
                {/* Active: can pause */}
                {sub.status === "active" && (
                  <button type="button" disabled={loading} onClick={() => doAction("update", { status: "paused" })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-white disabled:opacity-60 transition hover:bg-amber-600">
                    <PauseCircle className="w-3.5 h-3.5" /> Pause
                  </button>
                )}
                {/* Paused or expired: can reactivate */}
                {(sub.status === "paused" || sub.status === "expired") && (
                  <button type="button" disabled={loading} onClick={() => doAction("update", { status: "active" })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 text-white disabled:opacity-60 transition hover:bg-green-700">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Reactivate
                  </button>
                )}
                {sub.status !== "cancelled" && (
                  <button type="button" disabled={loading}
                    onClick={() => { if (confirm("Are you sure you want to cancel this subscription?")) doAction("update", { status: "cancelled" }); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white disabled:opacity-60 transition hover:bg-red-700">
                    <XCircle className="w-3.5 h-3.5" /> Cancel
                  </button>
                )}
              </div>

              {/* Manual adjust */}
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">Manual adjustment…</summary>
                <div className="mt-2 space-y-2 p-3 bg-muted/30 rounded-xl">
                  <div className="flex gap-2">
                    <select value={adjustField} onChange={e => setAdjustField(e.target.value as any)}
                      className="flex-1 py-2 px-2 rounded-lg border border-border bg-background text-xs">
                      <option value="used">Used bookings count</option>
                      <option value="allowed">Allowed per month</option>
                    </select>
                    <input type="number" min="0" value={adjustVal} onChange={e => setAdjustVal(e.target.value)} placeholder="New value"
                      className="w-24 py-2 px-2 rounded-lg border border-border bg-background text-xs" />
                  </div>
                  <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (required)…"
                    className="w-full py-2 px-2 rounded-lg border border-border bg-background text-xs" />
                  <button type="button" disabled={loading || !adjustVal || !reason}
                    onClick={() => doAction("adjust", {
                      [adjustField === "used" ? "used_bookings_count" : "allowed_bookings_per_month"]: Number(adjustVal),
                      reason,
                    })}
                    className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-bold disabled:opacity-60 transition hover:bg-orange-600">
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply Adjustment"}
                  </button>
                </div>
              </details>

              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminSubscriptions() {
  const [subs,        setSubs]        = useState<SubRecord[]>([]);
  const [plans,       setPlans]       = useState<SubscriptionPlan[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [statusFilt,  setStatusFilt]  = useState("all");
  const [showAssign,  setShowAssign]  = useState(false);
  const [toast,       setToast]       = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [plansData, subsRes] = await Promise.all([
        fetchSubscriptionPlans(),
        callSubAction("list", { status: statusFilt === "all" ? undefined : statusFilt, limit: 200 }),
      ]);
      setPlans(plansData);
      setSubs(subsRes.subscriptions ?? []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [statusFilt]);

  useEffect(() => { loadData(); }, [loadData]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const filtered = subs.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.users?.full_name?.toLowerCase().includes(q) ||
      s.users?.email?.toLowerCase().includes(q) ||
      s.subscription_plans?.plan_name?.toLowerCase().includes(q)
    );
  });

  const STATUS_FILTERS = ["all", "active", "paused", "cancelled", "expired"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Zap className="w-5 h-5 text-orange-500" /> Subscription Management
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={() => { loadData(); showToast("Refreshed"); }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
            <RefreshCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowAssign(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: "#FF8C00" }}
          >
            <Plus className="w-4 h-4" /> Assign Plan
          </button>
        </div>
      </div>

      {/* Plan cards summary */}
      {plans.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {plans.map(p => (
            <div key={p.id} className="bg-card border border-border rounded-xl p-3 text-center">
              <p className="text-xs font-bold truncate">{p.plan_name}</p>
              <p className="text-lg font-display font-bold" style={{ color: "#FF8C00" }}>
                {p.monthly_price > 0 ? `N$${p.monthly_price}` : "Custom"}
              </p>
              <p className="text-xs text-muted-foreground">{p.allowed_bookings_per_month >= 999 ? "∞" : p.allowed_bookings_per_month} bookings/mo</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map(s => (
          <button key={s} onClick={() => setStatusFilt(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border capitalize transition ${
              statusFilt === s ? "border-orange-400 text-white" : "border-border text-muted-foreground hover:border-orange-200"
            }`}
            style={statusFilt === s ? { background: "#FF8C00" } : {}}>
            {s}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Search by customer or plan…" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/40" />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No subscriptions found.</p>
          <button onClick={() => setShowAssign(true)} className="mt-3 text-sm text-orange-500 hover:text-orange-600 font-semibold">
            Assign a plan →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => <SubRow key={s.id} sub={s} onRefresh={() => { loadData(); showToast("Updated"); }} />)}
        </div>
      )}

      {showAssign && (
        <AssignModal plans={plans} onClose={() => setShowAssign(false)} onAssigned={() => { loadData(); showToast("Plan assigned ✓"); }} />
      )}

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] px-5 py-3 bg-green-600 text-white rounded-2xl shadow-lg text-sm font-semibold">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
