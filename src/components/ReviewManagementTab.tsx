/**
 * ReviewManagementTab.tsx
 *
 * Admin tool for reviewing, publishing, hiding, and managing
 * customer reviews linked to completed job cards (bookings).
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Star, Eye, EyeOff, Trash2, Loader2, MessageSquare, CheckCircle, XCircle, RefreshCw, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Review {
  id: string;
  star_rating: number;
  review_comment: string | null;
  review_status: "pending" | "published" | "hidden";
  created_at: string;
  customer_id: string;
  booking_id?: string;
  customer_name?: string;
  customer_email?: string;
}

type Filter = "all" | "pending" | "published" | "hidden";

const STATUS_BADGE = {
  published: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  pending:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  hidden:    "bg-muted text-muted-foreground",
};

export function ReviewManagementTab() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<Filter>("all");
  const [saving,  setSaving]  = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reviews")
      .select(`
        id, star_rating, review_comment, review_status, created_at, customer_id, booking_id, customer_name,
        users:customer_id (full_name, email)
      `)
      .order("created_at", { ascending: false });
    if (!error && data) {
      setReviews(data.map((r: any) => ({
        ...r,
        customer_name: r.customer_name || r.users?.full_name || "Unknown",
        customer_email: r.users?.email || "",
      })));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: "published" | "hidden" | "pending") => {
    setSaving(id);
    await supabase.from("reviews").update({ review_status: status }).eq("id", id);
    setReviews(prev => prev.map(r => r.id === id ? { ...r, review_status: status } : r));
    setSaving(null);
  };

  const deleteReview = async (id: string) => {
    if (!confirm("Delete this review permanently?")) return;
    setSaving(id);
    await supabase.from("reviews").delete().eq("id", id);
    setReviews(prev => prev.filter(r => r.id !== id));
    setSaving(null);
  };

  const displayed = filter === "all" ? reviews : reviews.filter(r => r.review_status === filter);

  const counts = {
    all:       reviews.length,
    pending:   reviews.filter(r => r.review_status === "pending").length,
    published: reviews.filter(r => r.review_status === "published").length,
    hidden:    reviews.filter(r => r.review_status === "hidden").length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-xl">Review Management</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Review, publish, or hide customer job-card reviews.</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-lg transition">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {(["all","pending","published","hidden"] as Filter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition capitalize ${
              filter === f ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}>
            {f} <span className="opacity-70">({counts[f]})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-secondary" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No {filter === "all" ? "" : filter} reviews</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(rev => (
            <motion.div key={rev.id}
              initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
              className="bg-card rounded-2xl border border-border p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                {/* Left */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <div className="flex gap-0.5">
                      {Array.from({length:5}).map((_,j) => (
                        <Star key={j} className={`w-4 h-4 ${j < rev.star_rating ? "fill-secondary text-secondary" : "text-border"}`} />
                      ))}
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[rev.review_status]}`}>
                      {rev.review_status}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(rev.created_at).toLocaleDateString("en-ZA", { day:"2-digit", month:"short", year:"numeric" })}
                    </span>
                  </div>
                  <p className="font-semibold text-sm mb-1">{rev.customer_name}</p>
                  {rev.customer_email && (
                    <p className="text-xs text-muted-foreground mb-2">{rev.customer_email}</p>
                  )}
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {rev.review_comment || <span className="italic opacity-60">No written comment — rating only.</span>}
                  </p>
                  {rev.booking_id && (
                    <p className="text-xs text-muted-foreground/60 mt-2 flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Job ref: {rev.booking_id.slice(0,8)}…
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {saving === rev.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-secondary" />
                  ) : (
                    <>
                      {rev.review_status !== "published" && (
                        <button onClick={() => setStatus(rev.id, "published")}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 transition">
                          <CheckCircle className="w-3.5 h-3.5" /> Publish
                        </button>
                      )}
                      {rev.review_status !== "hidden" && (
                        <button onClick={() => setStatus(rev.id, "hidden")}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-muted text-muted-foreground hover:text-foreground transition">
                          <EyeOff className="w-3.5 h-3.5" /> Hide
                        </button>
                      )}
                      {rev.review_status === "hidden" && (
                        <button onClick={() => setStatus(rev.id, "pending")}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 transition">
                          <Eye className="w-3.5 h-3.5" /> Restore
                        </button>
                      )}
                      <button onClick={() => deleteReview(rev.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-destructive hover:bg-destructive/10 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
