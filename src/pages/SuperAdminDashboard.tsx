import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { getUserProfile, logout } from "@/lib/authService";
import {
  fetchBusinessesOverview,
  fetchCrossTenantSummary,
  fetchPlatformAudit,
  fetchSecurityOverview,
  fetchPlatformSettings,
  fetchSupportSessions,
  suspendBusiness,
  activateBusiness,
  archiveBusiness,
  createBusiness,
  updateLicense,
  updateFeatureFlags,
  startSupportSession,
  endSupportSession,
  toggleMaintenance,
  setMfaPolicy,
  assignAdmin,
  revokeAdmin,
  BusinessOverview,
  CrossTenantSummary,
  PlatformAuditEntry,
  PlatformSettings,
  SupportSession,
} from "@/lib/superAdminService";
import {
  LogOut, RefreshCw, Shield, Building2, BarChart3, Flag, Globe,
  Lock, ClipboardList, HeadphonesIcon, Zap, ChevronRight,
  CheckCircle, XCircle, AlertTriangle, Clock, Pause, Archive,
  Play, Plus, Edit2, Eye, Activity, Users, DollarSign, TrendingUp,
  Settings, Terminal, ToggleLeft, ToggleRight, Search, Filter,
  ChevronDown, AlertCircle, Loader2, Power, Ban,
} from "lucide-react";
import logo from "@/assets/logo1.png";

// ─── Types ────────────────────────────────────────────────────────────────────
type SATab =
  | "overview" | "tenants" | "licenses" | "feature_flags"
  | "domains" | "analytics" | "security" | "audit" | "support" | "platform";

const TABS: { id: SATab; label: string; icon: any; group: string }[] = [
  { id: "overview",      label: "Platform Overview",  icon: BarChart3,      group: "Platform"  },
  { id: "analytics",     label: "Global Analytics",   icon: TrendingUp,     group: "Platform"  },
  { id: "tenants",       label: "Businesses",         icon: Building2,      group: "Tenants"   },
  { id: "licenses",      label: "Licenses",           icon: Shield,         group: "Tenants"   },
  { id: "feature_flags", label: "Feature Flags",      icon: Flag,           group: "Tenants"   },
  { id: "domains",       label: "Domains",            icon: Globe,          group: "Tenants"   },
  { id: "security",      label: "Security Center",    icon: Lock,           group: "Security"  },
  { id: "audit",         label: "Audit Oversight",    icon: ClipboardList,  group: "Security"  },
  { id: "support",       label: "Support Mode",       icon: HeadphonesIcon, group: "Security"  },
  { id: "platform",      label: "Platform Settings",  icon: Settings,       group: "System"    },
];

