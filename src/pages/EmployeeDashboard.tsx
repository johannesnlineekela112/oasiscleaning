/**
 * EmployeeDashboard.tsx
 *
 * Changes from previous version:
 *   • Removed Revenue card (admin-only concern)
 *   • Commission uses original_price for free-wash bookings so employees
 *     still earn on the service value even though the customer paid N$ 0
 *   • Added Job Photos section in expanded booking detail
 *   • Realtime subscriptions: bookings + booking_images
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { CopyrightFooter } from "@/components/CopyrightFooter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogOut, Calendar, Clock, CreditCard, Loader2,
  CheckCircle, DollarSign, MapPin, Briefcase, Phone,
  Camera, Upload, X, Trash2, ImageIcon, ChevronDown, Gift,
  ReceiptText, History as HistoryIcon, Bell,
} from "lucide-react";
import {
  Booking, getEmployeeBookings, updateBookingStatus, getCommissionPercent,
  normalizeBooking,
} from "@/lib/bookingService";
import {
  BookingImage, uploadJobPhoto, getBookingImages, deleteJobPhoto,
  validateImageFile, MAX_IMAGES_PER_JOB,
} from "@/lib/imageService";
import { getSessionUser, logout, getUserProfile, UserProfile } from "@/lib/authService";
import {
  CommissionSummary, fetchMyCommissionHistory,
  monthName, STATUS_CONFIG as PAYOUT_STATUS_CONFIG,
} from "@/lib/commissionService";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import MapPicker from "@/components/MapPicker";
import logo from "@/assets/logo-car.png";
import { AboutModal } from "@/components/AboutModal";
import { useToastQueue, NotificationToastStack } from "@/components/NotificationToast";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:        { label: "Pending",            color: "bg-orange-100 text-orange-700" },
  confirmed:      { label: "Confirmed",          color: "bg-blue-100 text-blue-700" },
  in_progress:    { label: "Paid / In Progress", color: "bg-blue-100 text-blue-700" },
  completed:      { label: "Completed",          color: "bg-green-100 text-green-700" },
  cancelled:      { label: "Cancelled",          color: "bg-red-100 text-red-600" },
  late_cancelled: { label: "Late Cancelled",     color: "bg-amber-100 text-amber-700" },
};

// ─── Commission helper ────────────────────────────────────────────────────────
/**
 * Returns the commission base for a booking.
 *
 * Free wash rule: employees earn commission on the SERVICE VALUE, not the
 * amount the customer actually paid. This is fair — the employee did the
 * same work regardless of how the customer paid.
 *
 * original_price is set at booking creation time and is never zeroed.
 */
function commissionBase(booking: Booking): number {
  if (booking.is_free_wash && booking.original_price && booking.original_price > 0) {
    return booking.original_price;
  }
  return booking.totalPrice || booking.price || 0;
}

// ─── Job Photos Component — with preview-before-upload ───────────────────────
interface StagedFile {
  file:     File;
  preview:  string;  // object URL
  error:    string | null;
}

