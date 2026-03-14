/**
 * reviewService.ts
 *
 * Customer reviews after completed bookings.
 * Only booking owner can review; only one review per booking.
 * All validation enforced at DB level (RLS + triggers).
 */

import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Review {
  id:             string;
  booking_id:     string;
  customer_id:    string;
  business_id:    string;
  star_rating:    number;
  review_comment: string | null;
  review_status:  'published' | 'hidden' | 'flagged';
  created_at:     string;
}

// ─── Submit a review ──────────────────────────────────────────────────────────

export async function submitReview(params: {
  booking_id:     string;
  star_rating:    number;
  review_comment?: string;
  business_id?:   string;
}): Promise<Review> {
  // Route through edge function for full server-side enforcement:
  //   - ownership check, one-per-booking, completion gate, feature flag
  // Refresh session first to avoid stale-token 401s
  await supabase.auth.refreshSession().catch(() => {});
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Your session has expired. Please sign out and sign back in to submit your review.');
  }

  const SUPABASE_URL = 'https://gzbkpwdnkhsbeygnynbh.supabase.co';
  const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-review`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      booking_id:     params.booking_id,
      star_rating:    params.star_rating,
      review_comment: params.review_comment,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (body.error === 'SESSION_EXPIRED' || res.status === 401) {
      throw new Error('Your session has expired. Please sign out and sign back in to submit your review.');
    }
    throw new Error(body.message ?? body.error ?? `Failed to submit review (${res.status})`);
  }
  return body.review as Review;
}

// ─── Fetch my reviews ─────────────────────────────────────────────────────────

export async function fetchMyReviews(): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Review[];
}

// ─── Admin: fetch + manage reviews ───────────────────────────────────────────

export async function fetchAllReviews(businessId = '00000000-0000-0000-0000-000000000001'): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Review[];
}

export async function updateReviewStatus(
  reviewId: string,
  status: 'published' | 'hidden' | 'flagged'
): Promise<void> {
  const { error } = await supabase
    .from('reviews')
    .update({ review_status: status })
    .eq('id', reviewId);
  if (error) throw error;
}
