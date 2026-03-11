/**
 * SubscriptionCard.tsx
 *
 * Shown in UserDashboard.
 * 1. If the customer has an active subscription → shows current plan + usage.
 * 2. If no subscription → shows available plans from DB (not hardcoded).
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Zap, CheckCircle2, Loader2, Repeat2 } from "lucide-react";
import {
  fetchMySubscription,
  fetchSubscriptionPlans,
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

function PlanCard({ plan }: { plan: SubscriptionPlan }) {
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
        className="mt-3 w-full py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90"
        style={{ background: "#FF8C00" }}
        onClick={() => alert("Contact us via WhatsApp to activate this plan.")}
      >
        Get Started
      </button>
    </div>
  );
}

export default function SubscriptionCard() {
  const [sub,     setSub]     = useState<CustomerSubscription | null>(null);
  const [plans,   setPlans]   = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPlans, setShowPlans] = useState(false);

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

  if (loading) {
    return (
      <div className="bg-card rounded-2xl shadow-card p-5 flex items-center justify-center h-24">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Active subscription view
  if (sub) {
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
          {remaining <= 0 && <> · <span className="text-destructive font-medium">Allowance exhausted</span></>}
        </p>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Repeat2 className="w-3.5 h-3.5 shrink-0" />
          <span>Renews {new Date(sub.renewal_date).toLocaleDateString("en-NA", { day: "numeric", month: "long" })}</span>
        </div>
      </motion.div>
    );
  }

  // No subscription — upsell
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
          <button
            type="button"
            onClick={() => setShowPlans(!showPlans)}
            className="text-xs font-semibold text-orange-500 hover:text-orange-600"
          >
            {showPlans ? "Hide" : "View Plans"}
          </button>
        )}
      </div>

      {showPlans && plans.length > 0 && (
        <div className="grid gap-3 mt-2">
          {plans.map(p => <PlanCard key={p.id} plan={p} />)}
        </div>
      )}

      {plans.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Subscription plans coming soon. Contact us for early access.
        </p>
      )}
    </motion.div>
  );
}
