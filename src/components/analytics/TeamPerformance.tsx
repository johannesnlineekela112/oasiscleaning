/**
 * TeamPerformance.tsx
 *
 * "Team Performance" analytics tab.
 * Sortable table, performance badges, top performer highlight,
 * underperformer alert.
 */

import { useState, useEffect, useMemo } from "react";
import { Loader2, Trophy, AlertTriangle, TrendingUp, DollarSign,
         CheckCircle, Clock, ChevronUp, ChevronDown, RefreshCw } from "lucide-react";
import { DonutGauge } from "./MiniChart";
import { fetchEmployeePerformance, type EmployeePerf } from "@/lib/analyticsService";

type SortKey = "jobs_completed" | "completion_rate" | "total_commission_earned" | "total_revenue_generated" | "jobs_assigned";

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${color}`}>{label}</span>
  );
}

function perfBadges(emp: EmployeePerf, isTop: boolean, isUnder: boolean) {
  const badges: { label: string; color: string }[] = [];
  if (isTop) badges.push({ label: "⭐ Top Performer", color: "bg-amber-100 text-amber-700" });
  if (isUnder) badges.push({ label: "⚠ Needs Review", color: "bg-destructive/10 text-destructive" });
  if (emp.completion_rate >= 90) badges.push({ label: "✓ High Completion", color: "bg-success/10 text-success" });
  if (emp.jobs_completed >= 10)  badges.push({ label: "Veteran", color: "bg-primary/10 text-primary" });
  return badges;
}

export function TeamPerformance() {
  const [data,    setData]    = useState<EmployeePerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("jobs_completed");
  const [sortAsc, setSortAsc] = useState(false);

  const load = async () => {
    setLoading(true); setError(null);
    try { setData(await fetchEmployeePerformance()); }
    catch (e: any) { setError(e?.message ?? "Failed to load"); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const va = a[sortKey] as number;
      const vb = b[sortKey] as number;
      return sortAsc ? va - vb : vb - va;
    });
  }, [data, sortKey, sortAsc]);

  const topId   = data.reduce((best, e) => e.jobs_completed > (best?.jobs_completed ?? -1) ? e : best, data[0])?.employee_id;
  const underId = data.filter(e => e.jobs_assigned > 0 && e.completion_rate < 50).map(e => e.employee_id);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => sortKey === k
    ? (sortAsc ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />)
    : null;

  const TH = ({ k, label }: { k: SortKey; label: string }) => (
    <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none transition"
        onClick={() => handleSort(k)}>
      {label}<SortIcon k={k} />
    </th>
  );

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (error)   return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <AlertTriangle className="w-8 h-8 text-destructive/60" />
      <p className="text-sm text-muted-foreground">{error}</p>
      <button onClick={load} className="text-xs text-primary hover:underline">Retry</button>
    </div>
  );

  if (!data.length) return (
    <div className="py-16 text-center text-muted-foreground text-sm">
      No employee data yet. Employees will appear here once bookings are assigned.
    </div>
  );

  // Summary cards
  const totalJobs     = data.reduce((s, e) => s + e.jobs_completed, 0);
  const totalRevenue  = data.reduce((s, e) => s + e.total_revenue_generated, 0);
  const avgCompletion = data.length > 0 ? data.reduce((s, e) => s + e.completion_rate, 0) / data.length : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-bold text-sm text-foreground">Team Performance</h3>
          <p className="text-xs text-muted-foreground">{data.length} team member{data.length !== 1 ? "s" : ""} · All time</p>
        </div>
        <button onClick={load} className="p-1.5 rounded-lg hover:bg-muted transition text-muted-foreground">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Team summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl shadow-card p-3 text-center">
          <p className="text-xl font-bold text-foreground">{totalJobs}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total Jobs Done</p>
        </div>
        <div className="bg-card rounded-xl shadow-card p-3 text-center">
          <p className="text-xl font-bold text-foreground">N${Math.round(totalRevenue / 1000)}k</p>
          <p className="text-xs text-muted-foreground mt-0.5">Team Revenue</p>
        </div>
        <div className="bg-card rounded-xl shadow-card p-3 flex flex-col items-center">
          <DonutGauge
            value={avgCompletion}
            size={52}
            color={avgCompletion >= 75 ? "hsl(var(--success))" : "#f59e0b"}
            label={`${Math.round(avgCompletion)}%`}
          />
          <p className="text-xs text-muted-foreground mt-1">Avg Completion</p>
        </div>
      </div>

      {/* Top performer callout */}
      {topId && (() => {
        const top = data.find(e => e.employee_id === topId)!;
        return (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-center gap-3">
            <Trophy className="w-8 h-8 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Top Performer</p>
              <p className="text-sm font-semibold text-foreground">{top.employee_name}</p>
              <p className="text-xs text-muted-foreground">{top.jobs_completed} jobs · {top.completion_rate.toFixed(0)}% completion · N${Math.round(top.total_revenue_generated).toLocaleString()} revenue</p>
            </div>
          </div>
        );
      })()}

      {/* Underperformer alerts */}
      {underId.length > 0 && data.filter(e => underId.includes(e.employee_id)).map(e => (
        <div key={e.employee_id} className="bg-destructive/5 border border-destructive/20 rounded-xl p-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-destructive">Low Completion Rate</p>
            <p className="text-sm text-foreground">{e.employee_name} — {e.completion_rate.toFixed(0)}% ({e.jobs_completed}/{e.jobs_assigned} jobs)</p>
          </div>
        </div>
      ))}

      {/* Sortable table */}
      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Employee</th>
                <TH k="jobs_assigned"            label="Assigned" />
                <TH k="jobs_completed"           label="Completed" />
                <TH k="completion_rate"          label="Rate" />
                <TH k="total_revenue_generated"  label="Revenue" />
                <TH k="total_commission_earned"  label="Commission" />
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Duration</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Last Active</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Badges</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((emp, idx) => {
                const isTop   = emp.employee_id === topId;
                const isUnder = underId.includes(emp.employee_id);
                const badges  = perfBadges(emp, isTop, isUnder);
                const compColor = emp.completion_rate >= 80 ? "text-success"
                  : emp.completion_rate >= 50 ? "text-amber-600" : "text-destructive";

                return (
                  <tr key={emp.employee_id}
                      className={`hover:bg-muted/20 transition ${isTop ? "bg-amber-50/30 dark:bg-amber-900/10" : ""}`}>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                          ${isTop ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"}`}>
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{emp.employee_name}</p>
                          {emp.employee_number && <p className="text-muted-foreground">{emp.employee_number}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">{emp.jobs_assigned}</td>
                    <td className="px-3 py-3 font-semibold">{emp.jobs_completed}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <DonutGauge value={emp.completion_rate} size={28}
                          color={emp.completion_rate >= 80 ? "hsl(var(--success))" : emp.completion_rate >= 50 ? "#f59e0b" : "hsl(var(--destructive))"}
                          label="" />
                        <span className={`font-semibold ${compColor}`}>{emp.completion_rate.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-semibold text-success">N${Math.round(emp.total_revenue_generated).toLocaleString()}</td>
                    <td className="px-3 py-3">N${Math.round(emp.total_commission_earned).toLocaleString()}</td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {emp.avg_job_duration_minutes != null ? `~${Math.round(emp.avg_job_duration_minutes)}min` : "—"}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {emp.last_active_date ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {badges.map(b => <Badge key={b.label} label={b.label} color={b.color} />)}
                        {badges.length === 0 && <span className="text-muted-foreground">—</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
