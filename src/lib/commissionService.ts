/**
 * commissionService.ts
 *
 * Service layer for the monthly commission payout system.
 *
 * Design notes
 * ─────────────
 * • Generate  — calls the `generate-monthly-commission` Edge Function.
 *               Admin-only; JWT required.
 * • Read      — reads from `admin_commission_summary_view` (joined with user names).
 *               Employees can only SELECT their own rows (RLS enforced).
 * • Approve   — pending → approved (admin only).
 * • MarkPaid  — approved → paid (admin only); sets paid_at = now().
 * • Export    — client-side CSV / XLSX using xlsxExport helpers.
 *
 * Immutability: the DB trigger `guard_paid_commission_summary` prevents ANY
 * UPDATE on a row that is already 'paid'. This service forwards the server
 * error to the caller if that guard fires.
 */

import { supabase } from './supabase';
import { downloadXlsx, downloadCsv, XlsxRow } from './xlsxExport';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CommissionSummary {
  id:               string;
  employee_id:      string;
  month:            number;
  year:             number;
  total_jobs:       number;
  total_revenue:    number;
  commission_rate:  number;
  total_commission: number;
  generated_at:     string;
  payout_status:    'pending' | 'approved' | 'paid';
  paid_at:          string | null;
  approved_by:      string | null;
  notes:            string | null;
  // From view join
  employee_name:    string;
  employee_email:   string;
  employee_number:  string;
  approved_by_name: string | null;
}

export interface GenerateResult {
  success:          boolean;
  month:            number;
  year:             number;
  summaries:        CommissionSummary[];
  skipped:          { employee_id: string; reason: string; payout_status?: string }[];
  total_employees:  number;
  generated_count:  number;
  message?:         string;
}

// Month display helpers
export const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
export const monthName = (m: number) => MONTH_NAMES[m - 1] ?? `Month ${m}`;

export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Pending',  color: 'text-amber-700',  bg: 'bg-amber-100 dark:bg-amber-900/20' },
  approved: { label: 'Approved', color: 'text-blue-700',   bg: 'bg-blue-100 dark:bg-blue-900/20'   },
  paid:     { label: 'Paid',     color: 'text-green-700',  bg: 'bg-green-100 dark:bg-green-900/20' },
};

// ─── Generate ─────────────────────────────────────────────────────────────────

/**
 * Call the edge function to generate (or regenerate) the monthly summary.
 * regenerate=true will overwrite any existing 'pending' summary.
 * 'approved' and 'paid' summaries are NEVER overwritten.
 */
export async function generateMonthlySummary(
  month:       number,
  year:        number,
  regenerate = false,
): Promise<GenerateResult> {
  const { data, error } = await supabase.functions.invoke(
    'generate-monthly-commission',
    { body: { month, year, regenerate } },
  );
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error ?? 'Generation failed');
  return data as GenerateResult;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/** Fetch all summaries for a given month/year (admin: all rows; employee: own only). */
export async function fetchSummaries(month: number, year: number): Promise<CommissionSummary[]> {
  const { data, error } = await supabase
    .from('admin_commission_summary_view')
    .select('*')
    .eq('month', month)
    .eq('year', year)
    .order('employee_name', { ascending: true });
  if (error) throw error;
  return (data || []) as CommissionSummary[];
}

/** Fetch all summaries across all months for a single employee (used on employee dashboard). */
export async function fetchMyCommissionHistory(): Promise<CommissionSummary[]> {
  const { data, error } = await supabase
    .from('employee_commission_summary')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false });
  if (error) throw error;
  return (data || []) as CommissionSummary[];
}

/** Fetch years that have at least one summary (for the year selector). */
export async function fetchSummaryYears(): Promise<number[]> {
  const { data, error } = await supabase
    .from('employee_commission_summary')
    .select('year');
  if (error) return [new Date().getFullYear()];
  const years = [...new Set((data || []).map((r: any) => r.year as number))].sort((a, b) => b - a);
  if (!years.includes(new Date().getFullYear())) years.unshift(new Date().getFullYear());
  return years;
}

// ─── Approve ──────────────────────────────────────────────────────────────────

/**
 * Admin: move a summary from 'pending' to 'approved'.
 * The DB trigger prevents this if the summary is already 'paid'.
 */
export async function approveSummary(
  summaryId:  string,
  approvedBy: string,
): Promise<void> {
  const { error } = await supabase
    .from('employee_commission_summary')
    .update({ payout_status: 'approved', approved_by: approvedBy })
    .eq('id', summaryId)
    .eq('payout_status', 'pending'); // safety: only pending → approved
  if (error) throw new Error(error.message);
}

// ─── Mark as Paid ─────────────────────────────────────────────────────────────

/**
 * Admin: move a summary from 'approved' to 'paid'.
 * Once paid, the DB trigger makes the row immutable.
 */
