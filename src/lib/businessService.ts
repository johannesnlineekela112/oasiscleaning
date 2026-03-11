/**
 * businessService.ts
 *
 * Loads branding, config, and feature flags for the current business.
 * All callers use this instead of hardcoding values.
 * Cached in module scope so it only fetches once per page load.
 */

import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BusinessConfig {
  id:             string;
  business_name:  string;
  logo_url:       string | null;
  contact_email:  string | null;
  contact_phone:  string | null;
  country:        string;
  currency:       string;
}

export interface BusinessSettings {
  business_id:          string;
  brand_color:          string;
  logo_url:             string | null;
  contact_email:        string | null;
  whatsapp_number:      string | null;
  payment_details:      PaymentDetails;
  booking_rules:        BookingRules;
  review_enabled:       boolean;
  subscription_enabled: boolean;
}

export interface PaymentDetails {
  eft?: {
    bank_name:      string;
    account_name:   string;
    account_number: string;
    branch_code:    string;
    reference_hint: string;
  };
  ewallet?: {
    number:       string;
    instructions: string;
  };
  pay2cell?: {
    number:       string;
    instructions: string;
  };
}

export interface BookingRules {
  min_lead_hours:             number;
  late_cancel_window_mins:    number;
  max_vehicles_per_booking:   number;
  require_photos_to_complete: boolean;
  min_photos_to_complete:     number;
}

export interface FeatureFlags {
  subscriptions_enabled:   boolean;
  review_system_enabled:   boolean;
  analytics_enabled:       boolean;
  mobile_payments_enabled: boolean;
}

// ─── Module-level cache ───────────────────────────────────────────────────────
let _settings: BusinessSettings | null = null;
let _flags:    FeatureFlags    | null = null;
const OASIS_ID = '00000000-0000-0000-0000-000000000001';

// ─── Loaders ──────────────────────────────────────────────────────────────────

export async function getBusinessSettings(forceRefresh = false): Promise<BusinessSettings> {
  if (_settings && !forceRefresh) return _settings;

  const { data, error } = await supabase
    .from('business_settings')
    .select('*')
    .eq('business_id', OASIS_ID)
    .single();

  if (error || !data) {
    // Fallback defaults so the UI never crashes
    return {
      business_id:          OASIS_ID,
      brand_color:          '#FF8C00',
      logo_url:             null,
      contact_email:        null,
      whatsapp_number:      null,
      payment_details:      {},
      booking_rules:        {
        min_lead_hours: 1, late_cancel_window_mins: 30,
        max_vehicles_per_booking: 4,
        require_photos_to_complete: true, min_photos_to_complete: 2,
      },
      review_enabled:       true,
      subscription_enabled: false,
    };
  }

  _settings = {
    ...data,
    payment_details: (data.payment_details ?? {}) as PaymentDetails,
    booking_rules:   (data.booking_rules   ?? {}) as BookingRules,
  };
  return _settings!;
}

export async function getFeatureFlags(forceRefresh = false): Promise<FeatureFlags> {
  if (_flags && !forceRefresh) return _flags;

  const { data, error } = await supabase
    .from('feature_flags')
    .select('*')
    .eq('business_id', OASIS_ID)
    .single();

  if (error || !data) {
    return {
      subscriptions_enabled:   false,
      review_system_enabled:   true,
      analytics_enabled:       true,
      mobile_payments_enabled: true,
    };
  }

  _flags = data as FeatureFlags;
  return _flags!;
}
