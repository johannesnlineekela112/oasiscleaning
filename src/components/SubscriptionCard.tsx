/**
 * SubscriptionCard.tsx
 *
 * Shown in UserDashboard.
 * - Active subscription → shows plan, usage, renewal date.
 * - Pending payment    → tells customer to pay and what happens next.
 * - Pending approval   → tells customer we are checking their payment.
 * - No subscription    → shows available plans with a Request button.
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Zap, CheckCircle2, Loader2, Repeat2, Clock, AlertCircle } from "lucide-react";
import {
  fetchMySubscription,
  fetchSubscriptionPlans,
  requestSubscription,
  type CustomerSubscription,
  type SubscriptionPlan,
} from "@/lib/subscriptionService";

function UsageBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div
        className="h-2 rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: pct >= 90 ? "#EF4444" : "#FF8C00" }}
      />
    </div>
  );
}

function PlanCard({
  plan,
  onRequest,
  requesting,
}: {
  plan: SubscriptionPlan;
  onRequest: (planId: string) => void;
  requesting: boolean;
}) {
  return (
    <div className="border border-border rounded-xl p-4 bg-card hover:border-orange-300 transition">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-bold text-sm">{plan.plan_name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
        </div>
        <div className="text-right shrink-0">
          {plan.monthly_price > 0 ? (
            <>
              <span className="text-lg font-display font-bold" style={{ color: "#FF8C00" }}>
                N$ {plan.monthly_price}
              </span>
              <span className="text-xs text-muted-foreground">/mo</span>
            </>
          ) : (
            <span className="text-xs font-semibold text-muted-foreground">Contact us</span>
          )}
        </div>
      </div>

      {plan.included_services.length > 0 && (
        <ul className="space-y-0.5 mt-2">
          {plan.included_services.map(s => (
            <li key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3 h-3 shrink-0 text-green-500" /> {s}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-xs text-muted-foreground">
        {plan.allowed_bookings_per_month >= 999
          ? "Unlimited bookings"
          : `${plan.allowed_bookings_per_month} booking${plan.allowed_bookings_per_month !== 1 ? "s" : ""} per month`}
      </p>

      <button
        type="button"
        disabled={requesting}
        className="mt-3 w-full py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
        style={{ background: "#FF8C00" }}
        onClick={() => onRequest(plan.id)}
      >
        {requesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
        {requesting ? "Sending request…" : "Request This Plan"}
      </button>
    </div>
  );
}

export default function SubscriptionCard() {
  const [sub,       setSub]       = useState<CustomerSubscription | null>(null);
  const [plans,     setPlans]     = useState<SubscriptionPlan[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showPlans, setShowPlans] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestMsg, setRequestMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, p] = await Promise.all([fetchMySubscription(), fetchSubscriptionPlans()]);
        setSub(s);
        setPlans(p);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, []);

  const handleRequest = async (planId: string) => {
    setRequesting(true);
    setRequestMsg(null);
    try {
      await requestSubscription({ plan_id: planId });
      setRequestMsg({ type: "ok", text: "Your request has been sent. Please make your payment and we will activate your plan once we confirm it." });
      // Reload subscription state
      const s = await fetchMySubscription();
      setSub(s);
      setShowPlans(false);
    } catch (e: any) {
      setRequestMsg({ type: "err", text: e?.message ?? "We could not send your request. Please try again." });
    } finally {
      setRequesting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-2xl shadow-card p-5 flex items-center justify-center h-24">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Pending payment state
  if (sub?.status === "pending_payment") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-2xl shadow-card p-5 border border-blue-200 dark:border-blue-800/30"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/30">
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="font-bold text-sm">{sub.plan_name ?? "Monthly Plan"}</p>
            <p className="text-xs text-muted-foreground">Waiting for your payment</p>
          </div>
          <span className="ml-auto text-xs font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
            Payment needed
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          We received your request. Please make your payment using the details on our website. 
          Once we see your payment, we will activate your plan — usually within a few hours.
        </p>
      </motion.div>
    );
  }

  // Pending admin approval
  if (sub?.status === "pending_admin_approval") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-2xl shadow-card p-5 border border-orange-200 dark:border-orange-800/30"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#FF8C00" }}>
            <Clock className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm">{sub.plan_name ?? "Monthly Plan"}</p>
            <p className="text-xs text-muted-foreground">We are checking your payment</p>
          </div>
          <span className="ml-auto text-xs font-bold text-orange-600 bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded-full">
            Almost there
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          We received your payment and are reviewing it now. Your plan will be active shortly.
          Thank you for your patience.
        </p>
      </motion.div>
    );
  }

  // Expired
  if (sub?.status === "expired") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-2xl shadow-card p-5 border border-border"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted">
            <AlertCircle className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="font-bold text-sm">{sub.plan_name ?? "Monthly Plan"}</p>
            <p className="text-xs text-muted-foreground">Your plan has ended</p>
          </div>
          <span className="ml-auto text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            Expired
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Your subscription expired on {new Date(sub.renewal_date).toLocaleDateString("en-NA", { day: "numeric", month: "long" })}. 
          Choose a plan below to renew.
        </p>
        {plans.length > 0 && (
          <button type="button" onClick={() => setShowPlans(!showPlans)}
            className="mt-3 text-xs font-semibold text-orange-500 hover:text-orange-600">
            {showPlans ? "Hide plans" : "See plans"}
          </button>
        )}
        {showPlans && (
          <div className="grid gap-3 mt-3">
            {plans.map(p => <PlanCard key={p.id} plan={p} onRequest={handleRequest} requesting={requesting} />)}
          </div>
        )}
      </motion.div>
    );
  }

  // Active subscription
  if (sub?.status === "active") {
    const remaining = sub.allowed_bookings_per_month - sub.used_bookings_count;
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-2xl shadow-card p-5 border border-orange-200 dark:border-orange-800/30"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#FF8C00" }}>
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm">{sub.plan_name ?? "Monthly Plan"}</p>
            <p className="text-xs text-muted-foreground">Active subscription</p>
          </div>
          <span className="ml-auto text-xs font-bold text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
            Active
          </span>
        </div>

        <UsageBar used={sub.used_bookings_count} total={sub.allowed_bookings_per_month} />
        <p className="text-xs text-muted-foreground mt-1.5 mb-3">
          {sub.used_bookings_count} of {sub.allowed_bookings_per_month} bookings used this month
          {remaining > 0 && <> · <span className="text-foreground font-medium">{remaining} remaining</span></>}
          {remaining <= 0 && <> · <span className="text-destructive font-medium">No bookings left this month</span></>}
        </p>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Repeat2 className="w-3.5 h-3.5 shrink-0" />
          <span>Renews {new Date(sub.renewal_date).toLocaleDateString("en-NA", { day: "numeric", month: "long" })}</span>
        </div>
      </motion.div>
    );
  }

  // No subscription or cancelled — show plans
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl shadow-card p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted">
            <Zap className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="font-bold text-sm">Monthly Plans</p>
            <p className="text-xs text-muted-foreground">Save with a subscription</p>
          </div>
        </div>
        {plans.length > 0 && (
          <button type="button" onClick={() => setShowPlans(!showPlans)}
            className="text-xs font-semibold text-orange-500 hover:text-orange-600">
            {showPlans ? "Hide" : "View Plans"}
          </button>
        )}
      </div>

      {requestMsg && (
        <div className={`text-xs rounded-lg p-3 mb-3 ${requestMsg.type === "ok" ? "bg-green-50 text-green-700 dark:bg-green-900/20" : "bg-red-50 text-red-700 dark:bg-red-900/20"}`}>
          {requestMsg.text}
        </div>
      )}

      {showPlans && plans.length > 0 && (
        <div className="grid gap-3 mt-2">
          {plans.map(p => <PlanCard key={p.id} plan={p} onRequest={handleRequest} requesting={requesting} />)}
        </div>
      )}

      {plans.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Subscription plans coming soon. Contact us for more information.
        </p>
      )}
    </motion.div>
  );
}
