import { useState, useEffect, useRef } from "react";
import { CopyrightFooter } from "@/components/CopyrightFooter";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, CheckCircle, Send, Loader2, Plus, X, LogIn,
  User as UserIcon, LogOut, Sparkles, Clock, ChevronDown, Star, Gift,
} from "lucide-react";
import {
  VEHICLE_CATEGORIES, TIME_SLOTS, ServiceRow,
  isServiceAllowed, calculateVehicleTotal, calculateTotal,
  buildPricingMatrix, fetchActiveServices,
  isValidWhatsApp, getBookedSlots, submitBooking, isVipTime, VehicleEntry,
  isSlotInPast, todayInNamibia, LEAD_TIME_MINUTES,
} from "@/lib/bookingService";
import {
  fetchMyLoyalty, fetchMyRedemptions, attachFreeWashToBooking,
  FREE_WASH_COST, FreeWashRedemption, formatExpiry,
} from "@/lib/loyaltyService";
import MapPicker from "@/components/MapPicker";
import { AboutModal, TCCheckbox } from "@/components/AboutModal";
import { BannerAds, InlineAds, PopupAd, SidebarAd } from "@/components/AdsDisplay";
import { MarketingAd, fetchActiveAds } from "@/lib/adService";
import { supabase } from "@/lib/supabase";
import { onAuthChange, getSessionUser, getUserProfile, logout } from "@/lib/authService";
import type { User } from "@supabase/supabase-js";
import { Link, useNavigate } from "react-router-dom";
import logo from "@/assets/logo-car.png";
import WinnyChatbot from "@/components/WinnyChatbot";
import { guardAction, recordFailure, isEmailVerified } from "@/lib/botProtection";
import PaymentPanel, { type PaymentMethod as PMethod, type PaymentSelection } from "@/components/PaymentPanel";
import { SignUpBanner, SignUpModal } from "@/components/SignUpConversion";
import { getBusinessSettings, type PaymentDetails } from "@/lib/businessService";
import { getTimeslots, type TimeSlotSetting } from "@/lib/settingsService";
import { supabase as supabaseClient } from "@/lib/supabase";

// todayInNamibia() is the canonical "today" for this app.
// It shifts UTC by +2 h (CAT, no DST) before slicing to YYYY-MM-DD so it
// is correct regardless of the user's device timezone or browser locale.
// It replaces the previous `new Date().toISOString().split("T")[0]` which
// returned UTC midnight — wrong for any device not already in CAT.
const today = todayInNamibia;

const emptyVehicle = (): VehicleEntry => ({
  plateNumber: "",
  vehicleCategory: "small",
  services: [],
  subtotal: 0,
});

