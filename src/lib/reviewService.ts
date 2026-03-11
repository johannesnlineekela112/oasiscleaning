/**
 * reviewService.ts
 *
 * Customer reviews after completed bookings.
 * Only the booking owner can submit a review.
 * One review per booking, enforced by the edge function.
 */

import { supabase } from './supabase';

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
  // Refresh session first to avoid 401 from an expired token
  const { data: refreshData } = await supabase.auth.refreshSession();
  const session = refreshData?.session ?? (await supabase.auth.getSession()).data.session;

  if (!session?.access_token) {
    throw new Error('Your session has expired. Please sign in again and try.');
  }

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://gzbkpwdnkhsbeygnynbh.supabase.co';
  const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-review`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey':        import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
    },
    body: JSON.stringify({
      booking_id:     params.booking_id,
      star_rating:    params.star_rating,
      review_comment: params.review_comment,
    }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Map technical errors to simple human messages
    const raw: string = body.error ?? '';
    if (res.status === 401) {
      throw new Error('Your session has expired. Please sign in again and try.');
    }
    if (raw.includes('completed')) {
      throw new Error('You can only review a job that has been completed.');
    }
    if (raw.includes('own')) {
      throw new Error('You can only review your own bookings.');
    }
    if (raw.includes('already')) {
      throw new Error('You have already submitted a review for this booking.');
    }
    if (raw.includes('eligible')) {
      throw new Error('This booking is not available for review.');
    }
    throw new Error('We could not send your review. Please try again.');
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
