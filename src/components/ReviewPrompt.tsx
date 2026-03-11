/**
 * ReviewPrompt.tsx
 *
 * Shown inside UserDashboard on a completed booking that hasn't been reviewed yet.
 * Manages star-hover state and submission.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Send, Loader2, CheckCircle2 } from "lucide-react";
import { submitReview } from "@/lib/reviewService";

interface Props {
  bookingId:  string;
  onReviewed: () => void;
}

export default function ReviewPrompt({ bookingId, onReviewed }: Props) {
  const [hovered,   setHovered]   = useState(0);
  const [selected,  setSelected]  = useState(0);
  const [comment,   setComment]   = useState("");
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState("");

  async function handleSubmit() {
    if (selected < 1) { setError("Please select a star rating."); return; }
    setLoading(true);
    setError("");
    try {
      await submitReview({
        booking_id:     bookingId,
        star_rating:    selected,
        review_comment: comment.trim() || undefined,
      });
      setDone(true);
      setTimeout(onReviewed, 1400);
    } catch (e: any) {
      setError(e.message ?? "Failed to submit review. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-2 py-4 text-green-600"
      >
        <CheckCircle2 className="w-8 h-8" />
        <p className="text-sm font-semibold">Thank you for your review!</p>
      </motion.div>
    );
  }

  return (
    <div className="mt-3 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
      <p className="text-sm font-semibold mb-3 text-amber-800 dark:text-amber-300">
        ⭐ How was your experience?
      </p>

      {/* Stars */}
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => setSelected(n)}
            className="transition-transform hover:scale-110"
          >
            <Star
              className="w-7 h-7"
              fill={n <= (hovered || selected) ? "#F59E0B" : "none"}
              stroke={n <= (hovered || selected) ? "#F59E0B" : "#D1D5DB"}
              strokeWidth={1.5}
            />
          </button>
        ))}
        {selected > 0 && (
          <span className="ml-1 text-sm text-amber-700 dark:text-amber-300 self-center font-medium">
            {["", "Poor", "Fair", "Good", "Great", "Excellent"][selected]}
          </span>
        )}
      </div>

      {/* Comment */}
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Share details about your experience (optional)…"
        rows={2}
        maxLength={500}
        className="w-full text-sm bg-white dark:bg-gray-900 border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 mb-2"
      />

      {error && <p className="text-xs text-destructive mb-2">{error}</p>}

      <div className="flex justify-end">
        <motion.button
          type="button"
          disabled={loading || selected < 1}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleSubmit}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-60"
          style={{ background: "#F59E0B" }}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Submit Review
        </motion.button>
      </div>
    </div>
  );
}
