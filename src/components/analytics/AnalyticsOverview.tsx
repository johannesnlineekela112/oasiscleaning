/**
 * AnalyticsOverview.tsx
 *
 * "Overview" tab inside the Analytics section of AdminDashboard.
 * – 4 KPI cards (total bookings, revenue, AOV, completion rate)
 * – Line chart: bookings per day + revenue per day (dual axis via normalisation)
 * – Bar chart: revenue by service type
 * – Date-range selector: 7 / 14 / 30 / 90 days
 */

import { useState, useEffect } from "react";
import { Loader2, TrendingUp, DollarSign, Calendar, CheckCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { LineChart, BarChart, DonutGauge, type LinePoint, type BarItem } from "./MiniChart";
import {
  fetchDailyStats, fetchServiceStats, fetchOverviewKPIs,
  type DailyStat, type ServiceStat, type OverviewKPIs,
} from "@/lib/analyticsService";

const RANGES = [
  { label: "7d",  days: 7  },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

function fmt(n: number, prefix = ""): string {
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${prefix}${(n / 1_000).toFixed(1)}k`;
  return `${prefix}${Math.round(n).toLocaleString()}`;
}

interface KpiCardProps {
  icon:    React.ReactNode;
  label:   string;
  value:   string;
  sub?:    string;
  color?:  string;
  trend?:  "up" | "down" | "neutral";
}

function KpiCard({ icon, label, value, sub, color = "bg-primary/10 text-primary", trend }: KpiCardProps) {
  return (
    <div className="bg-card rounded-xl shadow-card p-4 flex items-start gap-3">
      <div className={`${color} rounded-lg p-2.5 flex-shrink-0`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground font-medium truncate">{label}</p>
        <p className="text-xl font-bold text-foreground mt-0.5 leading-tight">{value}</p>
        {sub && <p className={`text-xs mt-0.5 ${trend === "up" ? "text-success" : trend === "down" ? "text-destructive" : "text-muted-foreground"}`}>{sub}</p>}
      </div>
    </div>
  );
}

export function AnalyticsOverview() {
  const [days,     setDays]     = useState(30);
  const [daily,    setDaily]    = useState<DailyStat[]>([]);
  const [services, setServices] = useState<ServiceStat[]>([]);
  const [kpis,     setKpis]     = useState<OverviewKPIs | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [d, s, k] = await Promise.all([
        fetchDailyStats(days),
        fetchServiceStats(),
        fetchOverviewKPIs(),
      ]);
      setDaily(d); setServices(s); setKpis(k);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load analytics");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [days]);

  // Build chart data
  const lineData: LinePoint[] = daily.map(d => ({
    label:  d.booking_date.slice(5), // MM-DD
    value:  d.total_bookings,
    value2: Math.round(d.daily_revenue / 10), // scale revenue to bookings range
  }));

  const revenueLineData: LinePoint[] = daily.map(d => ({
    label: d.booking_date.slice(5),
    value: d.daily_revenue,
  }));

  const barData: BarItem[] = services.map(s => ({
    label: s.primary_service,
    value: s.total_revenue,
  }));

  const COLORS = ["hsl(var(--primary))","hsl(var(--info))","hsl(var(--success))","#f59e0b","#8b5cf6"];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <AlertTriangle className="w-8 h-8 text-destructive/60" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <button onClick={load} className="text-xs text-primary hover:underline">Retry</button>
      </div>
    );
  }

  const completionColor = (kpis?.completionRate ?? 0) >= 80 ? "hsl(var(--success))"
    : (kpis?.completionRate ?? 0) >= 50 ? "#f59e0b" : "hsl(var(--destructive))";

  return (
    <div className="space-y-5">
      {/* Header + range selector */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-bold text-sm text-foreground">Booking Analytics</h3>
          <p className="text-xs text-muted-foreground">Business performance overview</p>
        </div>
        <div className="flex items-center gap-1.5">
          {RANGES.map(r => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition
                ${days === r.days ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
            >
              {r.label}
            </button>
          ))}
          <button onClick={load} className="p-1.5 rounded-lg hover:bg-muted transition text-muted-foreground ml-1">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          icon={<Calendar className="w-4 h-4" />}
          label={`Bookings (${days}d)`}
          value={fmt(kpis?.totalBookings30d ?? 0)}
          sub={`${fmt(kpis?.bookingsThisWeek ?? 0)} this week`}
          color="bg-primary/10 text-primary"
        />
        <KpiCard
          icon={<DollarSign className="w-4 h-4" />}
          label={`Revenue (${days}d)`}
          value={fmt(kpis?.totalRevenue30d ?? 0, "N$")}
          sub={`N$${fmt(kpis?.revenueThisWeek ?? 0)} this week`}
          color="bg-success/10 text-success"
        />
        <KpiCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Avg Order Value"
          value={`N$${Math.round(kpis?.avgOrderValue ?? 0)}`}
          color="bg-info/10 text-info"
        />
        <KpiCard
          icon={<CheckCircle className="w-4 h-4" />}
          label="Completion Rate"
          value={`${(kpis?.completionRate ?? 0).toFixed(1)}%`}
          sub={`${(kpis?.cancellationRate ?? 0).toFixed(1)}% cancelled`}
          color="bg-success/10 text-success"
          trend={(kpis?.completionRate ?? 0) >= 75 ? "up" : "down"}
        />
      </div>

      {/* Gauge row */}
      <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
        {[
          { label: "Completion", value: kpis?.completionRate ?? 0, color: completionColor },
          { label: "Cancellation", value: kpis?.cancellationRate ?? 0, color: "hsl(var(--destructive))" },
          { label: "Week vs 30d",
            value: kpis && kpis.totalBookings30d > 0 ? Math.min(100, (kpis.bookingsThisWeek / (kpis.totalBookings30d / 4.3)) * 100) : 0,
            color: "hsl(var(--info))" },
        ].map(g => (
          <div key={g.label} className="bg-card rounded-xl shadow-card p-3 flex flex-col items-center gap-1">
            <DonutGauge
              value={g.value}
              size={72}
              color={g.color}
              label={`${Math.round(g.value)}%`}
            />
            <p className="text-xs text-muted-foreground font-medium">{g.label}</p>
          </div>
        ))}
      </div>

      {/* Bookings per day */}
      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h4 className="font-semibold text-sm">Bookings Per Day</h4>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="w-3 h-0.5 bg-primary inline-block rounded" /> Bookings
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="w-3 h-0.5 bg-info inline-block rounded border-dashed" style={{ borderTop: "1.5px dashed hsl(var(--info))", background: "none" }} /> Revenue ÷10
            </span>
          </div>
        </div>
        <div className="p-3">
          {lineData.length > 0
            ? <LineChart data={lineData} height={160} label2="revenue" color="hsl(var(--primary))" color2="hsl(var(--info))" />
            : <p className="text-center text-xs text-muted-foreground py-8">No data for this period</p>
          }
        </div>
      </div>

      {/* Revenue per day */}
      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h4 className="font-semibold text-sm">Revenue Per Day (N$)</h4>
        </div>
        <div className="p-3">
          {revenueLineData.length > 0
            ? <LineChart data={revenueLineData} height={140} color="hsl(var(--success))" showDots={false} />
            : <p className="text-center text-xs text-muted-foreground py-8">No revenue data</p>
          }
        </div>
      </div>

      {/* Revenue by service */}
      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h4 className="font-semibold text-sm">Revenue by Service Type (N$, all time)</h4>
        </div>
        <div className="p-3">
          {barData.length > 0
            ? <BarChart data={barData} height={200} />
            : <p className="text-center text-xs text-muted-foreground py-8">No service data</p>
          }
        </div>
        {/* Service detail table */}
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/30">
                {["Service", "Bookings", "Revenue", "Avg Value", "Completed", "Cancelled"].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {services.map((s, i) => (
                <tr key={s.primary_service} className="hover:bg-muted/20 transition">
                  <td className="px-3 py-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    {s.primary_service}
                  </td>
                  <td className="px-3 py-2">{s.booking_count}</td>
                  <td className="px-3 py-2 font-semibold">N${Math.round(s.total_revenue).toLocaleString()}</td>
                  <td className="px-3 py-2">N${Math.round(s.avg_value)}</td>
                  <td className="px-3 py-2 text-success">{s.completed_count}</td>
                  <td className="px-3 py-2 text-destructive">{s.cancelled_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
