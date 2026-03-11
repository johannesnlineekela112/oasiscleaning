import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user)
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: profile } = await admin.from("users").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin")
      return new Response(JSON.stringify({ error: "Forbidden — admin only" }), { status: 403, headers: CORS });

    const body = await req.json();
    const month: number = parseInt(body.month);
    const year: number = parseInt(body.year);
    const regenerate: boolean = body.regenerate === true;

    if (!month || !year || month < 1 || month > 12 || year < 2020)
      return new Response(JSON.stringify({ error: "Invalid month or year" }), { status: 422, headers: CORS });

    const { data: aggregated, error: aggErr } = await admin.rpc("compute_monthly_commission", { p_month: month, p_year: year });
    if (aggErr) throw aggErr;

    if (!aggregated || aggregated.length === 0)
      return new Response(
        JSON.stringify({ success: true, summaries: [], skipped: [], message: "No completed bookings for this period." }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
      );

    const summaries: unknown[] = [];
    const skipped: unknown[] = [];

    for (const row of aggregated) {
      const { data: existing } = await admin
        .from("employee_commission_summary")
        .select("id, payout_status")
        .eq("employee_id", row.employee_id)
        .eq("month", month)
        .eq("year", year)
        .maybeSingle();

      if (existing && (existing.payout_status === "approved" || existing.payout_status === "paid")) {
        skipped.push({ employee_id: row.employee_id, reason: `Status is '${existing.payout_status}' — locked`, payout_status: existing.payout_status });
        continue;
      }
      if (existing && !regenerate) {
        skipped.push({ employee_id: row.employee_id, reason: "Summary already exists (pass regenerate=true to overwrite)", payout_status: existing.payout_status });
        continue;
      }

      const { data: upserted, error: upsertErr } = await admin
        .from("employee_commission_summary")
        .upsert({
          employee_id: row.employee_id, month, year,
          total_jobs: row.total_jobs,
          total_revenue: Number(row.total_revenue),
          commission_rate: Number(row.commission_rate),
          total_commission: Number(row.total_commission),
          generated_at: new Date().toISOString(),
          payout_status: "pending", paid_at: null, approved_by: null,
        }, { onConflict: "employee_id,month,year" })
        .select().single();

      if (upsertErr) { skipped.push({ employee_id: row.employee_id, reason: upsertErr.message }); continue; }
      summaries.push(upserted);
    }

    return new Response(
      JSON.stringify({ success: true, month, year, summaries, skipped, total_employees: aggregated.length, generated_count: summaries.length }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("generate-monthly-commission error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: CORS });
  }
});