// ─── Time slot dropdown ────────────────────────────────────────────────────────
const TimeSlotDropdown = ({
  value,
  onChange,
  bookedSlots,
  pastSlots,
  disabled,
}: {
  value:       string;
  onChange:    (v: string) => void;
  bookedSlots: string[];
  pastSlots:   string[];        // slots disabled due to time — computed by parent
  disabled?:   boolean;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected    = TIME_SLOTS.find(s => s.value === value);
  // If the currently-selected slot has since become past, show a warning in the trigger
  const selectedIsPast = !!selected && pastSlots.includes(selected.value);

  return (
    <div ref={ref} className="relative">
      {/* ── Trigger button ── */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition ${
          disabled
            ? "border-border bg-muted text-muted-foreground cursor-not-allowed"
            : selectedIsPast
            ? "border-amber-400/60 bg-amber-50 dark:bg-amber-900/10 hover:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
            : "border-border bg-background hover:border-secondary/50 focus:outline-none focus:ring-2 focus:ring-secondary/50"
        }`}
      >
        <div className="flex items-center gap-2">
          <Clock className={`w-4 h-4 ${selectedIsPast ? "text-amber-500" : "text-muted-foreground"}`} />
          {selected ? (
            <span className={
              selectedIsPast
                ? "text-amber-700 dark:text-amber-400"
                : selected.value.startsWith("VIP")
                ? "text-orange-600 font-bold"
                : ""
            }>
              {selected.label}
              {bookedSlots.includes(selected.value) && " (Fully Booked)"}
              {selectedIsPast && !bookedSlots.includes(selected.value) && " (No Longer Available)"}
            </span>
          ) : (
            <span className="text-muted-foreground">
              {disabled ? "Select a date first" : "Select a time slot"}
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""} ${selectedIsPast ? "text-amber-400" : "text-muted-foreground"}`} />
      </button>

      {/* ── Lead-time notice ── */}
      {pastSlots.length > 0 && !disabled && (
        <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3 shrink-0" />
          Slots marked "Past" require {LEAD_TIME_MINUTES}-min notice and can't be booked today.
        </p>
      )}

      {/* ── Dropdown panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
          >
            {(dynamicSlots ?? TIME_SLOTS).map((slot) => {
              const booked = bookedSlots.includes(slot.value);
              const past   = pastSlots.includes(slot.value);
              // A slot is unavailable if it is booked OR past
              const unavailable = booked || past;
              const isVip  = slot.value.startsWith("VIP");
              const isSelected = value === slot.value;

              return (
                <button
                  key={slot.value}
                  type="button"
                  disabled={unavailable}
                  onClick={() => { if (!unavailable) { onChange(slot.value); setOpen(false); } }}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm text-left border-b border-border/40 last:border-0 transition ${
                    isSelected && !unavailable
                      ? "bg-secondary/15 font-bold"
                      : booked
                      ? "bg-muted/40 text-muted-foreground cursor-not-allowed opacity-60"
                      : past
                      ? "bg-amber-50/60 dark:bg-amber-900/10 text-muted-foreground cursor-not-allowed opacity-70"
                      : isVip
                      ? "hover:bg-orange-50 text-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/20"
                      : "hover:bg-muted/60"
                  }`}
                >
                  {/* ── Left: icon + label ── */}
                  <span className={`flex items-center gap-2 ${(booked || past) ? "line-through" : ""}`}>
                    {isVip && <Star className="w-3.5 h-3.5 fill-current shrink-0" />}
                    {slot.label}
                  </span>

                  {/* ── Right: status badge ── */}
                  {booked && (
                    <span className="text-xs bg-destructive/15 text-destructive px-2 py-0.5 rounded-full font-semibold shrink-0">
                      Full
                    </span>
                  )}
                  {past && !booked && (
                    <span className="text-xs bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold shrink-0">
                      Past
                    </span>
                  )}
                  {!unavailable && isVip && (
                    <span className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 rounded-full font-semibold shrink-0">
                      1.5×
                    </span>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Thank-you popup ───────────────────────────────────────────────────────────
const ThankYouPopup = ({
  total,
  fullName,
  date,
  time,
  onNewBooking,
}: {
  total: number;
  fullName: string;
  date: string;
  time: string;
  onNewBooking: () => void;
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
  >
    <motion.div
      initial={{ scale: 0.8, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="bg-card rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center relative overflow-hidden"
    >
      {/* Decorative background rings */}
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-10" style={{ background: "#FF8C00" }} />
      <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full opacity-10" style={{ background: "#FF8C00" }} />

      {/* Icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.15, type: "spring", stiffness: 400 }}
        className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-5 relative z-10"
        style={{ background: "linear-gradient(135deg, #FF8C00, #ffb347)" }}
      >
        <CheckCircle className="w-12 h-12 text-white" />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <h2 className="text-2xl font-display font-bold mb-1">Thank You, {fullName.split(" ")[0]}!</h2>
        <p className="text-muted-foreground text-sm mb-4">For choosing Oasis Pure Cleaning CC</p>

        <div className="bg-muted/40 rounded-2xl p-4 mb-5 text-sm space-y-1.5 text-left">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Date</span>
            <span className="font-semibold">{new Date(date + "T12:00:00").toLocaleDateString("en-NA", { weekday: "short", month: "short", day: "numeric" })}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Time</span>
            <span className="font-semibold">{time}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-1.5 mt-1.5">
            <span className="text-muted-foreground">Total</span>
            <span className="text-xl font-display font-bold" style={{ color: "#FF8C00" }}>N$ {total}</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mb-5">
          We'll confirm your booking via WhatsApp shortly. <br />
          <em className="font-semibold">We Come, You Shine! ✨</em>
        </p>

        <button
          onClick={onNewBooking}
          className="w-full py-3.5 rounded-2xl font-bold text-white transition hover:opacity-90 active:scale-95"
          style={{ background: "linear-gradient(135deg, #FF8C00, #ffb347)" }}
        >
          Book Another Vehicle
        </button>
      </motion.div>
    </motion.div>
  </motion.div>
);

// ─── Main component ───────────────────────────────────────────────────────────
const BookingPage = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const navigate = useNavigate();

  const [dbServices,     setDbServices]     = useState<ServiceRow[]>([]);
  const [servicesLoaded, setServicesLoaded] = useState(false);

  const [form, setForm] = useState({
    fullName: "", whatsapp: "+264", address: "", date: "", time: "",
    latitude:          null as number | null,
    longitude:         null as number | null,
    // ── Location enrichment (from MapPicker LocationResult) ──────────────────
    areaName:          "",      // suburb / neighbourhood extracted from geocoder
    landmark:          "",      // optional driver hint / special instructions
    locationConfirmed: false,   // true only after user clicks "Confirm This Location"
  });
  const [vehicles,    setVehicles]    = useState<VehicleEntry[]>([emptyVehicle()]);
  const [paymentSel,  setPaymentSel]  = useState<PaymentSelection>({ method: "cash", subtype: null, proofFile: null, proofPreviewUrl: null });
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails>({});
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [dynamicSlots, setDynamicSlots] = useState<TimeSlotSetting[] | null>(null);
  const [showAbout,   setShowAbout]   = useState(false);
  const [aboutTab,    setAboutTab]    = useState<"about"|"team"|"tc">("about");
  const [tcAccepted,  setTcAccepted]  = useState(false);
  const [tcError,     setTcError]     = useState("");
  // Bot protection
  const [honeypot,    setHoneypot]    = useState("");
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);

  // ─── Free wash state ────────────────────────────────────────────────────────
  // Loaded when an authenticated user is detected; only shown when they have
  // at least one 'reserved' redemption AND the booking is NOT VIP.
  const [reservedWashes,    setReservedWashes]    = useState<FreeWashRedemption[]>([]);
  const [useRedemptionId,   setUseRedemptionId]   = useState<string | null>(null);
  const [attachingWash,     setAttachingWash]     = useState(false);

  // ─── Marketing ads state ────────────────────────────────────────────────────
  // Fetched independently — never blocks booking flow, errors are silently ignored
  const [bannerAds,  setBannerAds]  = useState<MarketingAd[]>([]);
  const [inlineAds,  setInlineAds]  = useState<MarketingAd[]>([]);
  const [popupAds,   setPopupAds]   = useState<MarketingAd[]>([]);
  const [sidebarAds, setSidebarAds] = useState<MarketingAd[]>([]);

  const pricing = buildPricingMatrix(dbServices);
  const isVip   = isVipTime(form.time);
  const total   = calculateTotal(vehicles, isVip);

  // Auto-deselect free wash if user switches to a VIP time slot (ineligible)
  useEffect(() => {
    if (isVip && useRedemptionId) setUseRedemptionId(null);
  }, [isVip]);

  // Load active services from DB + subscribe to real-time changes
  useEffect(() => {
    // Load payment details from business_settings
    getBusinessSettings().then(s => setPaymentDetails(s.payment_details)).catch(() => {});

    // Initial load
    fetchActiveServices()
      .then(svcs => { setDbServices(svcs); setServicesLoaded(true); })
      .catch(() => setServicesLoaded(true));

    // Real-time subscription — updates services whenever admin saves changes
    const channel = supabase
      .channel("services-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "services" },
        () => {
          // Re-fetch active services whenever any service row changes
          fetchActiveServices()
            .then(svcs => setDbServices(svcs))
            .catch(() => {});
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Auth
  useEffect(() => {
    const unsub = onAuthChange(async (user) => {
      setCurrentUser(user);
      if (user) {
        const profile = await getUserProfile(user.id);
        if (profile) setForm(f => ({ ...f, fullName: profile.full_name || f.fullName }));
        // Load any reserved free washes this user has
        fetchMyRedemptions(user.id)
          .then(r => setReservedWashes(r.filter(x => x.status === "reserved")))
          .catch(() => {});
        // Check email verification
        isEmailVerified(user.id).then(setEmailVerified).catch(() => setEmailVerified(true));
      } else {
        setReservedWashes([]);
        setUseRedemptionId(null);
        setEmailVerified(null);
      }
    });
    return unsub;
  }, []);

  // Slot availability (booked by other customers)
  useEffect(() => {
    if (!form.date) return;
    getBookedSlots(form.date).then(setBookedSlots).catch(() => {});
  }, [form.date]);

  // ─── Live clock — tick every 60 s so pastSlots stays accurate ──────────────
  // `nowTick` is an integer that increments every minute.  Any derived value
  // that depends on `nowTick` will be re-evaluated automatically, which means
  // `pastSlots` (computed below) reflects the real clock without polling the
  // DB or adding any async logic.
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    // Align the first tick to the next whole minute so the UI and the clock
    // agree: if it is currently 08:54:37, first tick fires in 23 s, then
    // every 60 s after that.
    const msToNextMinute = 60_000 - (Date.now() % 60_000);
    let interval: ReturnType<typeof setInterval>;
    const initial = setTimeout(() => {
      setNowTick(n => n + 1);
      interval = setInterval(() => setNowTick(n => n + 1), 60_000);
    }, msToNextMinute);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, []);

  // ─── Past slots — recomputed every minute and on every date change ──────────
  // isSlotInPast applies the 60-min lead-time buffer so slots that are within
  // the buffer window are also shown as unavailable.
  const pastSlots: string[] = form.date
    ? TIME_SLOTS
        .filter(s => isSlotInPast(form.date, s.value))
        .map(s => s.value)
    : [];
  // suppress exhaustive-deps: nowTick is intentionally the re-render trigger
  // eslint-disable-next-line react-hooks/exhaustive-deps
  void nowTick; // ensure lint doesn't strip the dependency

  // ─── Auto-clear selected time when it ticks into the past ──────────────────
  // If the user has the page open and their selected slot crosses the cutoff
  // (e.g. they picked 08:00 but it's now 07:01 and the 60-min buffer fires),
  // silently clear the selection so they can't accidentally submit a past slot.
  useEffect(() => {
    if (form.time && pastSlots.includes(form.time)) {
      setForm(f => ({ ...f, time: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowTick, form.date]);

  // ─── Fetch all ad placements on mount ──────────────────────────────────────
  // Errors are intentionally swallowed — ads are non-critical to the booking flow.
  useEffect(() => {
    fetchActiveAds("banner_top").then(setBannerAds).catch(() => {});
    fetchActiveAds("inline").then(setInlineAds).catch(() => {});
    fetchActiveAds("popup").then(setPopupAds).catch(() => {});
    fetchActiveAds("sidebar").then(setSidebarAds).catch(() => {});
    getTimeslots().then(setDynamicSlots).catch(() => {});
  }, []);

  // Vehicle helpers
  const updateVehicle = (idx: number, updates: Partial<VehicleEntry>) => {
    setVehicles(prev => prev.map((v, i) => {
      if (i !== idx) return v;
      const updated = { ...v, ...updates };
      if (updates.vehicleCategory && updates.vehicleCategory !== v.vehicleCategory) updated.services = [];
      updated.subtotal = calculateVehicleTotal(updated.vehicleCategory, updated.services, pricing);
      return updated;
    }));
  };

  const toggleService = (vehicleIdx: number, svcName: string) => {
    const v = vehicles[vehicleIdx];
    if (v.services.includes(svcName)) {
      updateVehicle(vehicleIdx, { services: v.services.filter(s => s !== svcName) });
    } else if (isServiceAllowed(v.services, svcName, dbServices)) {
      updateVehicle(vehicleIdx, { services: [...v.services, svcName] });
    }
  };

  const addVehicle    = () => setVehicles(prev => [...prev, emptyVehicle()]);
  const removeVehicle = (idx: number) => { if (vehicles.length > 1) setVehicles(prev => prev.filter((_, i) => i !== idx)); };



  const handleSubmit = async () => {
    setSubmitError("");
    const errs: Record<string, string> = {};

    if (!form.fullName.trim())
      errs.fullName = "Please enter your full name so we know who to greet.";
    if (!form.whatsapp || form.whatsapp === "+264")
      errs.whatsapp = "A WhatsApp number is required — we'll confirm your booking there.";
    else if (!isValidWhatsApp(form.whatsapp))
      errs.whatsapp = "That doesn't look like a valid Namibian number. Try +264 81 234 5678 or 0812345678.";
    if (!form.address.trim())
      errs.address = "Please pin your location on the map so our team knows where to go.";
    else if (!form.locationConfirmed)
      errs.address = "Please confirm your location on the map by tapping 'Confirm This Location'.";
    if (!form.date)
      errs.date = "Please choose a date for your wash.";
    else if (form.date < today())
      errs.date = "That date is in the past. Please pick today or a future date.";
    if (!form.time)
      errs.time = "Please select a time slot from the dropdown.";
    else if (bookedSlots.includes(form.time))
      errs.time = `The ${form.time} slot is already fully booked on ${form.date}. Please choose another time.`;
    else if (isSlotInPast(form.date, form.time))
      errs.time = `That time slot is no longer available — slots must be booked at least ${LEAD_TIME_MINUTES} minutes in advance. Please choose a later time.`;
    vehicles.forEach((v, i) => {
      if (!v.plateNumber.trim())
        errs[`plate_${i}`] = `Vehicle ${i + 1}: Enter the licence plate number (e.g. N 123-456 W).`;
      if (v.services.length === 0)
        errs[`services_${i}`] = `Vehicle ${i + 1}: Select at least one service.`;
    });

    setFieldErrors(errs);

    // T&C check — required for anonymous users; logged-in users accepted on signup
    if (!currentUser && !tcAccepted) {
      setTcError("You must agree to the Terms & Conditions before booking.");
      setSubmitError("Please accept the Terms & Conditions before continuing.");
      return;
    }
    setTcError("");

    if (Object.keys(errs).length > 0) {
      const count = Object.keys(errs).length;
      setSubmitError(`Please fix the ${count} issue${count !== 1 ? "s" : ""} highlighted above before continuing.`);
      return;
    }
    setShowConfirm(true);
  };

  const confirmSubmit = async () => {
    setShowConfirm(false);
    setSubmitting(true);
    setSubmitError("");
    try {
      // ── Bot protection ──────────────────────────────────────────────────────
      const guard = await guardAction("booking", {
        honeypotValue: honeypot,
        userId: currentUser?.id,
      });
      if (!guard.allowed) {
        setSubmitError(guard.reason ?? "Submission blocked. Please try again later.");
        setSubmitting(false);
        return;
      }
      // ── Email verification (registered users only) ──────────────────────────
      if (currentUser && emailVerified === false) {
        setSubmitError("Please verify your email address before making a booking. Check your inbox for the confirmation link.");
        setSubmitting(false);
        return;
      }
      // ── Upload proof of payment if provided ─────────────────────────────────
      let proofUrl: string | null = null;
      if (paymentSel.proofFile && !useRedemptionId) {
        try {
          const { uploadProofOfPayment } = await import("@/lib/imageService");
          // We don't have a booking ID yet — use a temp upload path with a UUID
          const tempId = crypto.randomUUID();
          proofUrl = await uploadProofOfPayment(tempId, paymentSel.proofFile);
        } catch (proofErr: any) {
          console.warn("[BookingPage] proof upload failed:", proofErr?.message);
          // Non-fatal — booking proceeds, proof URL stays null
        }
      }
      // ────────────────────────────────────────────────────────────────────────
      // Derive the payment method to send to the edge function
      const paymentMethod = useRedemptionId ? undefined :
        (paymentSel.method === "mobile_payment" ? "mobile" : paymentSel.method as 'cash' | 'eft') ;
      const paymentSubtype = paymentSel.method === "mobile_payment" ? paymentSel.subtype : null;

      const bookingId = await submitBooking({
        customer_id: currentUser?.id,
        fullName:  form.fullName,
        whatsapp:  form.whatsapp,
        address:   form.address,
        latitude:  form.latitude,
        longitude: form.longitude,
        areaName:  form.areaName  || null,
        landmark:  form.landmark  || null,
        date:      form.date,
        time:      form.time,
        vehicles,
        paymentType:       useRedemptionId ? "Free Wash" : paymentSel.method,
        paymentMethod:     useRedemptionId ? undefined : paymentMethod,
        paymentSubtype:    paymentSubtype,
        proofOfPaymentUrl: proofUrl,
        totalPrice: useRedemptionId ? 0 : total,
        isVip,
        honeypot:    honeypot,
        fingerprint: undefined,
      });

      // Attach the free wash redemption if one was selected
      if (useRedemptionId && bookingId) {
        setAttachingWash(true);
        try {
          await attachFreeWashToBooking(useRedemptionId, bookingId);
          // Remove the used redemption from the local list
          setReservedWashes(prev => prev.filter(r => r.id !== useRedemptionId));
        } catch (attachErr: any) {
          // Booking succeeded but attach failed — non-fatal, show a soft warning
          console.warn("Free wash attach failed:", attachErr?.message);
        } finally {
          setAttachingWash(false);
          setUseRedemptionId(null);
        }
      }

      setSubmitted(true);
      // Show sign-up conversion modal for non-logged-in users
      if (!currentUser) {
        setTimeout(() => setShowSignUpModal(true), 2200);
      }
    } catch (err: any) {
      const msg: string = err?.message || "";
      if (msg.includes("in the past") || msg.includes("past time"))
        setSubmitError("That time slot is now in the past. Please go back and choose a later time.");
      else if (msg.includes("already booked") || msg.includes("time slot"))
        setSubmitError(`The ${form.time} slot was just taken by another customer. Please go back and pick a different time.`);
      else if (msg.includes("network") || msg.includes("fetch"))
        setSubmitError("No internet connection. Please check your network and try again.");
      else if (msg.includes("duplicate") || msg.includes("unique"))
        setSubmitError("A booking with this plate number already exists for this date. Please check your details.");
      else
        setSubmitError(`Booking failed: ${msg || "An unexpected error occurred. Please try again or contact us on WhatsApp."}`);
      // Track failure for abuse detection
      await recordFailure("booking", currentUser?.id, msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewBooking = () => {
    setSubmitted(false);
    setVehicles([emptyVehicle()]);
    setForm({
      fullName: form.fullName, whatsapp: form.whatsapp,
      address: "", date: "", time: "",
      latitude: null, longitude: null,
      areaName: "", landmark: "", locationConfirmed: false,
    });
    setFieldErrors({});
    setSubmitError("");
    setUseRedemptionId(null);
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen car-pattern-bg pb-32">

      {/* Sign-up conversion modal (shown after booking for guests) */}
      {showSignUpModal && !currentUser && (
        <SignUpModal
          fullName={form.fullName}
          onDismiss={() => setShowSignUpModal(false)}
        />
      )}

      {/* Thank-you popup */}
      <AnimatePresence>
        {submitted && (
          <ThankYouPopup
            total={total}
            fullName={form.fullName}
            date={form.date}
            time={form.time}
            onNewBooking={handleNewBooking}
          />
        )}
      </AnimatePresence>

      {/* About / T&C Modal */}
      {showAbout && (
        <AboutModal
          initialTab={aboutTab}
          onClose={() => setShowAbout(false)}
        />
      )}

      {/* Header */}
      {/* ── Single sticky stack: header + banner + live bar ── */}
      <div className="sticky top-0 z-50">
        <header className="bg-primary py-2.5 px-3 sm:px-6 flex items-center justify-between shadow-lg gap-2">
          <button onClick={() => window.location.reload()} className="flex items-center gap-2 min-w-0 cursor-pointer">
          <img src={logo} alt="Oasis Pure Cleaning CC" className="h-9 sm:h-12 w-auto object-contain flex-shrink-0" />
          <div className="min-w-0 hidden sm:block">
            <h1 className="text-primary-foreground font-display font-bold text-base sm:text-lg tracking-tight leading-tight">OASIS PURE CLEANING CC</h1>
            <p className="text-primary-foreground/70 text-xs font-medium tracking-wider uppercase">WE COME, YOU SHINE!</p>
          </div>
        </button>
        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          {/* About button */}
          <button
            onClick={() => { setAboutTab("about"); setShowAbout(true); }}
            className="bg-white/15 text-white px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1 hover:bg-white/25 transition"
          >
            <span className="hidden sm:inline">✨ </span>About
          </button>
          {currentUser ? (
            <>
              <Link to="/dashboard" className="text-primary-foreground/80 hover:text-primary-foreground text-xs sm:text-sm flex items-center gap-1 transition">
                <UserIcon className="w-4 h-4" /> <span className="hidden sm:inline">My Bookings</span>
              </Link>
              <button onClick={async () => { await logout(); navigate("/"); window.location.reload(); }}
                className="bg-red-600 text-white px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 hover:bg-red-700 transition">
                <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          ) : (
            <Link to="/auth" className="bg-white/20 text-white px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 hover:bg-white/30 transition">
              <LogIn className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Login</span>
            </Link>
          )}
        </div>
      </header>

      {/* VIP banner — inside sticky stack so it never drifts */}
      {isVip && (
        <div className="bg-secondary text-secondary-foreground text-center py-2 text-sm font-bold">
          ⭐ VIP After-Hours Service — 1.5× pricing applied
        </div>
      )}

      {/* Banner ads — always visible, zero drift */}
      {bannerAds.length > 0 && <BannerAds ads={bannerAds} />}

      {/* Live booking channel bar */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 py-1.5 sm:py-2 px-3 sm:px-4 bg-gradient-to-r from-green-900 via-green-800 to-green-900 border-b border-green-500/50">
        <span className="relative flex h-2 w-2 sm:h-3 sm:w-3 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-80" />
          <span className="relative inline-flex rounded-full h-2 w-2 sm:h-3 sm:w-3 bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
        </span>
        <span className="text-[10px] sm:text-xs font-bold tracking-wide sm:tracking-widest uppercase text-green-300">
          Live Booking Channel Active
        </span>
        <span className="hidden sm:inline text-xs font-medium text-green-400/70">
          · Instant confirmation
        </span>
      </div>

      </div>{/* end sticky stack */}

      {/* ── Popup ad — shown once per session after 1.5s ── */}
      <PopupAd ads={popupAds} />

      {/* ── Sidebar ad — floating bottom-right panel ── */}
      <SidebarAd ads={sidebarAds} chatbotOpen={chatbotOpen} />

      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6 relative z-10 pb-28">

        {/* ── Customer Info ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl shadow-card p-4 sm:p-6">
          <h3 className="font-display font-bold text-base sm:text-lg mb-4 sm:mb-5 flex items-center gap-2">
            <MapPin className="w-5 h-5" style={{ color: "#FF8C00" }} /> Service Location & Info
          </h3>
          <div className="space-y-4">

            {/* Honeypot — invisible to real users */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px", opacity: 0, height: 0, overflow: "hidden", pointerEvents: "none" }}>
              <input type="text" name="fax_number" tabIndex={-1} autoComplete="off" value={honeypot} onChange={e => setHoneypot(e.target.value)} />
            </div>

            {/* Email verification banner */}
            {currentUser && emailVerified === false && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700">
                <span className="text-amber-600 text-lg shrink-0">✉️</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Email not verified</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Please check your inbox and click the confirmation link before making a booking.</p>
                </div>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Full Name *</label>
              <input
                type="text" placeholder="Your full name" value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className={`w-full px-4 py-3 rounded-xl border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 transition ${fieldErrors.fullName ? "border-destructive" : "border-border"}`}
              />
              {fieldErrors.fullName && <p className="text-xs text-destructive mt-1.5 flex items-start gap-1"><X className="w-3 h-3 mt-0.5 shrink-0" />{fieldErrors.fullName}</p>}
            </div>

            {/* WhatsApp */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">WhatsApp Number *</label>
              <input
                type="tel" placeholder="+264 81 234 5678" maxLength={15} value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                className={`w-full px-4 py-3 rounded-xl border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 transition ${fieldErrors.whatsapp ? "border-destructive" : "border-border"}`}
              />
              {fieldErrors.whatsapp && <p className="text-xs text-destructive mt-1.5 flex items-start gap-1"><X className="w-3 h-3 mt-0.5 shrink-0" />{fieldErrors.whatsapp}</p>}
            </div>

            {/* Map */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Service Location *
              </label>
              <MapPicker
                onLocationSelect={({ address, latitude, longitude, areaName, confirmed }) =>
                  setForm(f => ({
                    ...f,
                    address,
                    latitude,
                    longitude,
                    areaName,
                    locationConfirmed: confirmed,
                  }))
                }
              />
              {fieldErrors.address && (
                <p className="text-xs text-destructive mt-1.5 flex items-start gap-1">
                  <X className="w-3 h-3 mt-0.5 shrink-0" />{fieldErrors.address}
                </p>
              )}
            </div>

            {/* Landmark / Special Instructions */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Landmark / Special Instructions{" "}
                <span className="normal-case font-normal text-muted-foreground">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Blue gate next to Checkers, 2nd house after the stop sign"
                value={form.landmark}
                onChange={(e) => setForm(f => ({ ...f, landmark: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 transition text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Help our driver find your exact spot — especially useful if your street isn't on the map.
              </p>
            </div>

            {/* Date + Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Preferred Date *</label>
                <input
                  type="date" min={today()} value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value, time: "" })}
                  className={`w-full px-4 py-3 rounded-xl border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 transition ${fieldErrors.date ? "border-destructive" : "border-border"}`}
                />
                {fieldErrors.date && <p className="text-xs text-destructive mt-1.5 flex items-start gap-1"><X className="w-3 h-3 mt-0.5 shrink-0" />{fieldErrors.date}</p>}
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Time Slot *</label>
                <TimeSlotDropdown
                  value={form.time}
                  onChange={(t) => setForm({ ...form, time: t })}
                  bookedSlots={bookedSlots}
                  pastSlots={pastSlots}
                  disabled={!form.date}
                />
                {fieldErrors.time && <p className="text-xs text-destructive mt-1.5 flex items-start gap-1"><X className="w-3 h-3 mt-0.5 shrink-0" />{fieldErrors.time}</p>}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Vehicles ── */}
        <AnimatePresence mode="popLayout">
          {vehicles.map((vehicle, idx) => (
            <motion.div key={idx} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="bg-card rounded-2xl shadow-card p-4 sm:p-6 relative">
              <div className="flex items-center justify-between mb-4 sm:mb-5">
                <h3 className="font-display font-bold text-lg">🚗 Vehicle {idx + 1}</h3>
                {vehicles.length > 1 && (
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => removeVehicle(idx)}
                    className="bg-destructive/10 text-destructive p-2 rounded-lg hover:bg-destructive/20 transition">
                    <X className="w-4 h-4" />
                  </motion.button>
                )}
              </div>

              <div className="space-y-4">
                {/* Plate */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Plate Number *</label>
                  <input
                    type="text" placeholder="e.g. N 123-456 W" value={vehicle.plateNumber}
                    onChange={(e) => updateVehicle(idx, { plateNumber: e.target.value })}
                    className={`w-full px-4 py-3 rounded-xl border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 transition ${fieldErrors[`plate_${idx}`] ? "border-destructive" : "border-border"}`}
                  />
                  {fieldErrors[`plate_${idx}`] && <p className="text-xs text-destructive mt-1.5 flex items-start gap-1"><X className="w-3 h-3 mt-0.5 shrink-0" />{fieldErrors[`plate_${idx}`]}</p>}
                </div>

                {/* Category */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Vehicle Category</label>
                  <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
                    {VEHICLE_CATEGORIES.map((c) => (
                      <motion.button key={c.value} type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={() => updateVehicle(idx, { vehicleCategory: c.value as any })}
                        className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-semibold transition ${
                          vehicle.vehicleCategory === c.value
                            ? "text-white shadow-sm"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                        style={vehicle.vehicleCategory === c.value ? { background: "#FF8C00" } : {}}
                      >
                        {c.label}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Services */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Services *</label>
                  {!servicesLoaded ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading services…
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {/* Primary services */}
                      {dbServices.filter(s => !s.is_addon).map((svc) => {
                        const selected = vehicle.services.includes(svc.name);
                        const allowed  = selected || isServiceAllowed(vehicle.services, svc.name, dbServices);
                        const price    = pricing[vehicle.vehicleCategory]?.[svc.name] || 0;
                        return (
                          <motion.label key={svc.id} whileHover={{ scale: allowed ? 1.01 : 1 }} whileTap={{ scale: allowed ? 0.98 : 1 }}
                            className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition ${
                              selected ? "border-orange-400 bg-orange-50 dark:bg-orange-900/20"
                                : allowed ? "border-border bg-background hover:border-orange-300"
                                : "border-border bg-muted/40 opacity-40 cursor-not-allowed"
                            }`}>
                            <div className="flex items-center gap-3">
                              <input type="checkbox" checked={selected} onChange={() => allowed && toggleService(idx, svc.name)} disabled={!allowed} className="sr-only" />
                              <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition ${selected ? "border-orange-500" : "border-muted-foreground/30"}`}
                                style={selected ? { background: "#FF8C00", borderColor: "#FF8C00" } : {}}>
                                {selected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold leading-tight">{svc.name}</p>
                                {svc.description && <p className="text-xs text-muted-foreground leading-snug">{svc.description}</p>}
                              </div>
                            </div>
                            <span className="text-sm font-bold ml-2 shrink-0" style={{ color: "#FF8C00" }}>N$ {price}</span>
                          </motion.label>
                        );
                      })}

                      {/* Add-ons */}
                      {dbServices.filter(s => s.is_addon).length > 0 && (
                        <>
                          <p className="text-xs text-muted-foreground font-semibold pt-1 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Add-ons (can combine with any service)
                          </p>
                          {dbServices.filter(s => s.is_addon).map((svc) => {
                            const selected = vehicle.services.includes(svc.name);
                            const price    = pricing[vehicle.vehicleCategory]?.[svc.name] || 0;
                            return (
                              <motion.label key={svc.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                                className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition ${
                                  selected ? "border-orange-400 bg-orange-50 dark:bg-orange-900/20" : "border-border bg-background hover:border-orange-300"
                                }`}>
                                <div className="flex items-center gap-3">
                                  <input type="checkbox" checked={selected} onChange={() => toggleService(idx, svc.name)} className="sr-only" />
                                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition ${selected ? "border-orange-500" : "border-muted-foreground/30"}`}
                                    style={selected ? { background: "#FF8C00", borderColor: "#FF8C00" } : {}}>
                                    {selected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold">{svc.name}</p>
                                    {svc.description && <p className="text-xs text-muted-foreground">{svc.description}</p>}
                                  </div>
                                </div>
                                <span className="text-sm font-bold ml-2 shrink-0" style={{ color: "#FF8C00" }}>+ N$ {price}</span>
                              </motion.label>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}
                  {fieldErrors[`services_${idx}`] && (
                    <p className="text-xs text-destructive mt-1.5 flex items-start gap-1"><X className="w-3 h-3 mt-0.5 shrink-0" />{fieldErrors[`services_${idx}`]}</p>
                  )}
                </div>

                {/* Subtotal */}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-sm text-muted-foreground">Vehicle {idx + 1} subtotal</span>
                  <span className="font-display font-bold text-lg" style={{ color: "#FF8C00" }}>N$ {vehicle.subtotal}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Add vehicle */}
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={addVehicle}
          className="w-full bg-card rounded-2xl shadow-card p-4 border-2 border-dashed border-border hover:border-orange-300 transition flex items-center justify-center gap-2 text-muted-foreground hover:text-orange-600 font-semibold">
          <Plus className="w-5 h-5" /> Add Another Vehicle
        </motion.button>

        {/* ── Inline ads — between vehicles and payment ── */}
        {inlineAds.length > 0 && <InlineAds ads={inlineAds} />}

        {/* Payment */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl shadow-card p-4 sm:p-6">
          <h3 className="font-display font-bold text-base sm:text-lg mb-3 sm:mb-4">💳 Payment Method</h3>
          <PaymentPanel
            value={paymentSel}
            onChange={setPaymentSel}
            paymentDetails={paymentDetails}
            allowProof={true}
            disabled={submitting || !!useRedemptionId}
          />
          {useRedemptionId && (
            <p className="mt-2 text-xs text-green-600 font-medium">Free Wash applied — no payment required.</p>
          )}
        </motion.div>

        {/* Sign-up banner for guests */}
        {!currentUser && (
          <SignUpBanner />
        )}

        {/* Free Wash Redemption — shown only for logged-in users who have reserved washes and non-VIP booking */}
        {currentUser && reservedWashes.length > 0 && !isVip && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl shadow-card p-6 border-2 border-green-400/50">
            <h3 className="font-display font-bold text-lg mb-2 flex items-center gap-2">
              <Gift className="w-5 h-5 text-green-600" /> Use a Free Wash
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              You have {reservedWashes.length} free wash{reservedWashes.length !== 1 ? "es" : ""} available.
              Applies to Standard bookings only — not VIP.
            </p>
            <div className="space-y-2">
              {/* "None" option */}
              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${
                useRedemptionId === null ? "border-orange-400 bg-orange-50 dark:bg-orange-900/10" : "border-border hover:border-orange-200"
              }`}>
                <input type="radio" name="freeWash" value=""
                  checked={useRedemptionId === null}
                  onChange={() => setUseRedemptionId(null)}
                  className="sr-only" />
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${useRedemptionId === null ? "border-orange-500" : "border-muted-foreground/40"}`}>
                  {useRedemptionId === null && <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />}
                </div>
                <span className="font-semibold text-sm">Pay normally (N$ {total})</span>
              </label>

              {reservedWashes.map(r => (
                <label key={r.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${
                  useRedemptionId === r.id ? "border-green-500 bg-green-50 dark:bg-green-900/10" : "border-border hover:border-green-300"
                }`}>
                  <input type="radio" name="freeWash" value={r.id}
                    checked={useRedemptionId === r.id}
                    onChange={() => setUseRedemptionId(r.id)}
                    className="sr-only" />
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${useRedemptionId === r.id ? "border-green-500" : "border-muted-foreground/40"}`}>
                    {useRedemptionId === r.id && <div className="w-2.5 h-2.5 rounded-full bg-green-500" />}
                  </div>
                  <Gift className="w-4 h-4 text-green-600 shrink-0" />
                  <div className="flex-1">
                    <p className="font-bold text-sm text-green-700 dark:text-green-400">Free Standard Wash — N$ 0</p>
                    <p className="text-xs text-muted-foreground">{formatExpiry(r.expires_at)}</p>
                  </div>
                  {useRedemptionId === r.id && (
                    <span className="text-xs font-bold text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">Selected</span>
                  )}
                </label>
              ))}
            </div>
            {useRedemptionId && (
              <p className="text-xs text-muted-foreground mt-3 flex items-start gap-1.5">
                <CheckCircle className="w-3 h-3 mt-0.5 text-green-600 shrink-0" />
                Your booking will be set to N$ 0. Max 1 free wash per booking. Cannot stack with promotions.
              </p>
            )}
          </motion.div>
        )}

        {/* T&C Checkbox — shown for anonymous users */}
        {!currentUser && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl shadow-card p-6">
            <h3 className="font-display font-bold text-base mb-4">📋 Terms & Conditions</h3>
            <TCCheckbox
              checked={tcAccepted}
              onChange={(v) => { setTcAccepted(v); if (v) setTcError(""); }}
              onViewTC={() => { setAboutTab("tc"); setShowAbout(true); }}
              error={tcError}
            />
            <p className="text-xs text-muted-foreground mt-3">
              Already have an account?{" "}
              <Link to="/auth" className="text-orange-600 font-semibold hover:underline">Log in</Link>
              {" "}— T&C acceptance is stored on your profile.
            </p>
          </motion.div>
        )}

        {/* Error message */}
        {submitError && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-destructive/10 border border-destructive/30 text-destructive rounded-xl p-4 text-sm flex items-start gap-2">
            <X className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{submitError}</span>
          </motion.div>
        )}
      </div>

      {/* Confirmation modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card rounded-2xl shadow-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto">
              <h3 className="font-display font-bold text-xl mb-4">Confirm Your Booking</h3>
              <div className="space-y-2 text-sm text-muted-foreground mb-6">
                <p><strong className="text-foreground">Name:</strong> {form.fullName}</p>
                <p><strong className="text-foreground">WhatsApp:</strong> {form.whatsapp}</p>
                <p><strong className="text-foreground">Date:</strong> {form.date} at {form.time}</p>
                <div>
                  <p><strong className="text-foreground">Location:</strong> {form.address}</p>
                  {form.areaName && form.areaName !== form.address && (
                    <p className="mt-0.5 text-xs text-muted-foreground">📍 {form.areaName}</p>
                  )}
                  {form.latitude && form.longitude && (
                    <p className="mt-0.5 text-xs font-mono text-muted-foreground">
                      {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
                    </p>
                  )}
                  {form.landmark && (
                    <p className="mt-1 text-xs">
                      <span className="font-semibold text-foreground">Landmark: </span>
                      {form.landmark}
                    </p>
                  )}
                </div>
                {isVip && <p className="font-bold" style={{ color: "#FF8C00" }}>⭐ VIP After-Hours — 1.5× pricing applies</p>}
                {vehicles.map((v, i) => (
                  <div key={i} className="bg-muted/30 rounded-xl p-3 mt-2">
                    <p className="font-semibold text-foreground">Vehicle {i + 1}: {v.plateNumber} ({v.vehicleCategory})</p>
                    <p>{v.services.join(", ") || "No services selected"}</p>
                    <p className="font-bold" style={{ color: "#FF8C00" }}>N$ {v.subtotal}</p>
                  </div>
                ))}
                <p><strong className="text-foreground">Payment:</strong> {useRedemptionId ? "Free Wash 🎁" : paymentSel.method === "mobile_payment" ? (paymentSel.subtype === "pay2cell" ? "Pay2Cell" : "E-Wallet") : paymentSel.method === "eft" ? "EFT" : "Cash"}</p>
                <p className="text-xl font-bold pt-2 border-t border-border" style={{ color: "#FF8C00" }}>
                  Total: {useRedemptionId ? "FREE 🎁" : `N$ ${total}`}
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirm(false)}
                  className="flex-1 py-3 rounded-xl border border-border font-semibold hover:bg-muted transition">
                  Edit Details
                </button>
                <button onClick={confirmSubmit}
                  className="flex-1 py-3 rounded-xl font-bold text-white transition hover:opacity-90 flex items-center justify-center gap-2"
                  style={{ background: "#FF8C00" }}>
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : "Confirm & Book"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-primary/95 backdrop-blur-sm px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 border-t border-primary-foreground/10">
        <div>
          <p className="text-xs text-primary-foreground/60 uppercase tracking-wider font-semibold">
            {useRedemptionId ? "🎁 Free Wash Applied" : isVip ? "⭐ VIP Total" : "Estimated Total"}
          </p>
          <motion.p key={useRedemptionId ? "free" : total} initial={{ scale: 0.85 }} animate={{ scale: 1 }}
            className="text-xl sm:text-2xl font-display font-bold" style={{ color: "#FF8C00" }}>
            {useRedemptionId ? "FREE" : `N$ ${total}`}
          </motion.p>
        </div>
        <button onClick={handleSubmit} disabled={submitting || attachingWash}
          className="px-4 sm:px-8 py-3 sm:py-3.5 rounded-xl font-bold uppercase tracking-wide sm:tracking-wider text-xs sm:text-sm text-white transition hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 sm:gap-2 shadow-lg shrink-0"
          style={{ background: "#FF8C00" }}>
          {(submitting || attachingWash)
            ? <><Loader2 className="w-4 h-4 animate-spin" /> {attachingWash ? "Applying Wash…" : "Submitting…"}</>
            : <><Send className="w-4 h-4" /> {useRedemptionId ? "Book Free Wash" : "Book Now"}</>}
        </button>
      </div>
      <CopyrightFooter />
      <WinnyChatbot onOpenChange={setChatbotOpen} />
    </div>
  );
};

export default BookingPage;
