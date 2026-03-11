/**
 * analyticsService.ts — v2 (edge-function-backed)
 *
 * All analytics now go through the admin-analytics edge function, which:
 *   • Reads from materialized views (pre-computed, sub-ms reads)
 *   • Auto-refreshes stale cache server-side (>5 min)
 *   • Returns Cache-Control headers (browser caches for 60s)
 *
 * Public API is identical to v1 — zero changes needed in consumers.
 */

import { supabase } from './supabase';

// ─── Types (unchanged from v1) ────────────────────────────────────────────────

export interface DailyStat {
  booking_date: string;
  total_bookings: number;
  completed_count: number;
  cancelled_count: number;
  pending_count: number;
  daily_revenue: number;
  avg_booking_value: number;
}

export interface ServiceStat {
  primary_service: string;
  booking_count: number;
  total_revenue: number;
  avg_value: number;
  completed_count: number;
  cancelled_count: number;
}

export interface EmployeePerf {
  employee_id: string;
  employee_name: string;
  employee_number: string | null;
  jobs_assigned: number;
  jobs_completed: number;
  jobs_cancelled: number;
  completion_rate: number;
  avg_job_duration_minutes: number | null;
  total_commission_earned: number;
  total_revenue_generated: number;
  last_active_date: string | null;
}

export interface HeatmapPoint {
  id: string;
  latitude: number;
  longitude: number;
  primary_service: string;
  service_type: string;
  status: string;
  booking_date: string;
  vehicle_type: string;
  service_value: number;
  area_name: string | null;
}

export interface OverviewKPIs {
  totalBookings30d:     number;
  totalRevenue30d:      number;
  avgOrderValue:        number;
  completionRate:       number;
  cancellationRate:     number;
  bookingsThisWeek:     number;
  revenueThisWeek:      number;
  totalBookingsAllTime: number;
  totalRevenueAllTime:  number;
  /** ISO timestamp of when the materialized view was last refreshed */
  computedAt?: string;
}

// ─── Internal helper ──────────────────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://gzbkpwdnkhsbeygnynbh.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

