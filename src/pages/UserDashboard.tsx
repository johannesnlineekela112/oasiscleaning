/**
 * UserDashboard.tsx
 *
 * Two-tab layout:
 *   "My Bookings" — existing booking list with edit/cancel
 *   "Loyalty"     — points, tier, free wash redemption
 *
 * Realtime subscriptions:
 *   bookings         → merge edits / cancellations in-place
 *   user_loyalty     → update points/tier instantly after booking completion
 *   free_wash_redemptions → update redemption cards after redemption
 */

import { useState, useEffect } from "react";
import { CopyrightFooter } from "@/components/CopyrightFooter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogOut, Calendar, Clock, CreditCard, Loader2, ArrowLeft,
  Edit2, AlertTriangle, CheckCircle, XCircle, MapPin, Save, Lock,
  Star, Pencil, Gift, Award, TrendingUp, Sparkles, RefreshCw,
  ChevronRight, Zap, Shield, Camera, ImageIcon, User, Phone, Mail,
} from "lucide-react";
import {
  Booking, getUserBookings, getEditability,
  customerUpdateBooking, customerCancelBooking, toNamibiaDisplay,
  TIME_SLOTS, getBookedSlots, todayInNamibia, isSlotInPast,
  CUTOFF_SCHEDULE_MINUTES, CUTOFF_LOCATION_MINUTES, CUTOFF_LATE_CANCEL_MINUTES,
  normalizeBooking,
} from "@/lib/bookingService";
import {
  UserLoyalty, FreeWashRedemption,
  fetchMyLoyalty, fetchMyRedemptions, redeemFreeWash,
  TIER_CONFIG, FREE_WASH_COST, tierProgress, freeWashProgress,
  availableFreeWashes, formatExpiry, REDEMPTION_STATUS,
} from "@/lib/loyaltyService";
import {
  BookingImage, getBookingImages,
} from "@/lib/imageService";
import { getSessionUser, logout, getUserProfile, updateUserProfile, UserProfile } from "@/lib/authService";
import { supabase } from "@/lib/supabase";
import { getBoolSetting, SETTINGS_KEYS } from "@/lib/settingsService";
import MapPicker, { LocationResult } from "@/components/MapPicker";
import { useNavigate, Link } from "react-router-dom";
import logo from "@/assets/logo1.png";
import { AboutModal } from "@/components/AboutModal";
import WinnyChatbot from "@/components/WinnyChatbot";
import ReviewPrompt from "@/components/ReviewPrompt";
import SubscriptionCard from "@/components/SubscriptionCard";

