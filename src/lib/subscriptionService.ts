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
  status:                     'active' | 'paused' | 'expired' | 'cancelled';
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

// ─── Customer subscription ────────────────────────────────────────────────────

export async function fetchMySubscription(): Promise<CustomerSubscription | null> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return null;

  const { data, error } = await supabase
    .from('customer_subscriptions')
    .select(`
      *,
      subscription_plans!plan_id (plan_name, description, monthly_price)
    `)
    .eq('customer_id', session.session.user.id)
    .eq('status', 'active')
    .gte('renewal_date', new Date().toISOString().slice(0, 10))
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const plan = (data as any).subscription_plans;
  return {
    ...(data as any),
    plan_name:        plan?.plan_name        ?? null,
    plan_description: plan?.description      ?? null,
    monthly_price:    plan?.monthly_price    ?? null,
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
    plan_name:        row.plan_name,
    exhausted:        (row.remaining_bookings ?? 0) <= 0,
  };
}

// ─── Admin: manage subscriptions ─────────────────────────────────────────────

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
      status:      'active',
      notes:       params.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as CustomerSubscription;
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  const { error } = await supabase
    .from('customer_subscriptions')
    .update({ status: 'cancelled' })
    .eq('id', subscriptionId);
  if (error) throw error;
}