async function callAnalytics(params: Record<string, string>): Promise<any> {
  // Always refresh the session before calling analytics.
  // This prevents 401 errors when the tab has been idle and the token expired.
  const { data: refreshed } = await supabase.auth.refreshSession();
  const session = refreshed?.session ?? (await supabase.auth.getSession()).data.session;

  if (!session?.access_token) {
    throw new Error('Your login has expired. Please sign in again to view your dashboard.');
  }

  const qs = new URLSearchParams(params).toString();
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/admin-analytics?${qs}`,
    {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY,
      },
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    if (res.status === 401) {
      throw new Error('We could not open your dashboard. Please sign in again.');
    }
    if (res.status === 403) {
      throw new Error('You do not have permission to view analytics.');
    }
    throw new Error(err.error ?? 'We could not load your analytics. Please try again.');
  }
  const body = await res.json();
  return body.data;
}

// ─── Public API (same signatures as v1) ──────────────────────────────────────

export async function fetchDailyStats(days = 30): Promise<DailyStat[]> {
  const data = await callAnalytics({ type: 'daily', days: String(days) });
  return (data.daily ?? []).map((r: any) => ({
    booking_date:      r.booking_date,
    total_bookings:    Number(r.total_bookings)    || 0,
    completed_count:   Number(r.completed_count)   || 0,
    cancelled_count:   Number(r.cancelled_count)   || 0,
    pending_count:     Number(r.pending_count)     || 0,
    daily_revenue:     Number(r.daily_revenue)     || 0,
    avg_booking_value: Number(r.avg_booking_value) || 0,
  }));
}

export async function fetchServiceStats(): Promise<ServiceStat[]> {
  const data = await callAnalytics({ type: 'service' });
  return (data.service ?? []).map((r: any) => ({
    primary_service: r.primary_service ?? 'Unknown',
    booking_count:   Number(r.booking_count)   || 0,
    total_revenue:   Number(r.total_revenue)   || 0,
    avg_value:       Number(r.avg_value)       || 0,
    completed_count: Number(r.completed_count) || 0,
    cancelled_count: Number(r.cancelled_count) || 0,
  }));
}

export async function fetchEmployeePerformance(): Promise<EmployeePerf[]> {
  const data = await callAnalytics({ type: 'employee' });
  return (data.employee ?? []).map((r: any) => ({
    employee_id:               r.employee_id,
    employee_name:             r.employee_name ?? 'Unknown',
    employee_number:           r.employee_number ?? null,
    jobs_assigned:             Number(r.jobs_assigned)            || 0,
    jobs_completed:            Number(r.jobs_completed)           || 0,
    jobs_cancelled:            Number(r.jobs_cancelled)           || 0,
    completion_rate:           Number(r.completion_rate)          || 0,
    avg_job_duration_minutes:  r.avg_job_duration_minutes != null
      ? Number(r.avg_job_duration_minutes) : null,
    total_commission_earned:   Number(r.total_commission_earned)  || 0,
    total_revenue_generated:   Number(r.total_revenue_generated)  || 0,
    last_active_date:          r.last_active_date ?? null,
  }));
}

export async function fetchHeatmapData(
  serviceFilter?: string,
  daysBack?: number,
): Promise<HeatmapPoint[]> {
  const params: Record<string, string> = { type: 'heatmap' };
  if (serviceFilter && serviceFilter !== 'all') params.service_filter = serviceFilter;
  if (daysBack) params.days_back = String(daysBack);
  const data = await callAnalytics(params);
  return (data.heatmap ?? []) as HeatmapPoint[];
}

export async function fetchOverviewKPIs(): Promise<OverviewKPIs> {
  // Now reads from a single pre-computed row — no more 365-day JS aggregation.
  const data = await callAnalytics({ type: 'kpis' });
  const r = data.kpis ?? {};

  const bookings30d = Number(r.total_bookings_30d) || 0;
  const revenue30d  = Number(r.total_revenue_30d)  || 0;
  const completed   = Number(r.completed_30d)      || 0;
  const cancelled   = Number(r.cancelled_30d)      || 0;

  return {
    totalBookings30d:     bookings30d,
    totalRevenue30d:      revenue30d,
    avgOrderValue:        bookings30d > 0 ? revenue30d / bookings30d : 0,
    completionRate:       bookings30d > 0 ? (completed / bookings30d) * 100 : 0,
    cancellationRate:     bookings30d > 0 ? (cancelled / bookings30d) * 100 : 0,
    bookingsThisWeek:     Number(r.total_bookings_7d) || 0,
    revenueThisWeek:      Number(r.total_revenue_7d)  || 0,
    totalBookingsAllTime: Number(r.total_bookings_all_time) || 0,
    totalRevenueAllTime:  Number(r.total_revenue_all_time)  || 0,
    computedAt:           r.computed_at ?? undefined,
  };
}

/**
 * Fetch all analytics in one round trip.
 * Use this to pre-warm the analytics tab on dashboard mount.
 */
export async function fetchAllAnalytics(days = 30): Promise<{
  kpis: OverviewKPIs;
  daily: DailyStat[];
  service: ServiceStat[];
  employee: EmployeePerf[];
}> {
  const data = await callAnalytics({ type: 'all', days: String(days) });

  const r = data.kpis ?? {};
  const bookings30d = Number(r.total_bookings_30d) || 0;
  const revenue30d  = Number(r.total_revenue_30d)  || 0;
  const completed   = Number(r.completed_30d)      || 0;
  const cancelled   = Number(r.cancelled_30d)      || 0;

  return {
    kpis: {
      totalBookings30d:     bookings30d,
      totalRevenue30d:      revenue30d,
      avgOrderValue:        bookings30d > 0 ? revenue30d / bookings30d : 0,
      completionRate:       bookings30d > 0 ? (completed / bookings30d) * 100 : 0,
      cancellationRate:     bookings30d > 0 ? (cancelled / bookings30d) * 100 : 0,
      bookingsThisWeek:     Number(r.total_bookings_7d) || 0,
      revenueThisWeek:      Number(r.total_revenue_7d)  || 0,
      totalBookingsAllTime: Number(r.total_bookings_all_time) || 0,
      totalRevenueAllTime:  Number(r.total_revenue_all_time)  || 0,
      computedAt:           r.computed_at ?? undefined,
    },
    daily: (data.daily ?? []).map((r: any) => ({
      booking_date:      r.booking_date,
      total_bookings:    Number(r.total_bookings)    || 0,
      completed_count:   Number(r.completed_count)   || 0,
      cancelled_count:   Number(r.cancelled_count)   || 0,
      pending_count:     Number(r.pending_count)     || 0,
      daily_revenue:     Number(r.daily_revenue)     || 0,
      avg_booking_value: Number(r.avg_booking_value) || 0,
    })),
    service: (data.service ?? []).map((r: any) => ({
      primary_service: r.primary_service ?? 'Unknown',
      booking_count:   Number(r.booking_count)   || 0,
      total_revenue:   Number(r.total_revenue)   || 0,
      avg_value:       Number(r.avg_value)       || 0,
      completed_count: Number(r.completed_count) || 0,
      cancelled_count: Number(r.cancelled_count) || 0,
    })),
    employee: (data.employee ?? []).map((r: any) => ({
      employee_id:               r.employee_id,
      employee_name:             r.employee_name ?? 'Unknown',
      employee_number:           r.employee_number ?? null,
      jobs_assigned:             Number(r.jobs_assigned)            || 0,
      jobs_completed:            Number(r.jobs_completed)           || 0,
      jobs_cancelled:            Number(r.jobs_cancelled)           || 0,
      completion_rate:           Number(r.completion_rate)          || 0,
      avg_job_duration_minutes:  r.avg_job_duration_minutes != null
        ? Number(r.avg_job_duration_minutes) : null,
      total_commission_earned:   Number(r.total_commission_earned)  || 0,
      total_revenue_generated:   Number(r.total_revenue_generated)  || 0,
      last_active_date:          r.last_active_date ?? null,
    })),
  };
}
