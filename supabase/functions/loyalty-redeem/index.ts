import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

function pgErrMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) return (err as { message: string }).message;
  return "Unknown error";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/, "");
    if (!jwt) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(SUPABASE_URL, ANON_KEY);
    const { data: { user }, error: authErr } = await authClient.auth.getUser(jwt);
    if (authErr || !user) return json({ error: "Unauthorized: invalid token" }, 401);

    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    let body: Record<string, unknown>;
    try { body = await req.json(); }
    catch { return json({ error: "Invalid JSON" }, 400); }

    const { action } = body;

    if (action === "redeem_points") {
      const { data, error } = await db.rpc("redeem_free_wash", { p_user_id: user.id });
      if (error) {
        const msg = pgErrMessage(error);
        const status = msg.includes("Insufficient") ? 422 : msg.includes("Monthly limit") ? 429 : 500;
        return json({ error: msg }, status);
      }
      return json({ success: true, redemptionId: data });
    }

    if (action === "attach_to_booking") {
      const { redemptionId, bookingId } = body as { redemptionId?: string; bookingId?: string };
      if (!redemptionId) return json({ error: "redemptionId is required" }, 400);
      if (!bookingId)    return json({ error: "bookingId is required" }, 400);
      const { error } = await db.rpc("attach_free_wash_to_booking", { p_redemption_id: redemptionId, p_booking_id: bookingId, p_user_id: user.id });
      if (error) {
        const msg = pgErrMessage(error);
        const status = msg.includes("VIP") ? 422 : msg.includes("Booking already has") ? 409 : msg.includes("expired") ? 410 : msg.includes("not found") ? 404 : 500;
        return json({ error: msg }, status);
      }
      return json({ success: true });
    }

    if (action === "expire_stale") {
      const { data: profile } = await db.from("users").select("role").eq("id", user.id).single();
      if ((profile as { role: string })?.role !== "admin") return json({ error: "Forbidden" }, 403);
      const { data: count, error } = await db.rpc("expire_stale_redemptions");
      if (error) return json({ error: pgErrMessage(error) }, 500);
      return json({ success: true, expiredCount: count });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[loyalty-redeem] error:", msg);
    return json({ error: msg }, 500);
  }
});