// ─── Status badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const cfg: Record<string, { cls: string; icon: any }> = {
    active:     { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",  icon: CheckCircle  },
    suspended:  { cls: "bg-amber-500/15 text-amber-400 border-amber-500/20",        icon: Pause        },
    archived:   { cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",           icon: Archive      },
    pending:    { cls: "bg-blue-500/15 text-blue-400 border-blue-500/20",           icon: Clock        },
    approved:   { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",  icon: CheckCircle  },
    rejected:   { cls: "bg-red-500/15 text-red-400 border-red-500/20",              icon: XCircle      },
    expired:    { cls: "bg-red-500/15 text-red-400 border-red-500/20",              icon: AlertCircle  },
  };
  const c = cfg[status] ?? { cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20", icon: AlertCircle };
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${c.cls}`}>
      <Icon className="w-3 h-3" />{status}
    </span>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SuperAdminDashboard() {
  const navigate   = useNavigate();
  const [tab, setTab]                 = useState<SATab>("overview");
  const [loading, setLoading]         = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [adminName, setAdminName]     = useState("Super Admin");

  // Data states
  const [businesses, setBusinesses]       = useState<BusinessOverview[]>([]);
  const [crossSummary, setCrossSummary]   = useState<CrossTenantSummary[]>([]);
  const [auditLog, setAuditLog]           = useState<PlatformAuditEntry[]>([]);
  const [securityLog, setSecurityLog]     = useState<any[]>([]);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [supportSessions, setSupportSessions]   = useState<SupportSession[]>([]);

  // UI states
  const [searchQ, setSearchQ]           = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string; message: string; danger?: boolean;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [toast, setToast]               = useState<{ msg: string; ok: boolean } | null>(null);
  const [newBizModal, setNewBizModal]   = useState(false);
  const [newBizForm, setNewBizForm]     = useState({ business_name: "", contact_email: "", country: "NA", currency: "NAD" });

  // ── Auth check ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/admin/login"); return; }
      const profile = await getUserProfile(user.id).catch(() => null);
      if (!profile || profile.role !== "super_admin") {
        navigate("/admin");
        return;
      }
      setAdminName(profile.full_name || user.email || "Super Admin");
      setAuthChecked(true);
    })();
  }, [navigate]);

  // ── Data fetch ──────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!authChecked) return;
    setLoading(true);
    try {
      const [biz, summary, audit, sec, settings, sessions] = await Promise.allSettled([
        fetchBusinessesOverview(),
        fetchCrossTenantSummary(),
        fetchPlatformAudit({ limit: 50 }),
        fetchSecurityOverview(100),
        fetchPlatformSettings(),
        fetchSupportSessions(),
      ]);
      if (biz.status === "fulfilled")      setBusinesses(biz.value);
      if (summary.status === "fulfilled")  setCrossSummary(summary.value as CrossTenantSummary[]);
      if (audit.status === "fulfilled")    setAuditLog(audit.value);
      if (sec.status === "fulfilled")      setSecurityLog(sec.value as any[]);
      if (settings.status === "fulfilled") setPlatformSettings(settings.value);
      if (sessions.status === "fulfilled") setSupportSessions(sessions.value);
    } finally {
      setLoading(false);
    }
  }, [authChecked]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const confirm = (title: string, message: string, onConfirm: () => Promise<void>, danger = false) => {
    setConfirmModal({ title, message, onConfirm, danger });
  };

  const runAction = async (id: string, fn: () => Promise<void>) => {
    setActionLoading(id);
    try {
      await fn();
      showToast("Done.");
      await fetchAll();
    } catch (e: any) {
      showToast(e.message || "Action failed", false);
    } finally {
      setActionLoading(null);
    }
  };

  // ── Derived data ────────────────────────────────────────────────────────────
  const totalRevenue = crossSummary.reduce((s, b) => s + Number(b.revenue_30d), 0);
  const totalBookings = crossSummary.reduce((s, b) => s + b.total_bookings_30d, 0);
  const activeBiz   = businesses.filter(b => b.status === "active").length;
  const suspendedBiz = businesses.filter(b => b.status === "suspended").length;
  const filteredBiz = businesses.filter(b =>
    !searchQ || b.business_name.toLowerCase().includes(searchQ.toLowerCase())
  );

  if (!authChecked) return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ── Render helpers ───────────────────────────────────────────────────────────
  const renderOverview = () => (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Businesses",  value: businesses.length,              icon: Building2,   color: "text-violet-400",  bg: "bg-violet-500/10" },
          { label: "Active Tenants",    value: activeBiz,                       icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Suspended",         value: suspendedBiz,                    icon: Pause,       color: "text-amber-400",   bg: "bg-amber-500/10" },
          { label: "Bookings (30d)",    value: totalBookings,                   icon: Activity,    color: "text-sky-400",     bg: "bg-sky-500/10" },
          { label: "Revenue (30d)",     value: `N$${totalRevenue.toFixed(0)}`,  icon: DollarSign,  color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Active Sessions",   value: supportSessions.filter(s => s.is_active).length, icon: HeadphonesIcon, color: "text-orange-400", bg: "bg-orange-500/10" },
          { label: "Audit Events",      value: auditLog.length,                 icon: ClipboardList, color: "text-violet-400", bg: "bg-violet-500/10" },
          { label: "Security Events",   value: securityLog.length,              icon: Lock,        color: "text-red-400",     bg: "bg-red-500/10" },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${kpi.bg} flex items-center justify-center shrink-0`}>
                <kpi.icon className={`w-4.5 h-4.5 ${kpi.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-white/40 uppercase tracking-widest leading-none">{kpi.label}</p>
                <p className={`text-xl font-bold mt-0.5 ${kpi.color}`}>{kpi.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Platform status */}
      {platformSettings && (
        <div className={`rounded-xl border p-4 flex items-center gap-4 ${
          platformSettings.maintenance_mode
            ? "bg-amber-500/10 border-amber-500/30"
            : "bg-emerald-500/10 border-emerald-500/20"
        }`}>
          <Power className={`w-5 h-5 shrink-0 ${platformSettings.maintenance_mode ? "text-amber-400" : "text-emerald-400"}`} />
          <div className="flex-1">
            <p className="font-semibold text-sm text-white">
              Platform is {platformSettings.maintenance_mode ? "⚠️ in maintenance mode" : "✅ operational"}
            </p>
            {platformSettings.maintenance_message && (
              <p className="text-xs text-white/50 mt-0.5">{platformSettings.maintenance_message}</p>
            )}
          </div>
          <p className="text-xs text-white/40">MFA policy: <span className="text-white/60 font-medium">{platformSettings.mfa_enforcement_policy}</span></p>
        </div>
      )}

      {/* Recent audit */}
      <div>
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-3">Recent Platform Actions</h3>
        <div className="space-y-1">
          {auditLog.slice(0, 8).map(entry => (
            <div key={entry.id} className="flex items-center gap-3 bg-white/[0.02] hover:bg-white/[0.04] rounded-lg px-3 py-2.5 transition">
              <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                <Terminal className="w-3.5 h-3.5 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/80 font-medium truncate">{entry.action}</p>
                <p className="text-xs text-white/30">{entry.actor_email ?? entry.actor_user_id} · {entry.business_name ?? "platform"}</p>
              </div>
              <p className="text-[11px] text-white/25 shrink-0">{new Date(entry.created_at).toLocaleTimeString()}</p>
              {entry.impersonation_mode && (
                <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded font-bold">SUPPORT</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTenants = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={searchQ} onChange={e => setSearchQ(e.target.value)}
            placeholder="Search businesses…"
            className="w-full pl-9 pr-4 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
          />
        </div>
        <button
          onClick={() => setNewBizModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition"
        >
          <Plus className="w-4 h-4" /> New Business
        </button>
      </div>

      <div className="space-y-2">
        {filteredBiz.map(biz => {
          const summary = crossSummary.find(s => s.business_id === biz.id);
          return (
            <div key={biz.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-4">
                <div className="w-9 h-9 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
                  <Building2 className="w-4.5 h-4.5 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-white text-sm">{biz.business_name}</p>
                    <StatusBadge status={biz.status} />
                    <StatusBadge status={biz.license_status} />
                  </div>
                  <p className="text-xs text-white/35 mt-0.5">{biz.license_type} · {biz.admin_count} admin · {biz.employee_count} staff · {biz.customer_count} customers</p>
                </div>
                {summary && (
                  <div className="hidden sm:flex items-center gap-4 text-xs text-white/50 shrink-0">
                    <span><span className="text-emerald-400 font-semibold">N${Number(summary.revenue_30d).toFixed(0)}</span> 30d</span>
                    <span><span className="text-white/70 font-semibold">{summary.total_bookings_30d}</span> bookings</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 shrink-0">
                  {biz.status === "active" && (
                    <button
                      onClick={() => confirm(
                        `Suspend ${biz.business_name}?`,
                        "This will prevent the business from processing new bookings. Provide a reason.",
                        async () => {
                          const reason = prompt("Reason for suspension:");
                          if (!reason) return;
                          await runAction(`suspend-${biz.id}`, () => suspendBusiness(biz.id, reason));
                        },
                        true
                      )}
                      disabled={actionLoading === `suspend-${biz.id}`}
                      title="Suspend"
                      className="p-1.5 rounded-lg hover:bg-amber-500/10 text-white/30 hover:text-amber-400 transition"
                    >
                      <Pause className="w-4 h-4" />
                    </button>
                  )}
                  {biz.status === "suspended" && (
                    <button
                      onClick={() => runAction(`activate-${biz.id}`, () => activateBusiness(biz.id))}
                      disabled={actionLoading === `activate-${biz.id}`}
                      title="Reactivate"
                      className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-white/30 hover:text-emerald-400 transition"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  {biz.status !== "archived" && (
                    <button
                      onClick={() => confirm(
                        `Archive ${biz.business_name}?`,
                        "Archived businesses are read-only. This action is reversible but disruptive.",
                        async () => {
                          const reason = prompt("Reason for archiving:");
                          if (!reason) return;
                          await runAction(`archive-${biz.id}`, () => archiveBusiness(biz.id, reason));
                        },
                        true
                      )}
                      title="Archive"
                      className="p-1.5 rounded-lg hover:bg-zinc-500/10 text-white/30 hover:text-zinc-400 transition"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => runAction(`support-${biz.id}`, async () => {
                      const { session_id } = await startSupportSession(biz.id);
                      showToast(`Support session ${session_id.slice(0,8)}… started`);
                    })}
                    title="Start support session"
                    className="p-1.5 rounded-lg hover:bg-violet-500/10 text-white/30 hover:text-violet-400 transition"
                  >
                    <HeadphonesIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {biz.suspend_reason && (
                <div className="px-4 py-2 bg-amber-500/5 border-t border-amber-500/10 text-xs text-amber-300/70">
                  ⚠️ {biz.suspend_reason}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderLicenses = () => (
    <div className="space-y-3">
      <p className="text-sm text-white/40">Manage plan limits and expiry for each tenant. Changes take effect immediately.</p>
      {businesses.filter(b => b.status !== "archived").map(biz => (
        <div key={biz.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="font-semibold text-white text-sm">{biz.business_name}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <StatusBadge status={biz.license_status} />
                <span className="text-xs text-white/40">{biz.license_type}</span>
                {biz.expiry_date && <span className="text-xs text-amber-400">Expires {biz.expiry_date}</span>}
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-white/50">
              <span>Max employees: <strong className="text-white/80">{biz.max_employees}</strong></span>
              <span>Max bookings/mo: <strong className="text-white/80">{biz.max_bookings_per_month}</strong></span>
            </div>
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
            {(["starter","professional","enterprise","internal"] as const).map(plan => (
              <button
                key={plan}
                onClick={() => runAction(`license-${biz.id}-${plan}`, () => updateLicense({
                  business_id: biz.id,
                  license_type: plan,
                  max_employees:          plan === "starter" ? 5 : plan === "professional" ? 25 : 999,
                  max_bookings_per_month: plan === "starter" ? 100 : plan === "professional" ? 500 : 999999,
                  status: "active",
                  expiry_date: null,
                  notes: `Upgraded to ${plan} by super_admin`,
                }))}
                disabled={biz.license_type === plan || !!actionLoading}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  biz.license_type === plan
                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                    : "bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white border border-white/[0.06]"
                }`}
              >
                {plan}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderFeatureFlags = () => (
    <div className="space-y-3">
      <p className="text-sm text-white/40">Toggle feature modules per tenant. Changes are instant — no redeploy needed.</p>
      {businesses.filter(b => b.status !== "archived").map(biz => (
        <div key={biz.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <p className="font-semibold text-white text-sm mb-3">{biz.business_name}</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              { key: "subscriptions_enabled",    label: "Subscriptions"    },
              { key: "review_system_enabled",    label: "Review System"    },
              { key: "analytics_enabled",        label: "Analytics"        },
              { key: "mobile_payments_enabled",  label: "Mobile Payments"  },
            ] as const).map(flag => {
              const enabled = biz[flag.key as keyof BusinessOverview] as boolean;
              return (
                <button
                  key={flag.key}
                  onClick={() => runAction(`flag-${biz.id}-${flag.key}`, () =>
                    updateFeatureFlags(biz.id, { [flag.key]: !enabled })
                  )}
                  disabled={!!actionLoading}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition text-sm ${
                    enabled
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      : "bg-white/[0.02] border-white/[0.06] text-white/30"
                  }`}
                >
                  <span className={enabled ? "text-white/80" : "text-white/40"}>{flag.label}</span>
                  {enabled
                    ? <ToggleRight className="w-5 h-5 text-emerald-400 shrink-0" />
                    : <ToggleLeft  className="w-5 h-5 text-white/25 shrink-0"    />
                  }
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        {crossSummary.sort((a, b) => b.revenue_30d - a.revenue_30d).map(row => (
          <div key={row.business_id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="font-semibold text-white text-sm">{row.business_name}</p>
              <div className="flex items-center gap-5 text-xs text-white/50 flex-wrap">
                <span>Revenue: <strong className="text-emerald-400">N${Number(row.revenue_30d).toFixed(0)}</strong></span>
                <span>Bookings: <strong className="text-white/80">{row.total_bookings_30d}</strong></span>
                <span>Completed: <strong className="text-sky-400">{row.completed_30d}</strong></span>
                <span>Pending: <strong className="text-amber-400">{row.pending_30d}</strong></span>
                <span>Cancelled: <strong className="text-red-400">{row.cancelled_30d}</strong></span>
              </div>
            </div>
            {/* Revenue bar */}
            <div className="mt-2 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-emerald-500 rounded-full"
                style={{ width: `${Math.min(100, (row.revenue_30d / (totalRevenue || 1)) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAudit = () => (
    <div className="space-y-2">
      {auditLog.map(entry => (
        <div key={entry.id} className="bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3">
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
              entry.impersonation_mode ? "bg-orange-500/20" : "bg-violet-500/15"
            }`}>
              {entry.impersonation_mode
                ? <HeadphonesIcon className="w-3.5 h-3.5 text-orange-400" />
                : <Terminal className="w-3.5 h-3.5 text-violet-400" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <code className="text-xs text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded">{entry.action}</code>
                {entry.impersonation_mode && (
                  <span className="text-[10px] bg-orange-500/15 text-orange-400 px-1.5 py-0.5 rounded font-bold border border-orange-500/20">SUPPORT MODE</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-white/35 flex-wrap">
                <span>by {entry.actor_email ?? entry.actor_user_id.slice(0,8)}</span>
                {entry.business_name && <span>→ {entry.business_name}</span>}
                {entry.target_entity_type && <span>· {entry.target_entity_type}</span>}
                {entry.reason && <span>· "{entry.reason}"</span>}
              </div>
            </div>
            <p className="text-[11px] text-white/20 shrink-0">{new Date(entry.created_at).toLocaleString()}</p>
          </div>
        </div>
      ))}
      {auditLog.length === 0 && (
        <div className="text-center py-16 text-white/25">No platform audit entries yet.</div>
      )}
    </div>
  );

  const renderSecurity = () => (
    <div className="space-y-2">
      {securityLog.slice(0, 50).map((entry: any) => (
        <div key={entry.id} className="bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3 flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full shrink-0 ${entry.result === "allowed" ? "bg-emerald-400" : "bg-red-400"}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white/70"><span className="font-medium text-white/90">{entry.action}</span> · {entry.result}</p>
            <p className="text-xs text-white/30">{entry.ip ?? "unknown IP"} · {entry.business_name ?? "—"} · {entry.reason ?? ""}</p>
          </div>
          <p className="text-[11px] text-white/20 shrink-0">{new Date(entry.created_at).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );

  const renderSupport = () => (
    <div className="space-y-4">
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-300">
        <strong>Support Mode</strong> Sessions are read-only by default and fully audit-logged. Destructive actions require explicit confirmation.
      </div>
      <h3 className="text-sm font-semibold text-white/50 uppercase tracking-widest">Active Sessions</h3>
      {supportSessions.filter(s => s.is_active).length === 0 && (
        <p className="text-white/25 text-sm">No active support sessions.</p>
      )}
      {supportSessions.filter(s => s.is_active).map(s => {
        const biz = businesses.find(b => b.id === s.target_business_id);
        return (
          <div key={s.id} className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 flex items-center gap-4">
            <HeadphonesIcon className="w-5 h-5 text-orange-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">{biz?.business_name ?? s.target_business_id}</p>
              <p className="text-xs text-white/40">Started {new Date(s.started_at).toLocaleString()}</p>
            </div>
            <button
              onClick={() => runAction(`end-session-${s.id}`, () => endSupportSession(s.id))}
              className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/30 transition border border-red-500/20"
            >
              End Session
            </button>
          </div>
        );
      })}
      <h3 className="text-sm font-semibold text-white/50 uppercase tracking-widest mt-6">Recent Sessions</h3>
      {supportSessions.filter(s => !s.is_active).slice(0, 10).map(s => {
        const biz = businesses.find(b => b.id === s.target_business_id);
        return (
          <div key={s.id} className="bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3 flex items-center gap-3 text-sm">
            <span className="text-white/60">{biz?.business_name ?? "—"}</span>
            <span className="text-white/25 text-xs">{new Date(s.started_at).toLocaleString()} → {s.ended_at ? new Date(s.ended_at).toLocaleString() : "—"}</span>
            {s.end_reason && <span className="text-white/25 text-xs">· {s.end_reason}</span>}
          </div>
        );
      })}
    </div>
  );

  const renderPlatformSettings = () => (
    <div className="space-y-6">
      {platformSettings && (
        <>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
            <h3 className="font-semibold text-white mb-1">Maintenance Mode</h3>
            <p className="text-sm text-white/40 mb-4">When enabled, the platform shows a maintenance message to all users.</p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => confirm(
                  platformSettings.maintenance_mode ? "Disable maintenance mode?" : "Enable maintenance mode?",
                  "This affects all tenants on the platform.",
                  () => runAction("maintenance", () => toggleMaintenance(!platformSettings.maintenance_mode,
                    !platformSettings.maintenance_mode ? "Platform maintenance in progress. We'll be back shortly." : undefined
                  ))
                )}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition border ${
                  platformSettings.maintenance_mode
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25"
                    : "bg-white/[0.04] border-white/[0.08] text-white/60 hover:bg-white/[0.08]"
                }`}
              >
                {platformSettings.maintenance_mode ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                {platformSettings.maintenance_mode ? "ON (click to disable)" : "OFF (click to enable)"}
              </button>
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
            <h3 className="font-semibold text-white mb-1">MFA Enforcement Policy</h3>
            <p className="text-sm text-white/40 mb-4">Controls who is required to use multi-factor authentication.</p>
            <div className="flex gap-2">
              {(["none","admin_only","all_users"] as const).map(policy => (
                <button
                  key={policy}
                  onClick={() => runAction(`mfa-${policy}`, () => setMfaPolicy(policy))}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border transition ${
                    platformSettings.mfa_enforcement_policy === policy
                      ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                      : "bg-white/[0.03] border-white/[0.07] text-white/50 hover:bg-white/[0.07]"
                  }`}
                >
                  {policy.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderDomains = () => (
    <div className="space-y-3">
      <p className="text-sm text-white/40">Domain mappings and white-label configuration per tenant.</p>
      {businesses.filter(b => b.status !== "archived").map(biz => (
        <div key={biz.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <p className="font-semibold text-white text-sm">{biz.business_name}</p>
          <p className="text-xs text-white/30 mt-1">Domain management — use the Businesses panel to add domains.</p>
        </div>
      ))}
    </div>
  );

  const tabContent: Record<SATab, React.ReactNode> = {
    overview:      renderOverview(),
    tenants:       renderTenants(),
    licenses:      renderLicenses(),
    feature_flags: renderFeatureFlags(),
    domains:       renderDomains(),
    analytics:     renderAnalytics(),
    security:      renderSecurity(),
    audit:         renderAudit(),
    support:       renderSupport(),
    platform:      renderPlatformSettings(),
  };

  const groups = [...new Set(TABS.map(t => t.group))];

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-[#080b14] text-white font-sans">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="h-[52px] shrink-0 bg-[#0d1120] border-b border-white/[0.06] flex items-center justify-between px-4 sm:px-6 z-50">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Oasis" className="h-9 w-auto object-contain" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.4))" }} />
          <div>
            <p className="text-xs font-bold text-white leading-tight">Oasis Pure Cleaning CC</p>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
              <p className="text-[10px] text-violet-400/80 font-semibold tracking-widest uppercase">Super Admin</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchAll} className="p-2 rounded-lg hover:bg-white/[0.05] text-white/40 hover:text-white/80 transition">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <div className="hidden sm:flex items-center gap-2 bg-white/[0.04] border border-white/[0.07] rounded-lg px-2.5 py-1.5">
            <div className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center text-[9px] font-bold">
              {adminName.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-medium text-white/70">{adminName}</span>
          </div>
          <button
            onClick={async () => { await logout(); navigate("/admin/login"); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-xs font-semibold transition"
          >
            <LogOut className="w-3.5 h-3.5" /><span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Sidebar */}
        <aside className="w-[220px] shrink-0 h-full overflow-y-auto bg-[#0d1120] border-r border-white/[0.05] hidden lg:flex flex-col py-3">
          {groups.map(group => (
            <div key={group} className="mb-2">
              <p className="px-4 py-1.5 text-[10px] font-bold text-white/20 uppercase tracking-[0.15em]">{group}</p>
              {TABS.filter(t => t.group === group).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition rounded-none text-left ${
                    tab === t.id
                      ? "bg-violet-500/15 text-violet-300 font-semibold border-r-2 border-violet-500"
                      : "text-white/40 hover:text-white/70 hover:bg-white/[0.03]"
                  }`}
                >
                  <t.icon className="w-4 h-4 shrink-0" />
                  {t.label}
                </button>
              ))}
            </div>
          ))}
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 h-full overflow-y-auto bg-[#080b14]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
            {/* Section header */}
            <div className="mb-6">
              {(() => { const t = TABS.find(t => t.id === tab)!; return (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
                    <t.icon className="w-4.5 h-4.5 text-violet-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">{t.label}</h2>
                    <p className="text-xs text-white/30">Platform-level control · All actions are audit logged</p>
                  </div>
                </div>
              ); })()}
            </div>

            {loading && tab !== "overview" ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
              </div>
            ) : tabContent[tab]}
          </div>
        </main>
      </div>

      {/* ── Confirm modal ─────────────────────────────────────────────────── */}
      {confirmModal && (
        <div className="fixed inset-0 z-[500] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#0d1120] border border-white/[0.1] rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className={`font-bold text-lg mb-2 ${confirmModal.danger ? "text-red-400" : "text-white"}`}>
              {confirmModal.title}
            </h3>
            <p className="text-sm text-white/50 mb-6">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2 rounded-lg border border-white/[0.08] text-white/60 text-sm hover:bg-white/[0.04] transition"
              >Cancel</button>
              <button
                onClick={async () => {
                  await confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                  confirmModal.danger
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-violet-600 hover:bg-violet-700 text-white"
                }`}
              >Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* ── New business modal ─────────────────────────────────────────────── */}
      {newBizModal && (
        <div className="fixed inset-0 z-[500] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#0d1120] border border-white/[0.1] rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-bold text-lg text-white mb-4">Create New Business</h3>
            <div className="space-y-3">
              {(["business_name","contact_email","country","currency"] as const).map(field => (
                <div key={field}>
                  <label className="text-xs text-white/40 uppercase tracking-wider">{field.replace(/_/g," ")}</label>
                  <input
                    value={newBizForm[field]}
                    onChange={e => setNewBizForm(f => ({ ...f, [field]: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setNewBizModal(false)} className="flex-1 py-2 rounded-lg border border-white/[0.08] text-white/50 text-sm hover:bg-white/[0.04] transition">Cancel</button>
              <button
                onClick={async () => {
                  if (!newBizForm.business_name) return;
                  await runAction("create-biz", () => createBusiness(newBizForm));
                  setNewBizModal(false);
                  setNewBizForm({ business_name:"", contact_email:"", country:"NA", currency:"NAD" });
                }}
                className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition"
              >Create</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[600] px-4 py-3 rounded-xl shadow-xl text-sm font-semibold flex items-center gap-2 transition ${
          toast.ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