const JobPhotos = ({
  bookingId,
  uploaderId,
  isCompleted,
}: {
  bookingId:   string;
  uploaderId:  string;
  isCompleted: boolean;
}) => {
  const [images,      setImages]      = useState<BookingImage[]>([]);
  const [staged,      setStaged]      = useState<StagedFile[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [uploading,   setUploading]   = useState(false);
  const [uploadErr,   setUploadErr]   = useState<string | null>(null);
  const [lightbox,    setLightbox]    = useState<BookingImage | null>(null);
  const [dragOver,    setDragOver]    = useState(false);
  const fileInputRef                  = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setImages(await getBookingImages(bookingId)); }
    catch { /* silent — RLS will prevent unauthorised reads */ }
    setLoading(false);
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  // Cleanup object URLs when staged files change
  useEffect(() => {
    return () => { staged.forEach(s => URL.revokeObjectURL(s.preview)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: new images from other devices / admin uploads
  useEffect(() => {
    const ch = supabase
      .channel(`job-photos-${bookingId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "booking_images", filter: `booking_id=eq.${bookingId}` },
        () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [bookingId, load]);

  const stageFiles = (files: File[]) => {
    setUploadErr(null);
    const slots = MAX_IMAGES_PER_JOB - images.length - staged.length;
    if (slots <= 0) { setUploadErr(`Maximum ${MAX_IMAGES_PER_JOB} photos per booking.`); return; }
    const batch = files.slice(0, slots);
    const newStaged: StagedFile[] = batch.map(file => {
      const v = validateImageFile(file);
      return {
        file,
        preview: URL.createObjectURL(file),
        error:   v.valid ? null : v.errors.join(", "),
      };
    });
    setStaged(prev => [...prev, ...newStaged]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    stageFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type === "image/jpeg" || f.type === "image/png" || f.type === "image/webp"
    );
    stageFiles(files);
  };

  const removeStaged = (idx: number) => {
    setStaged(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleUploadAll = async () => {
    const valid = staged.filter(s => !s.error);
    if (!valid.length) return;
    setUploading(true);
    setUploadErr(null);
    const errors: string[] = [];
    for (const s of valid) {
      try {
        const { image } = await uploadJobPhoto(bookingId, uploaderId, s.file);
        setImages(prev => [...prev, image]);
      } catch (err: any) {
        errors.push(err?.message || "Upload failed");
      }
    }
    // Clean up staged
    staged.forEach(s => URL.revokeObjectURL(s.preview));
    setStaged([]);
    if (errors.length) setUploadErr(errors.join(" · "));
    setUploading(false);
  };

  const handleDelete = async (img: BookingImage) => {
    if (!confirm("Delete this photo?")) return;
    try {
      await deleteJobPhoto(img.id);
      setImages(prev => prev.filter(i => i.id !== img.id));
    } catch (err: any) {
      setUploadErr(err?.message || "Delete failed");
    }
  };

  const canUpload = isCompleted && (images.length + staged.length) < MAX_IMAGES_PER_JOB;
  const hasStaged = staged.length > 0;
  const validStaged = staged.filter(s => !s.error);

  return (
    <div className="space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5" /> Job Photos
          {(images.length + staged.length) > 0 && (
            <span className="ml-1">{images.length + staged.length}/{MAX_IMAGES_PER_JOB}</span>
          )}
        </h4>
        {!isCompleted && (
          <span className="text-xs text-muted-foreground italic">Complete booking first to upload photos</span>
        )}
      </div>

      {/* Drop zone + Browse button */}
      {isCompleted && canUpload && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-4 text-center transition ${
            dragOver ? "border-secondary bg-secondary/10" : "border-border hover:border-secondary/50"
          }`}
        >
          <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground mb-1">Drag & drop photos here</p>
          <p className="text-xs text-muted-foreground mb-3">JPEG, PNG, WebP · max 5 MB each · up to {MAX_IMAGES_PER_JOB} total</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-bold hover:opacity-90 transition"
          >
            <ImageIcon className="w-3.5 h-3.5" /> Browse Files
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={handleFileChange}
      />

      {uploadErr && (
        <div className="flex items-start gap-2 p-2.5 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
          <X className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {uploadErr}
        </div>
      )}

      {/* Staged preview area */}
      {hasStaged && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-foreground/70 uppercase tracking-wider">
              Ready to upload ({validStaged.length} valid)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { staged.forEach(s => URL.revokeObjectURL(s.preview)); setStaged([]); }}
                className="px-2 py-1 rounded text-xs font-semibold text-destructive hover:bg-destructive/10 transition"
              >
                Clear all
              </button>
              <button
                onClick={handleUploadAll}
                disabled={uploading || validStaged.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-bold hover:opacity-90 transition disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                {uploading ? "Uploading…" : `Upload ${validStaged.length}`}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {staged.map((s, idx) => (
              <div key={idx} className={`relative aspect-square rounded-lg overflow-hidden border-2 ${s.error ? "border-destructive" : "border-secondary/40"}`}>
                <img src={s.preview} alt="Preview" className="w-full h-full object-cover" />
                {s.error && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-1">
                    <p className="text-[10px] text-white text-center">{s.error}</p>
                  </div>
                )}
                <button
                  onClick={() => removeStaged(idx)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/80 text-white flex items-center justify-center hover:bg-destructive transition"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uploaded photos */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading photos…
        </div>
      ) : images.length === 0 && !hasStaged ? (
        <div className="text-center py-4 text-muted-foreground">
          <p className="text-xs">{isCompleted ? "No uploaded photos yet" : "No photos uploaded"}</p>
        </div>
      ) : images.length > 0 ? (
        <>
          <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">Uploaded</p>
          <div className="grid grid-cols-3 gap-2">
            {images.map(img => (
              <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden bg-muted border border-border">
                {img.signedUrl ? (
                  <img
                    src={img.signedUrl}
                    alt="Job photo"
                    loading="lazy"
                    className="w-full h-full object-cover cursor-pointer transition group-hover:brightness-90"
                    onClick={() => setLightbox(img)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 opacity-30" />
                  </div>
                )}
                {img.uploaded_by === uploaderId && (
                  <button
                    onClick={() => handleDelete(img)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightbox(null)}
          >
            <button
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
              onClick={() => setLightbox(null)}
            >
              <X className="w-5 h-5" />
            </button>
            <motion.img
              initial={{ scale: 0.85 }} animate={{ scale: 1 }}
              src={lightbox.signedUrl || ""}
              alt="Job photo"
              className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const EmployeeDashboard = () => {
  const [bookings,          setBookings]          = useState<Booking[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [profile,           setProfile]           = useState<UserProfile | null>(null);
  const [userId,            setUserId]            = useState<string | null>(null);
  const [commissionPercent, setCommissionPercent] = useState(20);
  const [tab,               setTab]               = useState<"active" | "completed" | "payouts">("active");
  const [payoutHistory,     setPayoutHistory]     = useState<CommissionSummary[]>([]);
  const [payoutHistLoading, setPayoutHistLoading] = useState(false);
  const [expandedId,        setExpandedId]        = useState<string | null>(null);
  const [showAbout,         setShowAbout]         = useState(false);
  const navigate = useNavigate();
  const { toasts, pushToast, dismissToast } = useToastQueue();

  useEffect(() => {
    getSessionUser().then(async (user) => {
      if (!user) { navigate("/auth"); return; }
      const p = await getUserProfile(user.id);
      if (!p || (p.role !== "employee" && p.role !== "admin")) {
        navigate("/auth"); return;
      }
      setProfile(p);
      setUserId(user.id);
      try {
        const [data, pct] = await Promise.all([
          getEmployeeBookings(user.id),
          getCommissionPercent(),
        ]);
        setBookings(data);
        setCommissionPercent(pct);
      } catch { /* */ }
      setLoading(false);
    });
  }, [navigate]);

  // Realtime: bookings assigned to this employee
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`employee-bookings-${userId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `assigned_employee_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            const updated = normalizeBooking(payload.new);
            const oldRow  = payload.old as any;
            setBookings(prev => {
              const exists = prev.some(b => b.id === updated.id);
              return exists
                ? prev.map(b => b.id === updated.id ? updated : b)
                : [updated, ...prev];
            });
            // Alert on status change
            if (oldRow.status && oldRow.status !== (payload.new as any).status) {
              const newStatus = ((payload.new as any).status as string).replace(/_/g, " ");
              pushToast(
                "job_updated",
                "Job Status Updated",
                `${updated.fullName} — ${updated.date} → ${newStatus}`
              );
            }
          } else if (payload.eventType === "INSERT") {
            const inserted = normalizeBooking(payload.new);
            setBookings(prev => [inserted, ...prev]);
            pushToast(
              "job_assigned",
              "New Job Assigned! 🚗",
              `${inserted.fullName} — ${inserted.date} at ${inserted.time}${inserted.address ? " · " + inserted.address : ""}`
            );
          } else if (payload.eventType === "DELETE") {
            const removed = payload.old as any;
            setBookings(prev => prev.filter(b => b.id !== removed.id));
            pushToast(
              "job_updated",
              "Job Removed from Your List",
              `A booking for ${removed.booking_date || "upcoming date"} was unassigned or cancelled`
            );
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, pushToast]);


  // Load commission history when tab = payouts
  useEffect(() => {
    if (tab !== "payouts") return;
    setPayoutHistLoading(true);
    fetchMyCommissionHistory()
      .then(setPayoutHistory)
      .catch(() => {})
      .finally(() => setPayoutHistLoading(false));
  }, [tab]);

  const activeBookings    = bookings.filter(b => b.status !== "completed" && b.status !== "cancelled" && b.status !== "late_cancelled");
  const completedBookings = bookings.filter(b => b.status === "completed");
  const displayed         = tab === "active" ? activeBookings : completedBookings;

  // ── Commission calculation ──────────────────────────────────────────────────
  // Uses original_price for free-wash bookings so employees earn on service value
  const totalCommission = Math.round(
    completedBookings.reduce((s, b) => s + commissionBase(b), 0) * (commissionPercent / 100)
  );
  const paidCommission = completedBookings.reduce((s, b) => s + (b.commission_amount || 0), 0);
  const owedCommission = Math.max(0, totalCommission - paidCommission);

  const [completeError, setCompleteError] = useState<string | null>(null);

  const handleComplete = async (id: string) => {
    setCompleteError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/complete-booking`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ booking_id: id }),
        }
      );
      const body = await res.json();
      if (!res.ok) {
        if (body.error === 'PHOTO_GATE') {
          setCompleteError(`Please upload at least ${body.required} photo(s) before marking complete. You have ${body.photo_count} uploaded.`);
        } else {
          setCompleteError(body.message ?? body.error ?? 'Failed to complete booking.');
        }
        return;
      }
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: "completed" as const } : b));
    } catch (err: any) {
      setCompleteError('Network error. Please try again.');
    }
  };

  return (
    <div className="min-h-screen car-pattern-bg">
      {showAbout && <AboutModal initialTab="about" onClose={() => setShowAbout(false)} />}

      {/* Notification toasts */}
      <NotificationToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground px-3 sm:px-4 py-2.5 flex items-center justify-between shadow-lg gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => window.location.reload()} className="flex-shrink-0 flex items-center justify-center">
            <img src={logo} alt="Oasis Pure Cleaning CC" className="h-9 w-auto object-contain" style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.45))" }} />
          </button>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-sm sm:text-base leading-tight truncate">Oasis Pure Cleaning CC</h1>
            <p className="text-xs text-primary-foreground/60 truncate">{profile?.full_name || "Employee"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <button onClick={() => setShowAbout(true)}
            className="bg-white/15 text-white px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1 hover:bg-white/25 transition">
            <span className="hidden sm:inline">✨ </span>About
          </button>
          <button onClick={async () => { await logout(); navigate("/auth"); }}
            className="bg-red-600 text-white px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 hover:bg-red-700 transition">
            <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6 relative z-10 pb-8">

        {/* Dashboard title */}
        <div className="mb-4 sm:mb-6">
          <h2 className="font-display font-bold text-base sm:text-lg text-foreground leading-tight">
            Employee Dashboard
          </h2>
          <p className="text-xs font-semibold text-foreground/60 uppercase tracking-widest mt-0.5">
            Oasis Pure Cleaning CC
          </p>
        </div>

        {/* Stats — Revenue removed; Total Jobs + Commission shown */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-6">
          {[
            { label: "Jobs Done",   value: completedBookings.length, icon: Briefcase, color: "text-secondary" },
            { label: `Commission (${commissionPercent}%)`, value: `N$ ${owedCommission}`, icon: DollarSign, color: owedCommission > 0 ? "text-green-600" : "text-muted-foreground" },
          ].map(s => (
            <div key={s.label} className="bg-card rounded-xl shadow-card p-4 text-center">
              <s.icon className={`w-5 h-5 mx-auto mb-1 ${s.color}`} />
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`font-display font-bold text-2xl leading-tight ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-none [-webkit-overflow-scrolling:touch]">
          {(["active", "completed", "payouts"] as const).map(t => (
            <button
              key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wide transition ${
                tab === t ? "bg-primary text-primary-foreground shadow-sm" : "bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {t === "active" ? `Active (${activeBookings.length})` : t === "completed" ? `Done (${completedBookings.length})` : "Payouts"}
            </button>
          ))}
        </div>

        {/* Booking cards — active & completed tabs only */}
        {tab !== "payouts" && (loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <div className="w-16 h-12 mx-auto mb-4 flex items-center justify-center opacity-50">
              <img src={logo} alt="" className="w-full h-full object-contain" />
            </div>
            <p className="font-semibold">{tab === "active" ? "No active jobs assigned" : "No completed jobs yet"}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map(b => {
              const cfg      = STATUS_CONFIG[b.status] || STATUS_CONFIG.pending;
              const expanded = expandedId === b.id;
              const thisCommission = Math.round(commissionBase(b) * (commissionPercent / 100));

              return (
                <motion.div key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-card rounded-xl shadow-card overflow-hidden">

                  {/* Summary */}
                  <div
                    className="px-4 py-3 flex items-center gap-2 cursor-pointer hover:bg-muted/20 transition"
                    onClick={() => setExpandedId(expanded ? null : b.id!)}
                  >
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${cfg.color}`}>{cfg.label}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-foreground truncate">{b.date} · {b.time}</p>
                      <p className="text-xs text-foreground/55 truncate">{b.address || b.fullName}</p>
                    </div>
                    {b.is_free_wash && (
                      <span className="flex items-center gap-1 text-xs font-bold text-green-600 shrink-0">
                        <Gift className="w-3 h-3" /> Free
                      </span>
                    )}
                    <span className="font-display font-bold text-secondary text-sm shrink-0">
                      {b.is_free_wash ? `N$ ${b.original_price || 0}` : `N$ ${b.totalPrice || b.price}`}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${expanded ? "rotate-180" : ""}`} />
                  </div>

                  {/* Expanded */}
                  {expanded && (
                    <div className="border-t border-border px-5 py-4 space-y-4">
                      <div className="grid grid-cols-1 gap-1.5 text-sm">
                        <div className="flex items-center gap-2"><Calendar className="w-4 h-4 shrink-0 text-secondary" /><span className="font-semibold text-foreground">{b.date}</span><span className="text-foreground/50 text-xs">at</span><span className="font-semibold text-foreground">{b.time}</span></div>
                        <div className="flex items-center gap-2 text-foreground/70"><CreditCard className="w-4 h-4 shrink-0 text-foreground/40" /><span className="truncate">{b.paymentType}</span></div>
                        <div className="flex items-center gap-2 text-foreground/70"><Phone className="w-4 h-4 shrink-0 text-foreground/40" /><a href={`tel:${b.whatsapp}`} className="hover:text-foreground transition font-medium">{b.whatsapp}</a></div>
                        <div className="flex items-center gap-2 text-xs text-foreground/50 font-medium uppercase tracking-wider pt-1 border-t border-border/40"><span>Client:</span><span className="text-foreground/70 normal-case tracking-normal font-semibold">{b.fullName}</span></div>
                      </div>

                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#FF8C00" }} /> {b.address}
                      </div>
                      {b.landmark && (
                        <p className="text-xs text-muted-foreground">📍 {b.landmark}</p>
                      )}

                      {b.vehicles?.map((v, i) => (
                        <div key={i} className="bg-muted/30 rounded-lg p-3 text-sm space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold">{v.plateNumber}</span>
                            <span className="text-muted-foreground text-xs">({v.vehicleCategory})</span>
                          </div>
                          <p className="text-muted-foreground text-xs leading-relaxed">{v.services.join(" · ")}</p>
                        </div>
                      ))}

                      {b.latitude && b.longitude && (
                        <MapPicker initialLat={b.latitude} initialLng={b.longitude} readOnly showDirections onLocationSelect={() => {}} />
                      )}

                      {/* Commission info */}
                      {tab === "completed" && (
                        <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">
                              Commission ({commissionPercent}% of N$ {commissionBase(b)}
                              {b.is_free_wash && <span className="ml-1 text-green-600 font-semibold">[service val]</span>})
                            </span>
                            {b.commission_amount
                              ? <span className="text-xs text-green-600 font-bold flex items-center gap-1 shrink-0"><CheckCircle className="w-3 h-3" /> Paid</span>
                              : <span className="text-xs text-amber-600 font-bold shrink-0">Pending</span>
                            }
                          </div>
                          <p className="text-sm font-bold text-secondary">N$ {thisCommission}</p>
                        </div>
                      )}

                      {/* Complete button — only if paid */}
                      {tab === "active" && b.paid && b.status !== "completed" && (
                        <button
                          onClick={() => handleComplete(b.id!)}
                          className="w-full py-3 rounded-xl bg-green-100 text-green-700 font-bold text-sm hover:bg-green-200 transition flex items-center justify-center gap-2"
                        >
                          <CheckCircle className="w-5 h-5" /> Mark as Completed
                        </button>
                      )}
                      {/* Photo gate error */}
                      {completeError && (
                        <div className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 mt-1">
                          {completeError}
                        </div>
                      )}
                      {tab === "active" && !b.paid && (
                        <p className="text-xs text-muted-foreground text-center italic py-2">
                          Awaiting payment confirmation from admin
                        </p>
                      )}

                      {/* ── Job Photos ── */}
                      {userId && (
                        <div className="pt-3 border-t border-border">
                          <JobPhotos
                            bookingId={b.id!}
                            uploaderId={userId}
                            isCompleted={b.status === "completed"}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        ))}
        {/* end: booking cards (active / completed only) */}

        {/* ══════════════════ PAYOUTS TAB ══════════════════ */}
        {tab === "payouts" && (
          <div className="space-y-4">
            {payoutHistLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-secondary" />
              </div>
            ) : (
              <>
                {/* ── Accumulated since last payout ── */}
                {(() => {
                  const lastPaid  = payoutHistory.find(s => s.payout_status === "paid");
                  const unpaid    = payoutHistory.filter(s => s.payout_status !== "paid");
                  const accumJobs = unpaid.reduce((s, p) => s + Number(p.total_jobs), 0);
                  const accumComm = unpaid.reduce((s, p) => s + Number(p.total_commission), 0);
                  const accumRev  = unpaid.reduce((s, p) => s + Number(p.total_revenue), 0);
                  const allJobs   = payoutHistory.reduce((s, p) => s + Number(p.total_jobs), 0);
                  return (
                    <div className="rounded-2xl overflow-hidden shadow-card border border-border">
                      {/* Hero strip — commission focus */}
                      <div className="bg-primary px-5 py-5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground/50 mb-2">
                          Accumulated Commission Since Last Payout
                        </p>
                        <p className="font-display font-bold text-4xl text-secondary leading-none mb-1">
                          N$ {accumComm.toFixed(2)}
                        </p>
                        <p className="text-xs text-primary-foreground/60 font-medium">
                          {commissionPercent}% of N$ {accumRev.toFixed(2)} revenue · {accumJobs} job{accumJobs !== 1 ? "s" : ""} completed
                        </p>
                      </div>
                      {/* Stats row */}
                      <div className="grid grid-cols-3 divide-x divide-border bg-card">
                        <div className="px-4 py-3 text-center">
                          <p className="font-display font-bold text-2xl text-secondary">{accumJobs}</p>
                          <p className="text-xs text-muted-foreground font-semibold mt-0.5">Jobs Pending</p>
                        </div>
                        <div className="px-4 py-3 text-center">
                          <p className="font-display font-bold text-2xl text-foreground">N$ {accumRev.toFixed(0)}</p>
                          <p className="text-xs text-muted-foreground font-semibold mt-0.5">Revenue</p>
                        </div>
                        <div className="px-4 py-3 text-center">
                          <p className="font-display font-bold text-2xl text-foreground">{allJobs}</p>
                          <p className="text-xs text-muted-foreground font-semibold mt-0.5">All-Time Jobs</p>
                        </div>
                      </div>
                      {/* Last paid callout */}
                      {lastPaid && (
                        <div className="px-5 py-3 bg-green-50 dark:bg-green-900/15 border-t border-border flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                          <p className="text-xs font-semibold text-green-700 dark:text-green-400">
                            Last paid: {monthName(lastPaid.month)} {lastPaid.year} — N$ {Number(lastPaid.total_commission).toFixed(2)}
                            {lastPaid.paid_at && ` on ${new Date(lastPaid.paid_at).toLocaleDateString("en-NA")}`}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── All-time totals ── */}
                <div className="bg-card rounded-xl shadow-card px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 border border-border/60">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">All-Time Earned (Paid)</p>
                    <p className="font-display font-bold text-xl text-secondary mt-0.5">
                      N$ {payoutHistory.filter(s => s.payout_status === "paid").reduce((sum, s) => sum + Number(s.total_commission), 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Lifetime Jobs</p>
                    <p className="font-display font-bold text-xl text-foreground mt-0.5">
                      {payoutHistory.reduce((s, p) => s + Number(p.total_jobs), 0)}
                    </p>
                  </div>
                </div>

                {/* ── Per-period breakdown ── */}
                {payoutHistory.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ReceiptText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-semibold">No commission summaries yet</p>
                    <p className="text-xs mt-1">Summaries are generated by admin monthly.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Period Breakdown</p>
                    {payoutHistory.map(summary => {
                      const sc = PAYOUT_STATUS_CONFIG[summary.payout_status] ?? PAYOUT_STATUS_CONFIG.pending;
                      return (
                        <div key={summary.id} className="bg-card rounded-xl shadow-card overflow-hidden">
                          <div className="px-4 py-3 flex items-center gap-3">
                            {/* Period */}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm">{monthName(summary.month)} {summary.year}</p>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                                <span className="text-xs text-muted-foreground">{summary.total_jobs} jobs</span>
                                <span className="text-xs text-muted-foreground">Rev N$ {Number(summary.total_revenue).toFixed(0)}</span>
                                <span className="text-xs text-muted-foreground">{summary.commission_rate ?? 20}% rate</span>
                              </div>
                            </div>
                            {/* Commission + status */}
                            <div className="text-right shrink-0">
                              <p className="font-display font-bold text-base text-secondary">N$ {Number(summary.total_commission).toFixed(2)}</p>
                              <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${sc.bg} ${sc.color}`}>{sc.label}</span>
                            </div>
                          </div>
                          {(summary.paid_at || summary.notes) && (
                            <div className="px-4 pb-3 space-y-0.5">
                              {summary.paid_at && (
                                <p className="text-xs text-green-600 font-semibold flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" /> Paid {new Date(summary.paid_at).toLocaleDateString("en-NA")}
                                </p>
                              )}
                              {summary.notes && <p className="text-xs text-muted-foreground italic">{summary.notes}</p>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <CopyrightFooter />
    </div>
  );
};

export default EmployeeDashboard;
