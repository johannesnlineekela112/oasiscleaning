/**
 * subscriptionService.ts
 *
 * Read/write for subscription_plans and customer_subscriptions.
 * All plan definitions come from the database — none are hardcoded.
 */

import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubscriptionPlan {
  id:                         string;
  business_id:                string;
  plan_name:                  string;
  description:                string;
  monthly_price:              number;
  allowed_bookings_per_month: number;
  included_services:          string[];
  extra_service_allowances:   Record<string, number>;
  status:                     'active' | 'archived' | 'draft';
  sort_order:                 number;
}

export interface CustomerSubscription {
  id:                         string;
  business_id:                string;
  customer_id:                string;
  plan_id:                    string;
  start_date:                 string;
  renewal_date:               string;
  allowed_bookings_per_month: number;
  used_bookings_count:        number;
  status:                     'pending_payment' | 'pending_admin_approval' | 'active' | 'paused' | 'expired' | 'cancelled';
  notes:                      string | null;
  created_at:                 string;
  // Joined
  plan_name?:                 string;
  plan_description?:          string;
  monthly_price?:             number;
}

export interface SubscriptionCheckResult {
  covered:         boolean;
  subscription_id: string | null;
  remaining:       number;
  plan_name?:      string;
  exhausted?:      boolean;
}

// ─── Fetch plans (public) ─────────────────────────────────────────────────────

export async function fetchSubscriptionPlans(businessId = '00000000-0000-0000-0000-000000000001'): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('business_id', businessId)
    .eq('status', 'active')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []) as SubscriptionPlan[];
}

// ─── Customer subscription ─────────────────────────────────────────────────────
// Returns the most recent non-cancelled subscription (including pending states).

export async function fetchMySubscription(): Promise<CustomerSubscription | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from('customer_subscriptions')
    .select(`
      *,
      subscription_plans!plan_id (plan_name, description, monthly_price)
    `)
    .eq('customer_id', session.user.id)
    .not('status', 'in', '("cancelled","expired")')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const plan = (data as any).subscription_plans;
  return {
    ...(data as any),
    plan_name:        plan?.plan_name     ?? null,
    plan_description: plan?.description   ?? null,
    monthly_price:    plan?.monthly_price ?? null,
  } as CustomerSubscription;
}

export async function checkSubscriptionForBooking(
  customerId: string,
  businessId = '00000000-0000-0000-0000-000000000001'
): Promise<SubscriptionCheckResult> {
  const { data, error } = await supabase.rpc('get_active_subscription', {
    p_customer_id: customerId,
    p_business_id: businessId,
  });
  if (error) throw error;
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return { covered: false, subscription_id: null, remaining: 0 };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    covered:         (row.remaining_bookings ?? 0) > 0,
    subscription_id: row.subscription_id ?? null,
    remaining:       row.remaining_bookings ?? 0,
    plan_name:       row.plan_name,
    exhausted:       (row.remaining_bookings ?? 0) <= 0,
  };
}

// ─── Admin: create subscription ───────────────────────────────────────────────

export async function createCustomerSubscription(params: {
  customer_id:                string;
  plan_id:                    string;
  renewal_date:               string;
  allowed_bookings_per_month: number;
  notes?:                     string;
  business_id?:               string;
}): Promise<CustomerSubscription> {
  const { data, error } = await supabase
    .from('customer_subscriptions')
    .insert({
      business_id: params.business_id ?? '00000000-0000-0000-0000-000000000001',
      customer_id: params.customer_id,
      plan_id:     params.plan_id,
      start_date:  new Date().toISOString().slice(0, 10),
      renewal_date: params.renewal_date,
      allowed_bookings_per_month: params.allowed_bookings_per_month,
      status:      'pending_payment',
      notes:       params.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as CustomerSubscription;
}

// ─── Customer: request a plan ─────────────────────────────────────────────────
// Enforces one active request per customer. Throws if a non-cancelled,
// non-expired subscription already exists.

export async function requestSubscription(params: {
  plan_id:      string;
  business_id?: string;
}): Promise<CustomerSubscription> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in to request a subscription.');

  // Guard: reject if a live subscription or pending request already exists
  const { data: existing } = await supabase
    .from('customer_subscriptions')
    .select('id, status')
    .eq('customer_id', user.id)
    .not('status', 'in', '("cancelled","expired")')
    .limit(1)
    .maybeSingle();

  if (existing) {
    if (existing.status === 'active') {
      throw new Error('You already have an active subscription.');
    }
    if (existing.status === 'pending_payment') {
      throw new Error('You already have a subscription request waiting for payment. Please complete your payment or contact us if you need to change your plan.');
    }
    if (existing.status === 'pending_admin_approval') {
      throw new Error('Your payment is being reviewed. We will activate your plan shortly.');
    }
    throw new Error('You already have a subscription on this account.');
  }

  const plan = await supabase
    .from('subscription_plans')
    .select('allowed_bookings_per_month')
    .eq('id', params.plan_id)
    .single();
  if (plan.error) throw new Error('We could not find that plan. Please try again.');

  const renewalDate = new Date();
  renewalDate.setMonth(renewalDate.getMonth() + 1);

  const { data, error } = await supabase
    .from('customer_subscriptions')
    .insert({
      business_id:                params.business_id ?? '00000000-0000-0000-0000-000000000001',
      customer_id:                user.id,
      plan_id:                    params.plan_id,
      start_date:                 new Date().toISOString().slice(0, 10),
      renewal_date:               renewalDate.toISOString().slice(0, 10),
      allowed_bookings_per_month: plan.data!.allowed_bookings_per_month,
      status:                     'pending_payment',
      requested_at:               new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error('We could not submit your request. Please try again.');
  return data as CustomerSubscription;
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  const { error } = await supabase
    .from('customer_subscriptions')
    .update({ status: 'cancelled' })
    .eq('id', subscriptionId);
  if (error) throw error;
}