export async function markSummaryPaid(summaryId: string): Promise<void> {
  const { error } = await supabase
    .from('employee_commission_summary')
    .update({ payout_status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', summaryId)
    .eq('payout_status', 'approved'); // safety: only approved → paid
  if (error) {
    // Forward the DB guard error in readable form
    if (error.message.includes('locked after payment')) {
      throw new Error('This summary is locked — it has already been paid.');
    }
    throw new Error(error.message);
  }
}

/**
 * Admin: update notes on a non-paid summary.
 */
export async function updateSummaryNotes(summaryId: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from('employee_commission_summary')
    .update({ notes })
    .eq('id', summaryId)
    .neq('payout_status', 'paid');
  if (error) throw new Error(error.message);
}

// ─── Export helpers ───────────────────────────────────────────────────────────

const EXPORT_KEYS: string[] = [
  'employee_name', 'employee_number', 'month_label', 'year',
  'total_jobs', 'total_revenue', 'commission_rate_pct',
  'total_commission', 'payout_status', 'generated_at', 'paid_at',
];

const EXPORT_HEADERS: string[] = [
  'Employee Name', 'Employee #', 'Month', 'Year',
  'Total Jobs', 'Total Revenue (N$)', 'Commission Rate (%)',
  'Total Commission (N$)', 'Status', 'Generated At', 'Paid At',
];

function summaryToRow(s: CommissionSummary): XlsxRow {
  return {
    employee_name:       s.employee_name,
    employee_number:     s.employee_number,
    month_label:         monthName(s.month),
    year:                s.year,
    total_jobs:          s.total_jobs,
    total_revenue:       Number(s.total_revenue),
    commission_rate_pct: Number(s.commission_rate),
    total_commission:    Number(s.total_commission),
    payout_status:       s.payout_status,
    generated_at:        s.generated_at ? new Date(s.generated_at).toLocaleString('en-NA') : '',
    paid_at:             s.paid_at     ? new Date(s.paid_at).toLocaleString('en-NA')     : '',
  };
}

function buildFilename(month: number, year: number, ext: string): string {
  return `oasis_commission_${monthName(month)}_${year}.${ext}`;
}

/** Export all summaries for a month/year to XLSX. */
export function exportMonthXlsx(summaries: CommissionSummary[], month: number, year: number): void {
  downloadXlsx(summaries.map(summaryToRow), EXPORT_HEADERS, EXPORT_KEYS, buildFilename(month, year, 'xlsx'), `Commission ${monthName(month)} ${year}`);
}

/** Export all summaries for a month/year to CSV. */
export function exportMonthCsv(summaries: CommissionSummary[], month: number, year: number): void {
  downloadCsv(summaries.map(summaryToRow), EXPORT_HEADERS, EXPORT_KEYS, buildFilename(month, year, 'csv'));
}

/** Export a single employee's summary to XLSX. */
export function exportSingleXlsx(summary: CommissionSummary): void {
  const safeName = (summary.employee_name || 'employee').replace(/\s+/g, '_').toLowerCase();
  downloadXlsx(
    [summaryToRow(summary)], EXPORT_HEADERS, EXPORT_KEYS,
    `oasis_commission_${monthName(summary.month)}_${summary.year}_${safeName}.xlsx`,
    `Commission ${monthName(summary.month)} ${summary.year}`,
  );
}

export function exportSingleCsv(summary: CommissionSummary): void {
  const safeName = (summary.employee_name || 'employee').replace(/\s+/g, '_').toLowerCase();
  downloadCsv(
    [summaryToRow(summary)], EXPORT_HEADERS, EXPORT_KEYS,
    `oasis_commission_${monthName(summary.month)}_${summary.year}_${safeName}.csv`,
  );
}

// ─── History booking export ───────────────────────────────────────────────────

const HISTORY_EXPORT_KEYS = [
  'booking_id','customer_name','customer_email','customer_phone',
  'service_type','original_price','final_price','discount_applied',
  'loyalty_points_used','latitude','longitude','formatted_address',
  'assigned_employee','employee_number','booking_date','booking_time',
  'status','cancellation_type','commission_amount','created_at',
];

const HISTORY_EXPORT_HEADERS = [
  'Booking ID','Customer Name','Customer Email','Customer Phone',
  'Service Type','Original Price (N$)','Final Price (N$)','Discount Applied (N$)',
  'Loyalty Points Used','Latitude','Longitude','Address',
  'Assigned Employee','Employee #','Booking Date','Booking Time',
  'Status','Cancellation Type','Commission (N$)','Created At',
];

export function exportHistoryXlsx(rows: XlsxRow[], startDate: string, endDate: string): void {
  downloadXlsx(rows, HISTORY_EXPORT_HEADERS, HISTORY_EXPORT_KEYS,
    `oasis_history_${startDate}_to_${endDate}.xlsx`, 'Booking History');
}

export function exportHistoryCsv(rows: XlsxRow[], startDate: string, endDate: string): void {
  downloadCsv(rows, HISTORY_EXPORT_HEADERS, HISTORY_EXPORT_KEYS,
    `oasis_history_${startDate}_to_${endDate}.csv`);
}

// ─── Commission date-range export ─────────────────────────────────────────────

const COMM_EXPORT_KEYS = [
  'employee_name','employee_number','total_jobs_completed',
  'total_revenue','commission_rate','total_commission','date_range',
];

const COMM_EXPORT_HEADERS = [
  'Employee Name','Employee #','Total Jobs Completed',
  'Total Revenue (N$)','Commission Rate (%)','Total Commission (N$)','Date Range',
];

export function exportCommissionXlsx(rows: XlsxRow[], startDate: string, endDate: string): void {
  downloadXlsx(rows, COMM_EXPORT_HEADERS, COMM_EXPORT_KEYS,
    `oasis_commission_${startDate}_to_${endDate}.xlsx`, 'Commission Summary');
}

export function exportCommissionCsv(rows: XlsxRow[], startDate: string, endDate: string): void {
  downloadCsv(rows, COMM_EXPORT_HEADERS, COMM_EXPORT_KEYS,
    `oasis_commission_${startDate}_to_${endDate}.csv`);
}