// ─── Status config (includes late_cancelled) ─────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending:        { label: "Pending",            color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",  icon: Clock },
  confirmed:      { label: "Confirmed",          color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",          icon: CheckCircle },
  in_progress:    { label: "Paid / In Progress", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",          icon: CheckCircle },
  completed:      { label: "Completed",          color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",      icon: CheckCircle },
  cancelled:      { label: "Cancelled",          color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",             icon: XCircle },
  late_cancelled: { label: "Late Cancellation",  color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",     icon: AlertTriangle },
};

function formatMinsLeft(mins: number): string {
  if (!isFinite(mins) || mins <= 0) return "";
  if (mins < 60) return `${Math.floor(mins)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

const LockPill = ({ label }: { label: string }) => (
  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
    <Lock className="w-2.5 h-2.5" /> {label}
  </span>
);

// ─── Edit Modal ───────────────────────────────────────────────────────────────
interface EditModalProps { booking: Booking; onClose: () => void; onSaved: (u: Booking) => void; }

const EditModal = ({ booking, onClose, onSaved }: EditModalProps) => {
  const flags    = getEditability(booking);
  const origDate = booking.booking_date || booking.date || "";
  const origSlot = booking.time_slot    || booking.time || "";

  const [date,        setDate]        = useState(origDate);
  const [timeSlot,    setTimeSlot]    = useState(origSlot);
  const [locResult,   setLocResult]   = useState<LocationResult | null>(null);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  useEffect(() => {
    if (!date) return;
    getBookedSlots(date).then(slots => {
      setBookedSlots(date === origDate ? slots.filter(s => s !== origSlot) : slots);
    }).catch(() => {});
  }, [date, origDate, origSlot]);

  const pastSlots      = date ? TIME_SLOTS.filter(s => isSlotInPast(date, s.value)).map(s => s.value) : [];
  const scheduleChanged = date !== origDate || timeSlot !== origSlot;
  const locationChanged = locResult !== null && locResult.confirmed;
  const hasChanges      = scheduleChanged || locationChanged;
  const timeBlocked     = bookedSlots.includes(timeSlot) || pastSlots.includes(timeSlot);

  const handleSave = async () => {
    setError("");
    if (!hasChanges) { onClose(); return; }
    if (scheduleChanged && !flags.canEditSchedule) { setError(`Schedule changes lock ${CUTOFF_SCHEDULE_MINUTES} min before service.`); return; }
    if (locationChanged && !flags.canEditLocation) { setError(`Location changes lock ${CUTOFF_LOCATION_MINUTES} min before service.`); return; }
    if (timeBlocked) { setError("That time slot is unavailable. Choose another."); return; }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (scheduleChanged && flags.canEditSchedule) {
        if (date     !== origDate) payload.booking_date = date;
        if (timeSlot !== origSlot) payload.time_slot    = timeSlot;
      }
      if (locationChanged && flags.canEditLocation && locResult) {
        payload.address_text = `${booking.fullName} | ${booking.whatsapp} | ${locResult.address}`;
        payload.latitude     = locResult.latitude;
        payload.longitude    = locResult.longitude;
        payload.area_name    = locResult.areaName || null;
      }
      if (Object.keys(payload).length === 0) { onClose(); return; }
      await customerUpdateBooking(booking.id!, payload as any);
      onSaved({ ...booking, booking_date: date, date, time_slot: timeSlot, time: timeSlot, is_vip: timeSlot.startsWith("VIP"),
        ...(locationChanged && locResult ? { latitude: locResult.latitude, longitude: locResult.longitude, address: locResult.address, area_name: locResult.areaName || null } : {}),
      });
    } catch (err: any) {
      setError(err?.message || "Failed to save. Please try again.");
    } finally { setSaving(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30 shrink-0">
          <div>
            <h2 className="font-display font-bold text-lg flex items-center gap-2"><Pencil className="w-4 h-4 text-secondary" /> Edit Booking</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{origDate} · {origSlot}{booking.isVip ? " ⭐ VIP" : ""}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition"><XCircle className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Schedule</h3>
              {!flags.canEditSchedule ? <LockPill label={`Locked — ${formatMinsLeft(flags.minutesLeft)} left`} /> :
                flags.minutesLeft < 90 ? <span className="text-xs text-amber-600 font-semibold">Locks in {formatMinsLeft(flags.minutesLeft - CUTOFF_SCHEDULE_MINUTES)}</span> : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Date</label>
                <input type="date" min={todayInNamibia()} value={date} disabled={!flags.canEditSchedule}
                  onChange={e => { setDate(e.target.value); setTimeSlot(""); }}
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/40 transition ${!flags.canEditSchedule ? "opacity-50 cursor-not-allowed border-border/50" : "border-border"}`} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Time</label>
                <select value={timeSlot} disabled={!flags.canEditSchedule || !date} onChange={e => setTimeSlot(e.target.value)}
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/40 transition ${!flags.canEditSchedule ? "opacity-50 cursor-not-allowed border-border/50" : "border-border"}`}>
                  <option value="" disabled>{!date ? "Pick date first" : "— Select —"}</option>
                  {TIME_SLOTS.map(s => {
                    const booked = bookedSlots.includes(s.value), past = pastSlots.includes(s.value);
                    return <option key={s.value} value={s.value} disabled={booked || past}>{s.label}{booked ? " (Full)" : past ? " (Past)" : ""}</option>;
                  })}
                </select>
              </div>
            </div>
          </section>
          {(booking.latitude || booking.longitude) && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Location</h3>
                {!flags.canEditLocation ? <LockPill label={`Locked — ${formatMinsLeft(flags.minutesLeft)} left`} /> :
                  flags.minutesLeft < 60 ? <span className="text-xs text-amber-600 font-semibold">Locks in {formatMinsLeft(flags.minutesLeft - CUTOFF_LOCATION_MINUTES)}</span> : null}
              </div>
              {flags.canEditLocation ? (
                <>
                  <MapPicker initialLat={booking.latitude ?? undefined} initialLng={booking.longitude ?? undefined} onLocationSelect={setLocResult} />
                  {locResult && !locResult.confirmed && <p className="text-xs text-amber-600 text-center mt-2">Tap "Confirm This Location" to apply changes.</p>}
                  {locationChanged && <p className="text-xs text-green-600 flex items-center justify-center gap-1 mt-2"><CheckCircle className="w-3 h-3" /> New location confirmed</p>}
                </>
              ) : (
                <MapPicker initialLat={booking.latitude ?? undefined} initialLng={booking.longitude ?? undefined} readOnly showDirections onLocationSelect={() => {}} />
              )}
            </section>
          )}
          {error && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </motion.div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 bg-muted/20 shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition">Cancel</button>
          <button onClick={handleSave} disabled={saving || !hasChanges || timeBlocked}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-bold shadow-orange hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Changes</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Cancel Modal ─────────────────────────────────────────────────────────────
const CancelModal = ({ booking, isLateZone, minutesLeft, onClose, onCancelled }: {
  booking: Booking; isLateZone: boolean; minutesLeft: number;
  onClose: () => void; onCancelled: (s: "cancelled"|"late_cancelled") => void;
}) => {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const handleConfirm = async () => {
    setLoading(true); setError("");
    try {
      const { newStatus } = await customerCancelBooking(booking.id!);
      onCancelled(newStatus as "cancelled"|"late_cancelled");
    } catch (err: any) { setError(err?.message || "Cancellation failed."); setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 380 }}
        className="w-full max-w-sm bg-card rounded-2xl shadow-2xl overflow-hidden">
        <div className={`px-6 py-5 text-center ${isLateZone ? "bg-amber-50 dark:bg-amber-900/20" : "bg-destructive/5"}`}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${isLateZone ? "bg-amber-100" : "bg-destructive/15"}`}>
            <AlertTriangle className={`w-6 h-6 ${isLateZone ? "text-amber-600" : "text-destructive"}`} />
          </div>
          <h2 className="font-display font-bold text-lg">{isLateZone ? "Late Cancellation" : "Cancel Booking?"}</h2>
          {isLateZone && <p className="text-sm text-amber-700 mt-1.5 font-medium">Service in {formatMinsLeft(minutesLeft)} — within {CUTOFF_LATE_CANCEL_MINUTES}-min window.</p>}
        </div>
        <div className="px-6 py-5 space-y-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="w-4 h-4" /> {booking.date || booking.booking_date} at {booking.time || booking.time_slot}</div>
          {isLateZone ? (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-xl text-xs text-amber-800">
              Recorded as <strong>Late Cancellation</strong>. Repeated late cancels may affect future priority.
              {booking.is_free_wash && <span className="block mt-1 font-semibold">⚠️ Attached free wash will be forfeited (no points refund).</span>}
            </div>
          ) : (
            <p className="text-muted-foreground">
              This booking will be cancelled.
              {booking.is_free_wash && " Your free wash will be refunded — 100 points restored."}
            </p>
          )}
          {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {error}</p>}
        </div>
        <div className="px-6 pb-6 flex items-center gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition">Go Back</button>
          <button onClick={handleConfirm} disabled={loading}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50
              ${isLateZone ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"}`}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Cancelling…</> : <><XCircle className="w-4 h-4" /> Confirm Cancellation</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Loyalty Panel ────────────────────────────────────────────────────────────
const LoyaltyPanel = ({ userId, referralEnabled }: { userId: string; referralEnabled: boolean }) => {
  const [loyalty,      setLoyalty]      = useState<UserLoyalty | null>(null);
  const [redemptions,  setRedemptions]  = useState<FreeWashRedemption[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [redeeming,    setRedeeming]    = useState(false);
  const [redeemMsg,    setRedeemMsg]    = useState<{ text: string; ok: boolean } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [l, r] = await Promise.all([fetchMyLoyalty(userId), fetchMyRedemptions(userId)]);
      setLoyalty(l);
      setRedemptions(r);
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [userId]);

  // Realtime: user_loyalty row → update stats instantly when admin marks booking completed
  // Also watches bookings for this user — when status flips to completed/late_cancelled
  // the DB trigger fires (handle_booking_loyalty_events) which updates user_loyalty,
  // which in turn fires the user_loyalty subscription and refreshes the UI.
  useEffect(() => {
    const ch = supabase
      .channel(`loyalty-user-${userId}`)
      // Primary: direct row update on user_loyalty
      .on("postgres_changes", { event: "*", schema: "public", table: "user_loyalty", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType !== "DELETE") {
            setLoyalty(payload.new as UserLoyalty);
          }
        }
      )
      // Secondary: booking status change → re-fetch loyalty to pick up trigger changes
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookings", filter: `customer_id=eq.${userId}` },
        (payload) => {
          const newStatus = (payload.new as any)?.status;
          const oldStatus = (payload.old as any)?.status;
          if (newStatus !== oldStatus && (newStatus === "completed" || newStatus === "late_cancelled" || newStatus === "cancelled")) {
            // Give the DB trigger 300ms to run, then re-fetch
            setTimeout(() => {
              Promise.all([fetchMyLoyalty(userId), fetchMyRedemptions(userId)])
                .then(([l, r]) => { if (l) setLoyalty(l); setRedemptions(r); })
                .catch(() => {});
            }, 300);
          }
        }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "free_wash_redemptions", filter: `user_id=eq.${userId}` },
        () => { fetchMyRedemptions(userId).then(setRedemptions).catch(() => {}); }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const handleRedeem = async () => {
    setRedeeming(true); setRedeemMsg(null);
    try {
      await redeemFreeWash();
      // Reload both loyalty + redemptions to reflect new state
      const [l, r] = await Promise.all([fetchMyLoyalty(userId), fetchMyRedemptions(userId)]);
      setLoyalty(l);
      setRedemptions(r);
      setRedeemMsg({ text: "🎉 Free wash reserved! Use it when booking.", ok: true });
    } catch (err: any) {
      setRedeemMsg({ text: err?.message || "Redemption failed. Please try again.", ok: false });
    } finally {
      setRedeeming(false);
      setTimeout(() => setRedeemMsg(null), 6000);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-secondary" />
    </div>
  );

  // New user — no loyalty row yet
  if (!loyalty) return (
    <div className="text-center py-20 text-muted-foreground">
      <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-30" />
      <p className="font-semibold">No loyalty points yet</p>
      <p className="text-sm">Complete your first booking to start earning!</p>
      <Link to="/" className="inline-flex items-center gap-2 mt-6 bg-secondary text-secondary-foreground px-5 py-2.5 rounded-lg font-semibold hover:opacity-90 transition text-sm">
        <Sparkles className="w-4 h-4" /> Book Now &amp; Earn Points
      </Link>
    </div>
  );

  const tier   = TIER_CONFIG[loyalty.tier] || TIER_CONFIG.Bronze;
  const tp     = tierProgress(loyalty.lifetime_points);
  const fwp    = freeWashProgress(loyalty.redeemable_points);
  const ptToFreeWash = Math.max(0, FREE_WASH_COST - (loyalty.redeemable_points % FREE_WASH_COST));
  const canRedeem = loyalty.redeemable_points >= FREE_WASH_COST;
  const reservedRedemptions = redemptions.filter(r => r.status === "reserved");
  const historyRedemptions  = redemptions.filter(r => r.status !== "reserved");

  return (
    <div className="space-y-5 pb-10">

      {/* ── Tier card ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl p-5 border-2 ${tier.badge} relative overflow-hidden`}
        style={{ background: "linear-gradient(135deg, var(--card) 0%, rgba(255,140,0,0.04) 100%)" }}>
        {/* Decorative ring */}
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10" style={{ background: "#FF8C00" }} />
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-foreground/70 mb-1">Loyalty Tier</p>
            <div className="flex items-center gap-2">
              <span className="text-3xl">{tier.emoji}</span>
              <div>
                <h2 className={`text-2xl font-display font-black ${tier.color}`}>{tier.label}</h2>
                {tp.nextTier && (
                  <p className="text-xs font-medium text-foreground/70">{tp.pointsToNext} pts to {tp.nextTier}</p>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-foreground/70">Lifetime</p>
            <p className="text-2xl font-display font-bold" style={{ color: "#FF8C00" }}>
              {loyalty.lifetime_points.toLocaleString()}
            </p>
            <p className="text-xs font-medium text-foreground/70">points</p>
          </div>
        </div>

        {/* Tier progress bar */}
        {tp.nextTier && (
          <div className="mt-4 relative z-10">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground/70 mb-1">
              <span>{tier.label}</span>
              <span>{tp.nextTier}</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${tp.progress * 100}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, #FF8C00, #ffb347)" }}
              />
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Stats grid ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="grid grid-cols-2 gap-3">
        {[
          { label: "Redeemable",  value: loyalty.redeemable_points, icon: Zap,         color: "text-secondary", suffix: "pts" },
          { label: "Lifetime",    value: loyalty.lifetime_points,   icon: TrendingUp,  color: "text-purple-500", suffix: "pts" },
          { label: "Washes Earned", value: loyalty.free_washes_earned, icon: Gift,     color: "text-green-600",  suffix: "" },
          { label: "Washes Used",   value: loyalty.free_washes_used,   icon: CheckCircle, color: "text-foreground/60", suffix: "" },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl p-4 shadow-card">
            <div className="flex items-center gap-1.5 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">{s.label}</span>
            </div>
            <p className={`text-2xl font-display font-bold ${s.color}`}>
              {s.value.toLocaleString()}{s.suffix && <span className="text-sm font-normal ml-1">{s.suffix}</span>}
            </p>
          </div>
        ))}
      </motion.div>

      {/* ── Free wash progress + redeem ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-card rounded-2xl shadow-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-secondary" />
            <h3 className="font-display font-bold">Free Wash Progress</h3>
          </div>
          {canRedeem && (
            <span className="text-xs font-bold text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
              {availableFreeWashes(loyalty.redeemable_points)} available
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground/70 mb-1.5">
            <span>{loyalty.redeemable_points % FREE_WASH_COST} / {FREE_WASH_COST} pts</span>
            {!canRedeem && <span>{ptToFreeWash} pts to next wash</span>}
          </div>
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${fwp * 100}%` }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: canRedeem ? "linear-gradient(90deg,#16a34a,#4ade80)" : "linear-gradient(90deg, #FF8C00, #ffb347)" }}
            />
          </div>
        </div>

        <p className="text-xs font-medium text-foreground/70 mb-4">
          Every {FREE_WASH_COST} redeemable points = 1 free Standard Wash. Earn +10 pts per completed booking
          {referralEnabled ? ", +20 bonus every 5th booking, +25 per referral." : ", +20 bonus every 5th booking."}
        </p>

        {/* Redeem button */}
        <button
          onClick={handleRedeem}
          disabled={!canRedeem || redeeming}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition
            ${canRedeem
              ? "bg-secondary text-secondary-foreground shadow-orange hover:opacity-90"
              : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
            }`}
        >
          {redeeming
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Redeeming…</>
            : <><Gift className="w-4 h-4" /> Redeem {FREE_WASH_COST} Points for Free Wash</>
          }
        </button>
        {!canRedeem && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Need {Math.max(0, FREE_WASH_COST - loyalty.redeemable_points)} more redeemable points
          </p>
        )}

        {/* Feedback message */}
        <AnimatePresence>
          {redeemMsg && (
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`mt-3 p-3 rounded-xl text-sm text-center font-semibold ${
                redeemMsg.ok
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {redeemMsg.text}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Reserved redemptions ── */}
      {reservedRedemptions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/70 mb-3 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-secondary" /> Available Free Washes
          </h3>
          <div className="space-y-2">
            {reservedRedemptions.map(r => (
              <div key={r.id} className="bg-card rounded-xl p-4 shadow-card border-l-4 border-green-400 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    <Gift className="w-4 h-4 text-green-600" /> Free Standard Wash
                  </p>
                  <p className="text-xs font-medium text-foreground/70 mt-0.5">{formatExpiry(r.expires_at)}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
                    Ready to use
                  </span>
                  <p className="text-xs font-medium text-foreground/70 mt-1">Apply during booking</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs font-medium text-foreground/70 mt-2 flex items-center gap-1">
            <Shield className="w-3 h-3" /> Free washes apply to Standard bookings only (not VIP). Select "Use Free Wash" when booking.
          </p>
        </motion.div>
      )}

      {/* ── Points breakdown ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
        className="bg-card rounded-xl shadow-card p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/70 mb-4 flex items-center gap-2">
          <Award className="w-3.5 h-3.5" /> How You Earn Points
        </h3>
        <div className="space-y-2 text-sm">
          {[
            { label: "Completed booking",       pts: "+10", color: "text-green-600" },
            { label: "Every 5th booking bonus", pts: "+20", color: "text-green-600" },
            ...(referralEnabled ? [{ label: "Successful referral", pts: "+25", color: "text-green-600" }] : []),
            { label: "Late cancellation",       pts: "−15", color: "text-destructive" },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between">
              <span className="text-foreground/70 font-medium">{row.label}</span>
              <span className={`font-bold font-display ${row.color}`}>{row.pts} pts</span>
            </div>
          ))}
        </div>
        {referralEnabled && loyalty.referral_code && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs font-bold text-foreground/70 mb-1">Your referral code</p>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-lg tracking-widest text-secondary">
                {loyalty.referral_code}
              </span>
              <button
                onClick={() => navigator.clipboard?.writeText(loyalty.referral_code || "")}
                className="text-xs text-foreground/70 hover:text-foreground px-2 py-1 rounded border border-border hover:bg-muted transition"
              >
                Copy
              </button>
            </div>
            <p className="text-xs font-medium text-foreground/70 mt-1">
              Share your code — you earn +25 pts for every customer who signs up with it.
            </p>
          </div>
        )}
      </motion.div>

      {/* ── Redemption history ── */}
      {historyRedemptions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/70 mb-3">Redemption History</h3>
          <div className="space-y-2">
            {historyRedemptions.map(r => {
              const sc = REDEMPTION_STATUS[r.status] || REDEMPTION_STATUS.cancelled;
              return (
                <div key={r.id} className="bg-card rounded-xl p-4 shadow-card flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Free Standard Wash</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(r.redeemed_at).toLocaleDateString("en-NA", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sc.color}`}>{sc.label}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
};

// ─── Profile Tab ─────────────────────────────────────────────────────────────
const ProfileTab = ({
  profile,
  onUpdated,
}: {
  profile: UserProfile;
  onUpdated: (p: UserProfile) => void;
}) => {
  const [fullName,  setFullName]  = useState(profile.full_name || "");
  const [cellphone, setCellphone] = useState(profile.whatsapp  || "");
  const [saving,    setSaving]    = useState(false);
  const [msg,       setMsg]       = useState<{ text: string; ok: boolean } | null>(null);
  const [edited,    setEdited]    = useState(false);

  const handleSave = async () => {
    if (!fullName.trim()) { setMsg({ text: "Full name cannot be empty.", ok: false }); return; }
    if (!cellphone.trim()) { setMsg({ text: "Cellphone number cannot be empty.", ok: false }); return; }
    setSaving(true); setMsg(null);
    try {
      await updateUserProfile(profile.id, { full_name: fullName.trim(), whatsapp: cellphone.trim() });
      onUpdated({ ...profile, full_name: fullName.trim(), whatsapp: cellphone.trim() });
      setMsg({ text: "✓ Profile updated successfully.", ok: true });
      setEdited(false);
    } catch (err: any) {
      setMsg({ text: err?.message || "Failed to save. Try again.", ok: false });
    } finally {
      setSaving(false); setTimeout(() => setMsg(null), 4000);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-10">

      {/* Avatar + name card */}
      <div className="bg-card rounded-2xl shadow-card p-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl font-display shrink-0">
          {(profile.full_name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="font-display font-bold text-xl text-foreground">{profile.full_name}</p>
          <p className="text-sm text-foreground/70">{profile.email}</p>
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-bold bg-secondary/15 text-secondary capitalize">
            {profile.role}
          </span>
        </div>
      </div>

      {/* Edit form */}
      <div className="bg-card rounded-2xl shadow-card p-6 space-y-5">
        <h3 className="font-display font-bold text-lg flex items-center gap-2">
          <User className="w-5 h-5 text-secondary" /> Edit Profile
        </h3>

        {/* Full Name */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-foreground/70 mb-1.5 block">
            Full Name <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={fullName}
              onChange={e => { setFullName(e.target.value); setEdited(true); }}
              placeholder="Your full name"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/40 transition"
            />
          </div>
        </div>

        {/* Cellphone */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-foreground/70 mb-1.5 block">
            Cellphone Number <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="tel"
              value={cellphone}
              onChange={e => { setCellphone(e.target.value); setEdited(true); }}
              placeholder="+264812345678"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/40 transition"
            />
          </div>
          <p className="text-xs text-foreground/60 mt-1">Used for booking confirmations & WhatsApp messages.</p>
        </div>

        {/* Email — read-only */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-foreground/70 mb-1.5 block">
            Email <span className="text-foreground/50 font-normal normal-case">(cannot be changed)</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="email"
              value={profile.email}
              readOnly
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-muted text-foreground/50 cursor-not-allowed"
            />
          </div>
        </div>

        {/* Feedback */}
        <AnimatePresence>
          {msg && (
            <motion.p
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`text-sm font-semibold p-3 rounded-xl ${msg.ok ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-destructive/10 text-destructive"}`}
            >
              {msg.text}
            </motion.p>
          )}
        </AnimatePresence>

        <button
          onClick={handleSave}
          disabled={saving || !edited}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-secondary text-secondary-foreground font-bold text-sm shadow-orange hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Changes</>}
        </button>
      </div>

      {/* Account info */}
      <div className="bg-card rounded-2xl shadow-card p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/70 mb-3 flex items-center gap-2">
          <Shield className="w-3.5 h-3.5" /> Account Info
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-foreground/70">Account type</span>
            <span className="font-semibold text-foreground capitalize">{profile.role}</span>
          </div>
          {profile.created_at && (
            <div className="flex items-center justify-between">
              <span className="text-foreground/70">Member since</span>
              <span className="font-semibold text-foreground">
                {new Date(profile.created_at).toLocaleDateString("en-NA", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
type DashTab = "bookings" | "loyalty" | "profile";

const UserDashboard = () => {
  const [bookings,     setBookings]     = useState<Booking[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [profile,      setProfile]      = useState<UserProfile | null>(null);
  const [userId,       setUserId]       = useState<string | null>(null);
  const [activeTab,    setActiveTab]    = useState<DashTab>("bookings");
  const [showAbout,    setShowAbout]    = useState(false);
  const [referralEnabled, setReferralEnabled] = useState(true);
  const [aboutTab,     setAboutTab]     = useState<"about"|"team"|"tc">("about");
  const [editTarget,   setEditTarget]   = useState<Booking | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  // Photos
  const [bookingImages, setBookingImages] = useState<Record<string, BookingImage[]>>({});
  const [imagesLightbox, setImagesLightbox] = useState<BookingImage | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getSessionUser().then(async (user) => {
      if (!user) { navigate("/auth"); return; }
      setUserId(user.id);
      const [p, data, refEnabled] = await Promise.all([
        getUserProfile(user.id).catch(() => null),
        getUserBookings(user.id).catch(() => []),
        getBoolSetting(SETTINGS_KEYS.REFERRAL_SYSTEM_ENABLED, true),
      ]);
      setProfile(p);
      setBookings(data);
      setReferralEnabled(refEnabled);
      setLoading(false);
    });
  }, [navigate]);

  // Realtime: bookings
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`user-bookings-${userId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `customer_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            const updated = normalizeBooking(payload.new);
            setBookings(prev => prev.map(b => b.id === updated.id ? updated : b));
            setEditTarget(prev   => prev?.id === updated.id ? null : prev);
            setCancelTarget(prev => prev?.id === updated.id ? null : prev);
          } else if (payload.eventType === "INSERT") {
            setBookings(prev => [normalizeBooking(payload.new), ...prev]);
          } else if (payload.eventType === "DELETE") {
            const id = (payload.old as any).id;
            setBookings(prev => prev.filter(b => b.id !== id));
            setEditTarget(prev   => prev?.id === id ? null : prev);
            setCancelTarget(prev => prev?.id === id ? null : prev);
          }
        })
      .on("postgres_changes",
        { event: "*", schema: "public", table: "booking_images" },
        (payload) => {
          const bookingId = (payload.new as any)?.booking_id || (payload.old as any)?.booking_id;
          if (bookingId && bookingImages[bookingId] !== undefined) {
            // Refresh the images for this booking
            getBookingImages(bookingId)
              .then(imgs => setBookingImages(prev => ({ ...prev, [bookingId]: imgs })))
              .catch(() => {});
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const handleSaved = (updated: Booking) => {
    setBookings(prev => prev.map(b => b.id === updated.id ? updated : b));
    setEditTarget(null);
  };

  const handleCancelled = (bookingId: string, newStatus: "cancelled"|"late_cancelled") => {
    setBookings(prev => prev.map(b =>
      b.id === bookingId ? { ...b, status: newStatus, late_cancel: newStatus === "late_cancelled", cancelled_at: new Date().toISOString() } : b
    ));
    setCancelTarget(null);
  };

  return (
    <div className="min-h-screen car-pattern-bg">
      {showAbout && <AboutModal initialTab={aboutTab} onClose={() => setShowAbout(false)} />}

      {/* Photo lightbox */}
      <AnimatePresence>
        {imagesLightbox && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setImagesLightbox(null)}
          >
            <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              onClick={() => setImagesLightbox(null)}>
              <XCircle className="w-5 h-5" />
            </button>
            <motion.img
              initial={{ scale: 0.85 }} animate={{ scale: 1 }}
              src={imagesLightbox.signedUrl || ""}
              alt="Job photo"
              className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editTarget && <EditModal key={editTarget.id} booking={editTarget} onClose={() => setEditTarget(null)} onSaved={handleSaved} />}
      </AnimatePresence>

      <AnimatePresence>
        {cancelTarget && (() => {
          const flags = getEditability(cancelTarget);
          return (
            <CancelModal key={cancelTarget.id} booking={cancelTarget} isLateZone={flags.isLateCancelZone}
              minutesLeft={flags.minutesLeft} onClose={() => setCancelTarget(null)}
              onCancelled={(ns) => handleCancelled(cancelTarget.id!, ns)} />
          );
        })()}
      </AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground px-3 sm:px-6 py-2.5 flex items-center justify-between shadow-lg gap-2">
        <button onClick={() => window.location.reload()} className="flex items-center gap-2 min-w-0">
          <div className="bg-[#0a1628] rounded-xl p-1 flex-shrink-0 flex items-center justify-center">
            <img src={logo} alt="Oasis" className="h-9 w-auto object-contain drop-shadow-md" />
          </div>
          <div className="min-w-0 hidden sm:block">
            <h1 className="font-display font-bold text-base leading-tight truncate">
              {activeTab === "loyalty" ? "Loyalty" : activeTab === "profile" ? "My Profile" : "My Bookings"}
            </h1>
            <p className="text-xs text-primary-foreground/60 truncate">{profile?.full_name || "Dashboard"}</p>
          </div>
        </button>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <button onClick={() => { setAboutTab("about"); setShowAbout(true); }}
            className="bg-white/15 text-white px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1 hover:bg-white/25 transition">
            <span className="hidden sm:inline">✨ </span>About
          </button>
          <Link to="/" className="text-xs sm:text-sm text-primary-foreground/80 hover:text-primary-foreground transition flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Book</span>
          </Link>
          <button onClick={async () => { await logout(); navigate("/auth"); }}
            className="bg-red-600 text-white px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 hover:bg-red-700 transition">
            <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="sticky top-[52px] z-40 bg-card border-b border-border shadow-sm">
        <div className="max-w-3xl mx-auto px-2 sm:px-4 flex gap-0 overflow-x-auto scrollbar-none">
          {([
            { key: "bookings", label: "My Bookings", icon: Calendar },
            { key: "loyalty",  label: "Loyalty",     icon: Award },
            { key: "profile",  label: "Profile",     icon: User },
          ] as { key: DashTab; label: string; icon: any }[]).map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-bold transition border-b-2 whitespace-nowrap ${
                activeTab === t.key
                  ? "border-secondary text-secondary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6 relative z-10">
        <AnimatePresence mode="wait">
          {activeTab === "profile" ? (
            <motion.div key="profile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              {profile && (
                <ProfileTab
                  profile={profile}
                  onUpdated={updated => setProfile(updated)}
                />
              )}
            </motion.div>
          ) : activeTab === "loyalty" ? (
            <motion.div key="loyalty" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              {userId && <LoyaltyPanel userId={userId} referralEnabled={referralEnabled} />}
              <SubscriptionCard />
            </motion.div>
          ) : (
            <motion.div key="bookings" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-secondary" />
                </div>
              ) : bookings.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <div className="w-16 h-12 mx-auto mb-4 flex items-center justify-center opacity-50">
                    <img src={logo} alt="" className="w-full h-full object-contain" />
                  </div>
                  <p className="font-semibold">No bookings yet</p>
                  <p className="text-sm mb-6">Book your first wash to start earning loyalty points.</p>
                  <Link to="/" className="bg-secondary text-secondary-foreground px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition">
                    Book Now
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {bookings.map((b) => {
                    const cfg        = STATUS_CONFIG[b.status] || STATUS_CONFIG.pending;
                    const flags      = getEditability(b);
                    const StatusIcon = cfg.icon;
                    const terminal   = !flags.canCancel;
                    const allLocked  = !flags.canEditSchedule && !flags.canEditLocation;

                    return (
                      <motion.div key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-card rounded-xl shadow-card overflow-hidden">
                        <div className="px-5 py-4 flex items-center justify-between gap-3">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${cfg.color}`}>
                            <StatusIcon className="w-3.5 h-3.5" /> {cfg.label}
                          </span>
                          <div className="flex items-center gap-2">
                            {b.is_free_wash && (
                              <span className="flex items-center gap-1 text-xs font-bold text-green-600">
                                <Gift className="w-3 h-3" /> Free
                              </span>
                            )}
                            {b.isVip && (
                              <span className="flex items-center gap-1 text-xs font-bold text-orange-600">
                                <Star className="w-3 h-3 fill-current" /> VIP
                              </span>
                            )}
                            <span className="font-display font-bold text-secondary text-lg">
                              {b.is_free_wash ? "FREE" : `N$ ${b.totalPrice || b.price}`}
                            </span>
                          </div>
                        </div>

                        <div className="px-5 pb-4 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="w-4 h-4 shrink-0" /> {b.date || b.booking_date}</div>
                            <div className="flex items-center gap-2 text-muted-foreground"><Clock className="w-4 h-4 shrink-0" /> {b.time || b.time_slot}</div>
                            <div className="flex items-center gap-2 text-muted-foreground"><CreditCard className="w-4 h-4 shrink-0" /> {b.paymentType || "N/A"}</div>
                            {(b.latitude && b.longitude) && (
                              <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="w-4 h-4 shrink-0" /><span className="truncate">{b.area_name || b.address || "Location set"}</span></div>
                            )}
                          </div>

                          {b.vehicles && b.vehicles.length > 0 && (
                            <div className="pt-2 border-t border-border/60 space-y-1">
                              {b.vehicles.map((v, i) => (
                                <p key={i} className="text-xs text-muted-foreground">
                                  <span className="font-semibold text-foreground">{v.plateNumber}</span>{" "}({v.vehicleCategory}) — {v.services.join(", ")}
                                </p>
                              ))}
                            </div>
                          )}

                          {(b.status === "cancelled" || b.status === "late_cancelled") && b.cancelled_at && (
                            <div className="pt-2 border-t border-border/60 text-xs text-muted-foreground">
                              Cancelled: {toNamibiaDisplay(b.cancelled_at)}
                              {b.late_cancel && (
                                <span className="ml-2 inline-flex items-center gap-1 text-amber-600 font-semibold">
                                  <AlertTriangle className="w-3 h-3" /> Late cancel
                                </span>
                              )}
                            </div>
                          )}

                          {/* Job Photos — only on completed bookings */}
                          {b.status === "completed" && (() => {
                            const imgs = bookingImages[b.id!];
                            const hasImgs = imgs && imgs.length > 0;
                            return (
                              <div className="pt-2 border-t border-border/60">
                                <button
                                  onClick={() => {
                                    if (imgs !== undefined) return; // already loaded
                                    getBookingImages(b.id!)
                                      .then(r => setBookingImages(prev => ({ ...prev, [b.id!]: r })))
                                      .catch(() => setBookingImages(prev => ({ ...prev, [b.id!]: [] })));
                                  }}
                                  className="text-xs text-muted-foreground flex items-center gap-1.5 hover:text-foreground transition"
                                >
                                  <Camera className="w-3.5 h-3.5" />
                                  {imgs === undefined ? "View job photos" : hasImgs ? `${imgs.length} job photo${imgs.length !== 1 ? "s" : ""}` : "No photos"}
                                </button>
                                {hasImgs && (
                                  <div className="grid grid-cols-4 gap-1.5 mt-2">
                                    {imgs.map(img => (
                                      <div key={img.id} className="aspect-square rounded-lg overflow-hidden bg-muted border border-border cursor-pointer"
                                        onClick={() => setImagesLightbox(img)}>
                                        {img.signedUrl
                                          ? <img src={img.signedUrl} alt="" loading="lazy" className="w-full h-full object-cover hover:brightness-90 transition" />
                                          : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-4 h-4 opacity-30" /></div>
                                        }
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Review prompt — completed, eligible, not yet reviewed */}
                          {b.status === "completed" && (b as any).review_eligible && !(b as any).review_submitted && (
                            <ReviewPrompt
                              bookingId={b.id!}
                              onReviewed={() => {
                                setBookings(prev => prev.map(bk =>
                                  bk.id === b.id ? { ...bk, review_submitted: true } as any : bk
                                ));
                              }}
                            />
                          )}

                          {!terminal && (
                            <div className="pt-2 border-t border-border/60 flex items-center gap-2 flex-wrap">
                              {flags.minutesLeft < 60 && !flags.isPast && (
                                <span className="text-xs text-amber-600 font-medium mr-auto">Service in {formatMinsLeft(flags.minutesLeft)}</span>
                              )}
                              <button onClick={() => setEditTarget(b)} disabled={allLocked}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition
                                  ${allLocked ? "opacity-40 cursor-not-allowed bg-muted text-muted-foreground" : "bg-secondary/15 text-secondary hover:bg-secondary/25"}`}>
                                <Edit2 className="w-3 h-3" /> Edit {allLocked && <Lock className="w-2.5 h-2.5 opacity-60" />}
                              </button>
                              <button onClick={() => setCancelTarget(b)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition
                                  ${flags.isLateCancelZone
                                    ? "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
                                    : "bg-destructive/10 text-destructive hover:bg-destructive/20"}`}>
                                <XCircle className="w-3 h-3" /> Cancel {flags.isLateCancelZone && <AlertTriangle className="w-2.5 h-2.5" />}
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <CopyrightFooter />
      <WinnyChatbot />
    </div>
  );
};

export default UserDashboard;
