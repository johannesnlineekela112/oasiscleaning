import { useState, useEffect, useRef, useCallback } from "react";
import { CopyrightFooter } from "@/components/CopyrightFooter";
import { auditLog, auditAuthEvent, getClientMeta } from "@/lib/auditService";
import { AdminAnalytics } from "@/components/AdminAnalytics";
import { useInactivityLogout, InactivityWarning } from "@/hooks/useInactivityLogout";
import { useReAuth } from "@/components/auth/ReAuthModal";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogOut, RefreshCw, Trash2, CheckCircle, Clock, XCircle, Users,
  ChevronDown, Phone, MapPin, Calendar, CreditCard, Loader2, Settings,
  UserPlus, History, ClipboardList, DollarSign, Save, BadgeCheck, Percent,
  MessageCircle, Bell, Mail, Lock, Plus, Edit2, ToggleLeft, ToggleRight,
  ShieldCheck, Briefcase, X, BookOpen, Image, FileText, ChevronUp,
  Megaphone, AlertTriangle, Award, Gift, TrendingUp, Zap, Crown,
  Sparkles, Filter, RefreshCw as RefreshCwIcon,
  Camera, ImageIcon,
  FileSpreadsheet, Download, CheckSquare, Banknote, ReceiptText, BarChart2,
} from "lucide-react";
import {
  Booking, StaffMember, ServiceRow,
  getBookings, updateBookingStatus, updateBookingPaid,
  assignBookingToEmployee, deleteBooking, addStaffMember, getStaff,
  deleteStaffMember,
  getAllServices, createService, updateService, deleteService,
  getCommissionPercent, saveCommissionPercent, saveCommissionPercentForAll,
  addCommissionPayment, getCommissionPayments, resetEmployeeCommission,
  CommissionPayment, buildPricingMatrix,
  toNamibiaDisplay, normalizeBooking,
  todayInNamibia,
  fetchBookingsForExport, fetchCommissionExportData,
} from "@/lib/bookingService";
import {
  AdminLoyaltyRow, FreeWashRedemption,
  fetchAdminLoyaltyOverview, fetchUserRedemptions, expireStaleRedemptions,
  TIER_CONFIG, FREE_WASH_COST, formatExpiry, REDEMPTION_STATUS,
} from "@/lib/loyaltyService";
import {
  BookingImage, getBookingImages, deleteJobPhoto,
} from "@/lib/imageService";
import {
  CommissionSummary,
  generateMonthlySummary, fetchSummaries, fetchSummaryYears,
  approveSummary, markSummaryPaid, updateSummaryNotes,
  exportMonthXlsx, exportMonthCsv, exportSingleXlsx, exportSingleCsv,
  exportHistoryXlsx, exportHistoryCsv,
  exportCommissionXlsx, exportCommissionCsv,
  MONTH_NAMES, monthName, STATUS_CONFIG as PAYOUT_STATUS_CONFIG,
} from "@/lib/commissionService";
import { getSessionUser, isAdmin, logout, getUserProfile } from "@/lib/authService";
import { getBoolSetting, setBoolSetting, getSetting, setSetting, getTimeslots, saveTimeslots, DEFAULT_TIMESLOTS, SETTINGS_KEYS, type TimeSlotSetting } from "@/lib/settingsService";
import { generatePayslipPdf } from "@/lib/payslipPdf";
import { supabase } from "@/lib/supabase";
import {
  LegalDocument, TeamMember,
  getAllLegalDocuments, upsertLegalDocument,
  getTeamMembers, createTeamMember, updateTeamMember, deleteTeamMember,
  uploadTeamImage, deleteTeamImage,
} from "@/lib/contentService";
import { useNavigate } from "react-router-dom";
import MapPicker from "@/components/MapPicker";
import AdminAds from "@/pages/AdminAds";
import AdminPaymentVerification from "@/components/AdminPaymentVerification";
import AdminSubscriptions from "@/components/AdminSubscriptions";
import { useToastQueue, NotificationToastStack } from "@/components/NotificationToast";
import logo from "@/assets/logo-car.png";

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  pending:        { label: "Pending",             icon: Clock,         color: "bg-orange/20 text-orange-dark" },
  confirmed:      { label: "Confirmed",           icon: CheckCircle,   color: "bg-info/20 text-info" },
  in_progress:    { label: "Paid / In Progress",  icon: BadgeCheck,    color: "bg-info/20 text-info" },
  completed:      { label: "Completed",           icon: CheckCircle,   color: "bg-success/20 text-success" },
  cancelled:      { label: "Cancelled",           icon: XCircle,       color: "bg-destructive/20 text-destructive" },
  late_cancelled: { label: "Late Cancellation",   icon: AlertTriangle, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-500" },
};

type Tab = "bookings" | "history" | "employees" | "settings" | "payouts" | "about" | "ads" | "loyalty" | "security" | "audit" | "analytics" | "payments" | "subscriptions";

// ─── Empty service form ───────────────────────────────────────────────────────
const emptyServiceForm = (): Omit<ServiceRow, "id"> => ({
  name: "", description: "", price_small: 0, price_large: 0,
  price_xl: 0, price_truck: 0, is_addon: false, is_active: true, sort_order: 99,
});

const AdminDashboard = () => {
  const [bookings,    setBookings]    = useState<Booking[]>([]);
  const [staff,       setStaff]       = useState<StaffMember[]>([]);
  const [services,    setServices]    = useState<ServiceRow[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState<Tab>("bookings");
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [bookingSubTab,  setBookingSubTab]  = useState<"today" | "upcoming" | "past">("today");
  const [historySubTab,  setHistorySubTab]  = useState<"completed" | "cancellations">("completed");

  // Export panel state
  const [histExportStart,   setHistExportStart]   = useState("");
  const [histExportEnd,     setHistExportEnd]     = useState("");
  const [histExportLoading, setHistExportLoading] = useState<"csv"|"xlsx"|false>(false);
  const [commExportStart,   setCommExportStart]   = useState("");
  const [commExportEnd,     setCommExportEnd]     = useState("");
  const [commExportLoading, setCommExportLoading] = useState<"csv"|"xlsx"|false>(false);
  const prevBookingCount = useRef(0);
  const navigate = useNavigate();
  const { toasts, pushToast, dismissToast } = useToastQueue();

  // Staff form
  const [staffForm, setStaffForm] = useState({
    name: "", surname: "", idNumber: "", phone: "", cellphone: "",
    email: "", password: "", role: "employee" as "admin" | "employee",
  });
  const [staffMsg, setStaffMsg] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);

  // Service form
  const [serviceForm,     setServiceForm]     = useState<Omit<ServiceRow, "id">>(emptyServiceForm());
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null);
  const [serviceMsg,      setServiceMsg]      = useState("");
  const [showServiceForm, setShowServiceForm] = useState(false);

  // About & Legal
  const [legalDocs,       setLegalDocs]       = useState<LegalDocument[]>([]);
  const [teamMembers,     setTeamMembers]     = useState<TeamMember[]>([]);
  const [legalLoading,    setLegalLoading]    = useState(false);
  const [editingDoc,      setEditingDoc]      = useState<string | null>(null); // document_key
  const [docForm,         setDocForm]         = useState({ title: "", content: "" });
  const [docMsg,          setDocMsg]          = useState("");
  const [editingMember,   setEditingMember]   = useState<string | null>(null); // member id or "new"
  const [memberForm,      setMemberForm]      = useState({ full_name:"", title:"", bio:"", image_url:"", display_order:0 });
  const [memberMsg,       setMemberMsg]       = useState("");
  const [memberImgLoading,setMemberImgLoading]= useState(false);

  // Commission
  const [commissionPercent,   setCommissionPercent]   = useState(20);
  const [commissionPayments,  setCommissionPayments]  = useState<CommissionPayment[]>([]);
  const [commissionSaved,     setCommissionSaved]     = useState(false);

  // Loyalty overview
  const [loyaltyRows,        setLoyaltyRows]        = useState<AdminLoyaltyRow[]>([]);
  const [loyaltyLoading,     setLoyaltyLoading]     = useState(false);
  const [loyaltyFilter,      setLoyaltyFilter]      = useState<"all"|"available"|"top">("all");
  const [expandedLoyalty,    setExpandedLoyalty]    = useState<string | null>(null);
  const [userRedemptions,    setUserRedemptions]    = useState<Record<string, FreeWashRedemption[]>>({});
  const [expiringLoading,    setExpiringLoading]    = useState(false);

  // Referral system toggle
  const [referralEnabled,    setReferralEnabled]    = useState(true);
  const loyaltyLoadedRef = useRef(false);
  const [referralSaving,     setReferralSaving]     = useState(false);

  // WhatsApp agent number setting
  const [waNumber,           setWaNumber]           = useState("264812781123");
  const [waNumberInput,      setWaNumberInput]      = useState("264812781123");
  const [waNumberSaving,     setWaNumberSaving]     = useState(false);
  const [waNumberSaved,      setWaNumberSaved]      = useState(false);

  // ── Timeslot manager state ─────────────────────────────────────────────
  const [timeslots,        setTimeslots]        = useState<TimeSlotSetting[]>(DEFAULT_TIMESLOTS);
  const [timeslotSaving,   setTimeslotSaving]   = useState(false);
  const [timeslotSaved,    setTimeslotSaved]    = useState(false);
  const [timeslotMsg,      setTimeslotMsg]      = useState<string | null>(null);
  const [newSlotValue,     setNewSlotValue]     = useState("");
  const [newSlotLabel,     setNewSlotLabel]     = useState("");
  const [newSlotIsVip,     setNewSlotIsVip]     = useState(false);

  // Booking images: keyed by bookingId
  const [bookingImages,      setBookingImages]      = useState<Record<string, BookingImage[]>>({});
  const [imagesLoading,      setImagesLoading]      = useState<Record<string, boolean>>({});
  const [imagesLightbox,     setImagesLightbox]     = useState<BookingImage | null>(null);

  // ─── Monthly Commission Payouts ────────────────────────────────────────────
  const _today         = new Date();
  const [payoutMonth,        setPayoutMonth]        = useState(_today.getMonth() + 1);
  const [payoutYear,         setPayoutYear]         = useState(_today.getFullYear());
  const [payoutSummaries,    setPayoutSummaries]    = useState<CommissionSummary[]>([]);
  const [payoutLoading,      setPayoutLoading]      = useState(false);
  const [payoutGenerating,   setPayoutGenerating]   = useState(false);
  const [payoutMsg,          setPayoutMsg]          = useState<{ text: string; ok: boolean } | null>(null);
  const [payoutYears,        setPayoutYears]        = useState<number[]>([new Date().getFullYear()]);
  const [expandedPayout,     setExpandedPayout]     = useState<string | null>(null);
  const [payoutNotesEdit,    setPayoutNotesEdit]    = useState<Record<string, string>>({});
  const [payoutEmpFilter,    setPayoutEmpFilter]    = useState<string>("all");
  const [adminUserId,        setAdminUserId]        = useState<string | null>(null);
  const [adminName,          setAdminName]          = useState<string>("Admin");

  // ── Session hardening ────────────────────────────────────────────────────
  // Inactivity logout (15 min idle → warning → logout)
  const { showWarning, countdown, stayLoggedIn } = useInactivityLogout();
  // Re-authentication gate for sensitive actions
  const { requireReAuth, ReAuthGate } = useReAuth();

  // Security logs
  const [secLogs,            setSecLogs]            = useState<any[]>([]);
  const [secLogsLoading,     setSecLogsLoading]     = useState(false);
  const [secLogFilter,       setSecLogFilter]       = useState<"all"|"blocked"|"allowed">("all");
  const [abuseBlocks,        setAbuseBlocks]        = useState<any[]>([]);
  const [auditLogs,          setAuditLogs]          = useState<any[]>([]);
  const [auditLogsLoading,   setAuditLogsLoading]   = useState(false);

  // Auth guard — use getSessionUser (one-shot) to avoid subscribe race conditions
  const [authChecked, setAuthChecked] = useState(false);

  // ─── ALL hooks must be declared unconditionally before any early return ───
  // FIXED: moved useCallback and every useEffect above the authChecked guard.
  // Previously these four hooks were declared *after* "if (!authChecked) return",
  // causing React error #310 (hooks called a different number of times per render).

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [b, s, svcs, cp, pct] = await Promise.all([
        getBookings(), getStaff(), getAllServices(), getCommissionPayments(), getCommissionPercent(),
      ]);
      prevBookingCount.current = b.length;
      setBookings(b);
      setStaff(s);
      setServices(svcs);
      setCommissionPayments(cp);
      setCommissionPercent(pct);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    getSessionUser().then(async (user) => {
      if (!user) { navigate("/admin"); return; }
      const admin = await isAdmin(user.id);
      if (!admin) { navigate("/admin"); return; }
      setAdminUserId(user.id);
      getUserProfile(user.id).then(p => { if (p?.full_name) setAdminName(p.full_name); }).catch(() => {});
      setAuthChecked(true);
    });
  }, [navigate]);

  useEffect(() => {
    if (!authChecked) return;
    fetchAll();
  }, [authChecked, fetchAll]);

  useEffect(() => {
    if (!authChecked) return;
    const iv = setInterval(fetchAll, 30000);
    return () => clearInterval(iv);
  }, [authChecked, fetchAll]);

  // Load About & Legal data when that tab is opened
  useEffect(() => {
    if (!authChecked) return;
    if (tab !== "about") return;
    setLegalLoading(true);
    Promise.all([getAllLegalDocuments(), getTeamMembers()])
      .then(([docs, members]) => { setLegalDocs(docs); setTeamMembers(members); })
      .finally(() => setLegalLoading(false));
  }, [authChecked, tab]);

  // Load loyalty overview when that tab is first opened
  useEffect(() => {
    if (!authChecked || tab !== "loyalty") return;
    if (loyaltyLoadedRef.current) return; // already loaded — don't flash again
    loyaltyLoadedRef.current = true;
    setLoyaltyLoading(true);
    Promise.all([
      fetchAdminLoyaltyOverview(),
      getBoolSetting(SETTINGS_KEYS.REFERRAL_SYSTEM_ENABLED, true),
      getSetting(SETTINGS_KEYS.WHATSAPP_AGENT_NUMBER),
      getTimeslots(),
    ])
      .then(([rows, enabled, waNum, slots]) => {
        setLoyaltyRows(rows);
        setReferralEnabled(enabled);
        if (waNum) { setWaNumber(waNum); setWaNumberInput(waNum); }
        if (slots) setTimeslots(slots);
      })
      .catch(() => {})
      .finally(() => setLoyaltyLoading(false));
  }, [authChecked, tab]);

  // ─── Realtime subscription ─────────────────────────────────────────────────
  // Handles INSERT/UPDATE/DELETE instantly. 30-second poll above is a silent fallback.
  useEffect(() => {
    if (!authChecked) return;
    const channel = supabase
      .channel("admin-bookings-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            // Add directly — no fetchAll, no double-count
            const inserted = normalizeBooking(payload.new);
            setBookings(prev => [inserted, ...prev]);
            prevBookingCount.current += 1;
            pushToast(
              "new_booking",
              "New Booking Received! 🔔",
              `${inserted.fullName} — ${inserted.date} at ${inserted.time} · N$${inserted.totalPrice || inserted.price}`
            );
          } else if (payload.eventType === "UPDATE") {
            const updated  = normalizeBooking(payload.new);
            const oldRow   = payload.old as any;
            const newRow   = payload.new as any;
            setBookings(prev => {
              const exists = prev.some(b => b.id === updated.id);
              return exists ? prev.map(b => b.id === updated.id ? updated : b) : prev;
            });
            // Status change
            if (oldRow.status && oldRow.status !== newRow.status) {
              const newStatus = (newRow.status as string).replace(/_/g, " ");
              pushToast(
                "booking_updated",
                "Booking Status Changed",
                `${updated.fullName} — ${updated.date} → ${newStatus}`
              );
            }
            // Assignment change
            if (oldRow.assigned_employee_id !== newRow.assigned_employee_id) {
              if (newRow.assigned_employee_id) {
                pushToast(
                  "booking_updated",
                  "Job Assigned to Employee",
                  `${updated.fullName} — ${updated.date} at ${updated.time}`
                );
              } else {
                pushToast(
                  "booking_updated",
                  "Job Unassigned",
                  `${updated.fullName} — ${updated.date} was unassigned`
                );
              }
            }
          } else if (payload.eventType === "DELETE") {
            setBookings(prev => prev.filter(b => b.id !== (payload.old as any).id));
            prevBookingCount.current = Math.max(0, prevBookingCount.current - 1);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [authChecked, pushToast]);

  // ─── Load booking images when a booking is expanded ──────────────────────
  const loadBookingImages = useCallback(async (bookingId: string) => {
    if (bookingImages[bookingId] !== undefined) return; // already loaded
    setImagesLoading(prev => ({ ...prev, [bookingId]: true }));
    try {
      const imgs = await getBookingImages(bookingId);
      setBookingImages(prev => ({ ...prev, [bookingId]: imgs }));
    } catch { /* silent — RLS might prevent read on some bookings */ }
    setImagesLoading(prev => ({ ...prev, [bookingId]: false }));
  }, [bookingImages]);
  useEffect(() => {
    if (!authChecked) return;
    const ch = supabase
      .channel("admin-loyalty-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_loyalty" }, () => {
        if (tab === "loyalty") {
          fetchAdminLoyaltyOverview().then(setLoyaltyRows).catch(() => {});
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "free_wash_redemptions" }, (payload) => {
        if (tab === "loyalty") {
          const uid = (payload.new as any)?.user_id || (payload.old as any)?.user_id;
          if (uid && expandedLoyalty === uid) {
            fetchUserRedemptions(uid).then(r => setUserRedemptions(prev => ({ ...prev, [uid]: r }))).catch(() => {});
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, tab, expandedLoyalty]);

  // ─── Realtime: booking_images (refresh gallery when employee uploads) ──────
  useEffect(() => {
    if (!authChecked) return;
    const ch = supabase
      .channel("admin-booking-images-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "booking_images" }, (payload) => {
        const bookingId = (payload.new as any)?.booking_id || (payload.old as any)?.booking_id;
        if (!bookingId) return;
        // Only refresh if this booking's gallery is currently loaded (expanded)
        if (bookingImages[bookingId] !== undefined) {
          getBookingImages(bookingId)
            .then(imgs => setBookingImages(prev => ({ ...prev, [bookingId]: imgs })))
            .catch(() => {});
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, bookingImages]);

  // ─── Realtime: employee_commission_summary ────────────────────────────────
  useEffect(() => {
    if (!authChecked) return;
    const ch = supabase
      .channel("admin-commission-summary-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_commission_summary" }, () => {
        if (tab === "payouts") {
          fetchSummaries(payoutMonth, payoutYear).then(setPayoutSummaries).catch(() => {});
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, tab, payoutMonth, payoutYear]);
  const _todayDate = todayInNamibia();
  // TODAY: not-completed/not-cancelled bookings for today only
  // Once completed they move to History tab; cancelled ones disappear
  const todaySchedule    = bookings.filter(b =>
    b.booking_date === _todayDate &&
    b.status !== "completed" &&
    b.status !== "cancelled" &&
    b.status !== "late_cancelled"
  );
  // UPCOMING: future bookings that are active (not completed/cancelled)
  const upcomingBookings = bookings.filter(b =>
    b.booking_date > _todayDate &&
    b.status !== "completed" &&
    b.status !== "cancelled" &&
    b.status !== "late_cancelled"
  );
  // PAST/INCOMPLETE: past date, NOT completed, NOT cancelled — left hanging
  const pastIncomplete   = bookings.filter(b =>
    b.booking_date < _todayDate &&
    b.status !== "completed" &&
    b.status !== "cancelled" &&
    b.status !== "late_cancelled"
  );
  // History: completed bookings only
  const completedBookingsHist = bookings.filter(b => b.status === "completed");
  const cancelledBookingsHist = bookings.filter(b =>
    b.status === "cancelled" || b.status === "late_cancelled"
  );
  const historyBookings = completedBookingsHist;

  const displayed =
    tab === "bookings"
      ? (bookingSubTab === "today" ? todaySchedule
        : bookingSubTab === "upcoming" ? upcomingBookings
        : pastIncomplete)
    : tab === "history"
      ? (historySubTab === "completed" ? completedBookingsHist : cancelledBookingsHist)
    : [];

  const stats = {
    total:     bookings.length,
    pending:   bookings.filter(b => b.status === "pending").length,
    confirmed: bookings.filter(b => b.status === "confirmed" || b.status === "in_progress").length,
    revenue:   completedBookingsHist.reduce((s, b) => s + (b.totalPrice || b.price), 0),
  };

  // ─── Booking actions ───────────────────────────────────────────────────────
  const handleStatusChange = async (id: string, status: Booking["status"]) => {
    if (status === "completed") {
      const b = bookings.find(x => x.id === id);
      if (b && !b.paid) { alert("Mark booking as Paid first before completing."); return; }
    }
    const prev = bookings.find(x => x.id === id)?.status;
    await updateBookingStatus(id, status);
    setBookings(prev2 => prev2.map(b => b.id === id ? { ...b, status } : b));
    auditLog(adminUserId, "booking.status_changed", "booking", id, { from: prev, to: status });
  };

  const handlePaidToggle = async (id: string, paid: boolean) => {
    await updateBookingPaid(id, paid);
    setBookings(prev => prev.map(b => b.id === id
      ? { ...b, paid, status: paid ? "in_progress" : "confirmed" }
      : b
    ));
    auditLog(adminUserId, "booking.paid_toggled", "booking", id, { paid });
  };

  const handleAssign = async (id: string, employeeId: string) => {
    await assignBookingToEmployee(id, employeeId);
    setBookings(prev => prev.map(b => {
      if (b.id !== id) return b;
      const newStatus = !employeeId
        ? "pending"
        : b.status === "pending"
        ? "confirmed"
        : b.status;
      return { ...b, assignedEmployee: employeeId, assigned_employee_id: employeeId, status: newStatus as Booking["status"] };
    }));
    auditLog(adminUserId, "booking.assigned", "booking", id, { employee_id: employeeId });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this booking permanently?")) return;
    // Require re-authentication before a destructive delete
    try { await requireReAuth(); } catch { return; }
    const booking = bookings.find(b => b.id === id);
    await deleteBooking(id);
    setBookings(prev => prev.filter(b => b.id !== id));
    auditLog(adminUserId, "booking.deleted", "booking", id, {
      customer: booking?.fullName,
      date: booking?.date,
      status: booking?.status,
    });
  };

  // ─── WhatsApp messages ─────────────────────────────────────────────────────
  const openWhatsApp = (booking: Booking, type: "confirm" | "cancel") => {
    const vehicleInfo = booking.vehicles?.map((v, i) =>
      `Vehicle ${i + 1}: ${v.plateNumber} (${v.vehicleCategory}) — ${v.services.join(", ")}`
    ).join("\n") || `${booking.vehicle_type} — ${booking.service_type}`;

    const msg = type === "confirm"
      ? `✅ *Oasis Pure Cleaning CC — Booking Confirmed*\n\nHi ${booking.fullName},\n\nYour booking is confirmed!\n📅 ${booking.date} at ${booking.time}\n${vehicleInfo}\n💰 Total: N$ ${booking.totalPrice || booking.price}\n💳 ${booking.paymentType}\n\n_We Come, You Shine_ 🚗✨`
      : `❌ *Oasis Pure Cleaning CC — Booking Cancelled*\n\nHi ${booking.fullName},\n\nYour booking on *${booking.date} at ${booking.time}* has been cancelled.\n\nPlease contact us to reschedule.\n📞 Oasis Pure Cleaning CC — We Come, You Shine!`;

    const phone = (booking.whatsapp || "").replace(/\s/g, "").replace(/^\+/, "").replace(/^0/, "264");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // ─── Staff actions ─────────────────────────────────────────────────────────
  const handleAddStaff = async () => {
    if (!staffForm.name || !staffForm.surname || !staffForm.cellphone || !staffForm.email || !staffForm.password) {
      setStaffMsg("All fields except Phone are required."); return;
    }
    setStaffLoading(true);
    try {
      const code = await addStaffMember(staffForm);
      setStaffMsg(`✓ ${staffForm.role === "admin" ? "Admin" : "Employee"} registered. Code: ${code}`);
      auditLog(adminUserId, "employee.created", "employee", undefined, {
        role: staffForm.role,
        email: staffForm.email,
        employee_number: code,
      });
      setStaffForm({ name: "", surname: "", idNumber: "", phone: "", cellphone: "", email: "", password: "", role: "employee" });
      const s = await getStaff();
      setStaff(s);
    } catch (err: any) {
      setStaffMsg(err?.message || "Failed to register.");
    }
    setStaffLoading(false);
  };

  // ─── Service CRUD ──────────────────────────────────────────────────────────
  const handleSaveService = async () => {
    if (!serviceForm.name.trim()) { setServiceMsg("Service name is required."); return; }
    try {
      if (editingServiceId !== null) {
        await updateService(editingServiceId, serviceForm);
        setServiceMsg("✓ Service updated.");
        auditLog(adminUserId, "service.updated", "service", editingServiceId, { name: serviceForm.name });
      } else {
        await createService(serviceForm);
        setServiceMsg("✓ Service created.");
        auditLog(adminUserId, "service.created", "service", undefined, { name: serviceForm.name });
      }
      setServiceForm(emptyServiceForm());
      setEditingServiceId(null);
      setShowServiceForm(false);
      const svcs = await getAllServices();
      setServices(svcs);
    } catch (err: any) {
      setServiceMsg(err?.message || "Failed to save service.");
    }
    setTimeout(() => setServiceMsg(""), 3000);
  };

  const handleEditService = (svc: ServiceRow) => {
    setServiceForm({
      name: svc.name, description: svc.description || "",
      price_small: svc.price_small, price_large: svc.price_large,
      price_xl: svc.price_xl, price_truck: svc.price_truck,
      is_addon: svc.is_addon, is_active: svc.is_active, sort_order: svc.sort_order,
    });
    setEditingServiceId(svc.id);
    setShowServiceForm(true);
  };

  const handleToggleServiceActive = async (svc: ServiceRow) => {
    await updateService(svc.id, { is_active: !svc.is_active });
    setServices(prev => prev.map(s => s.id === svc.id ? { ...s, is_active: !s.is_active } : s));
    auditLog(adminUserId, "service.toggled", "service", svc.id, { name: svc.name, active: !svc.is_active });
  };

  const handleDeleteService = async (id: number) => {
    if (!confirm("Delete this service?")) return;
    const svc = services.find(s => s.id === id);
    await deleteService(id);
    setServices(prev => prev.filter(s => s.id !== id));
    auditLog(adminUserId, "service.deleted", "service", id, { name: svc?.name });
  };

  // ─── Commission ────────────────────────────────────────────────────────────
  const getEmployeeCommission = (employeeId: string) => {
    const jobs       = historyBookings.filter(b => b.assigned_employee_id === employeeId && b.status === "completed");
    const totalValue = jobs.reduce((s, b) => s + (b.totalPrice || b.price), 0);
    const earned     = Math.round(totalValue * (commissionPercent / 100));
    const paid       = commissionPayments.filter(p => p.employee_id === employeeId).reduce((s, p) => s + p.amount, 0);
    return { jobs: jobs.length, totalValue, earned, owed: Math.max(0, earned - paid), lifetimePaid: paid };
  };

  // ─── About & Legal handlers ────────────────────────────────────────────────
  const handleEditDoc = (doc: LegalDocument) => {
    setEditingDoc(doc.document_key);
    setDocForm({ title: doc.title, content: doc.content });
    setDocMsg("");
  };
  const handleSaveDoc = async () => {
    if (!editingDoc) return;
    try {
      await upsertLegalDocument(editingDoc, docForm);
      const docs = await getAllLegalDocuments();
      setLegalDocs(docs);
      setDocMsg("✓ Saved & version incremented.");
      setEditingDoc(null);
      auditLog(adminUserId, "content.document_saved", "legal_document", editingDoc, { title: docForm.title });
    } catch (e: any) { setDocMsg(e?.message || "Save failed."); }
    setTimeout(() => setDocMsg(""), 3000);
  };
  const handleEditMember = (member: TeamMember | null) => {
    if (!member) {
      setEditingMember("new");
      setMemberForm({ full_name:"", title:"", bio:"", image_url:"", display_order: teamMembers.length + 1 });
    } else {
      setEditingMember(member.id);
      setMemberForm({ full_name: member.full_name, title: member.title, bio: member.bio, image_url: member.image_url || "", display_order: member.display_order });
    }
    setMemberMsg("");
  };
  const handleSaveMember = async () => {
    if (!memberForm.full_name.trim()) { setMemberMsg("Name is required."); return; }
    try {
      if (editingMember === "new") {
        await createTeamMember(memberForm);
        auditLog(adminUserId, "content.team_member_created", "team_member", undefined, { name: memberForm.full_name });
      } else if (editingMember) {
        await updateTeamMember(editingMember, memberForm);
        auditLog(adminUserId, "content.team_member_updated", "team_member", editingMember, { name: memberForm.full_name });
      }
      const members = await getTeamMembers();
      setTeamMembers(members);
      setEditingMember(null);
      setMemberMsg("✓ Saved.");
    } catch (e: any) { setMemberMsg(e?.message || "Save failed."); }
    setTimeout(() => setMemberMsg(""), 3000);
  };
  const handleDeleteMember = async (id: string) => {
    if (!confirm("Delete this team member?")) return;
    const member = teamMembers.find(m => m.id === id);
    await deleteTeamMember(id);
    setTeamMembers(prev => prev.filter(m => m.id !== id));
    auditLog(adminUserId, "content.team_member_deleted", "team_member", id, { name: member?.full_name });
  };
  const handleMemberImageUpload = async (file: File) => {
    setMemberImgLoading(true);
    try {
      const url = await uploadTeamImage(file);
      setMemberForm(prev => ({ ...prev, image_url: url }));
    } catch (e: any) { setMemberMsg("Image upload failed: " + e?.message); }
    finally { setMemberImgLoading(false); }
  };

  const handlePayCommission = async (employeeId: string) => {
    const { owed } = getEmployeeCommission(employeeId);
    if (owed <= 0) return;
    await addCommissionPayment(employeeId, owed);
    setCommissionPayments(prev => [...prev, { employee_id: employeeId, amount: owed }]);
    auditLog(adminUserId, "commission.payment_recorded", "employee", employeeId, { amount: owed });
  };

  const handleSaveCommission = async () => {
    await saveCommissionPercentForAll(commissionPercent);
    setCommissionSaved(true);
    setTimeout(() => setCommissionSaved(false), 2500);
    auditLog(adminUserId, "commission.rate_changed", "settings", undefined, { rate: commissionPercent });
  };

  const getStaffName = (id: string) => {
    const s = staff.find(x => x.id === id);
    return s ? `${s.full_name} (${s.employee_number || "Admin"})` : "Unassigned";
  };


  // ─── Payout handlers ──────────────────────────────────────────────────────
  const loadPayouts = async (month: number, year: number) => {
    setPayoutLoading(true);
    setPayoutMsg(null);
    try {
      const [summaries, years] = await Promise.all([
        fetchSummaries(month, year),
        fetchSummaryYears(),
      ]);
      setPayoutSummaries(summaries);
      setPayoutYears(years);
    } catch (e: any) {
      setPayoutMsg({ text: e?.message || "Failed to load summaries", ok: false });
    }
    setPayoutLoading(false);
  };

  const handleGeneratePayouts = async (regenerate = false) => {
    setPayoutGenerating(true);
    setPayoutMsg(null);
    try {
      const result = await generateMonthlySummary(payoutMonth, payoutYear, regenerate);
      if (result.message) {
        setPayoutMsg({ text: result.message, ok: true });
      } else {
        setPayoutMsg({
          text: `Generated ${result.generated_count} of ${result.total_employees} employee summaries.${
            result.skipped.length ? ` Skipped ${result.skipped.length} (already locked or exists).` : ""
          }`,
          ok: true,
        });
      }
      await loadPayouts(payoutMonth, payoutYear);
    } catch (e: any) {
      setPayoutMsg({ text: e?.message || "Generation failed", ok: false });
    }
    setPayoutGenerating(false);
  };

  const handleApprove = async (summary: CommissionSummary) => {
    if (!adminUserId) return;
    try {
      await approveSummary(summary.id, adminUserId);
      setPayoutSummaries(prev => prev.map(s => s.id === summary.id ? { ...s, payout_status: "approved", approved_by: adminUserId } : s));
      setPayoutMsg({ text: `Approved commission for ${summary.employee_name}`, ok: true });
      auditLog(adminUserId, "commission.approved", "commission_summary", summary.id, {
        employee: summary.employee_name,
        amount: summary.total_commission,
        month: summary.month,
        year: summary.year,
      });
    } catch (e: any) {
      setPayoutMsg({ text: e?.message || "Approval failed", ok: false });
    }
    setTimeout(() => setPayoutMsg(null), 4000);
  };

  const handleMarkPaid = async (summary: CommissionSummary) => {
    if (!confirm(`Mark ${summary.employee_name}'s commission of N$ ${Number(summary.total_commission).toFixed(2)} as PAID? This cannot be undone.`)) return;
    try {
      await markSummaryPaid(summary.id);
      setPayoutSummaries(prev => prev.map(s => s.id === summary.id ? { ...s, payout_status: "paid", paid_at: new Date().toISOString() } : s));
      setPayoutMsg({ text: `Marked as paid for ${summary.employee_name}`, ok: true });
      auditLog(adminUserId, "commission.paid", "commission_summary", summary.id, {
        employee: summary.employee_name,
        amount: summary.total_commission,
        month: summary.month,
        year: summary.year,
      });
    } catch (e: any) {
      setPayoutMsg({ text: e?.message || "Mark paid failed", ok: false });
    }
    setTimeout(() => setPayoutMsg(null), 4000);
  };

  const handleSavePayoutNotes = async (summary: CommissionSummary) => {
    const notes = payoutNotesEdit[summary.id] ?? summary.notes ?? "";
    try {
      await updateSummaryNotes(summary.id, notes);
      setPayoutSummaries(prev => prev.map(s => s.id === summary.id ? { ...s, notes } : s));
      setPayoutNotesEdit(prev => { const n = { ...prev }; delete n[summary.id]; return n; });
    } catch (e: any) {
      setPayoutMsg({ text: e?.message || "Notes save failed", ok: false });
    }
  };

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: "analytics",     label: "Analytics",       icon: BarChart2 },
    { key: "bookings",      label: "Bookings",        icon: ClipboardList },
    { key: "history",       label: "History",         icon: History },
    { key: "payments",      label: "Payments",        icon: CreditCard },
    { key: "subscriptions", label: "Subscriptions",   icon: Zap },
    { key: "loyalty",       label: "Loyalty",         icon: Award },
    { key: "employees",     label: "Staff",           icon: Users },
    { key: "settings",      label: "Services",        icon: Settings },
    { key: "payouts",       label: "Payouts",         icon: ReceiptText },
    { key: "about",         label: "About & Legal",   icon: BookOpen },
    { key: "ads",           label: "Marketing",       icon: Megaphone },
    { key: "security",      label: "Security",        icon: ShieldCheck },
    { key: "audit",         label: "Audit Log",       icon: ClipboardList },
  ];


  // Load payouts when switching to payouts tab
  useEffect(() => {
    if (!authChecked || tab !== "payouts") return;
    loadPayouts(payoutMonth, payoutYear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, tab]);

  // Load security logs when switching to security tab
  useEffect(() => {
    if (!authChecked || tab !== "security") return;
    setSecLogsLoading(true);
    Promise.all([
      supabase.from("security_logs").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("abuse_blocks").select("*").order("blocked_at", { ascending: false }).limit(50),
    ]).then(([logs, blocks]) => {
      setSecLogs(logs.data ?? []);
      setAbuseBlocks(blocks.data ?? []);
    }).catch(() => {}).finally(() => setSecLogsLoading(false));
  }, [authChecked, tab]);

  // Load admin audit log when switching to audit tab
  useEffect(() => {
    if (!authChecked || tab !== "audit") return;
    setAuditLogsLoading(true);
    supabase
      .from("admin_audit_log")
      .select("*, admin:admin_id(full_name)")
      .order("created_at", { ascending: false })
      .limit(300)
      .then(({ data }) => setAuditLogs(data ?? []))
      .catch(() => {})
      .finally(() => setAuditLogsLoading(false));
  }, [authChecked, tab]);

  // ─── Render ────────────────────────────────────────────────────────────────
  // All hooks are declared above — safe to conditionally return here.
  if (!authChecked) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen car-pattern-bg">

      {/* ── Session guards ───────────────────────────────────────────────── */}
      {/* Re-auth modal — rendered when requireReAuth() is called */}
      <ReAuthGate />
      {/* Inactivity countdown banner */}
      <InactivityWarning show={showWarning} countdown={countdown} onStay={stayLoggedIn} />

      {/* Notification toasts */}
      <NotificationToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground px-3 sm:px-6 py-2.5 flex items-center justify-between shadow-lg gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button onClick={() => window.location.reload()} className="flex-shrink-0 flex items-center justify-center">
            <img src={logo} alt="Oasis Pure Cleaning CC" className="h-9 w-auto object-contain" />
          </button>
          {/* Always-visible title block */}
          <div className="min-w-0">
            <h1 className="font-display font-bold text-sm sm:text-base leading-tight">Oasis Pure Cleaning CC</h1>
            <p className="text-[10px] sm:text-xs text-primary-foreground/60 truncate">Admin Dashboard</p>
          </div>
        </div>

        {/* Admin identity pill — name always visible on all screen sizes */}
        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 bg-white/10 rounded-xl px-2.5 sm:px-3 py-1.5 border border-white/15">
            <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-secondary-foreground">
                {adminName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold leading-tight truncate max-w-[80px] sm:max-w-[140px]">{adminName}</p>
              <p className="text-[9px] text-primary-foreground/50 font-semibold uppercase tracking-wider">Administrator</p>
            </div>
          </div>
          <button onClick={fetchAll} className="text-primary-foreground/70 hover:text-primary-foreground p-2 rounded-lg hover:bg-white/10 transition">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={async () => {
              await auditAuthEvent(adminUserId, 'auth.admin_logout', undefined, getClientMeta());
              await logout();
              navigate("/admin/login");
            }}
            className="bg-red-600 text-white px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 hover:bg-red-700 transition"
          >
            <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 relative z-10">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Bookings", value: stats.total,     icon: Calendar,   color: "text-primary" },
            { label: "Pending",        value: stats.pending,   icon: Clock,      color: "text-orange-dark" },
            { label: "Active",         value: stats.confirmed, icon: CheckCircle,color: "text-info" },
            { label: "Revenue (N$)",   value: stats.revenue,   icon: DollarSign, color: "text-success" },
          ].map(s => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl shadow-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-xs font-bold text-foreground/70 uppercase tracking-wider">{s.label}</span>
              </div>
              <p className="text-2xl font-display font-bold">{s.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Tab bar */}
        <div className="sticky top-[52px] z-40 flex items-center gap-0.5 sm:gap-1 mb-4 sm:mb-6 bg-card rounded-xl p-1 sm:p-1.5 shadow-card overflow-x-auto scrollbar-none">
          {TABS.map(t => (
            <button
              key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition flex-1 justify-center whitespace-nowrap ${
                tab === t.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <t.icon className="w-4 h-4" /> <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* ══════════════════ BOOKINGS / HISTORY TAB ══════════════════ */}
        {(tab === "bookings" || tab === "history") && (
          <>
            {/* ── Bookings sub-tabs ── */}
            {tab === "bookings" && (
              <div className="mb-5 space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {([
                    { key: "today",    label: `Today (${todaySchedule.length})` },
                    { key: "upcoming", label: `Upcoming (${upcomingBookings.length})` },
                    { key: "past",     label: `Past / Incomplete (${pastIncomplete.length})` },
                  ] as const).map(st => (
                    <button
                      key={st.key}
                      onClick={() => setBookingSubTab(st.key)}
                      className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition ${
                        bookingSubTab === st.key
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-card text-foreground hover:bg-muted border border-border"
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
                <p className="text-sm font-medium text-foreground/70">
                  {bookingSubTab === "today"
                    ? `All bookings scheduled for today (${_todayDate}).`
                    : bookingSubTab === "upcoming"
                    ? "All future bookings regardless of status."
                    : "Past bookings that were never completed — pending, confirmed, or cancelled."}
                </p>
              </div>
            )}

            {/* ── History sub-tabs + export ── */}
            {tab === "history" && (
              <div className="mb-5 space-y-4">
                {/* Sub-tab selector */}
                <div className="flex items-center gap-2">
                  {([
                    { key: "completed",    label: `Completed (${completedBookingsHist.length})`,    color: "bg-green-600 text-white", inactive: "bg-card text-foreground/70 border border-border hover:border-green-400" },
                    { key: "cancellations",label: `Cancelled (${cancelledBookingsHist.length})`,    color: "bg-red-600 text-white",   inactive: "bg-card text-foreground/70 border border-border hover:border-red-400" },
                  ] as const).map(st => (
                    <button key={st.key} onClick={() => setHistorySubTab(st.key)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition ${historySubTab === st.key ? st.color : st.inactive}`}>
                      {st.label}
                    </button>
                  ))}
                </div>

                {/* Context line */}
                {historySubTab === "completed" ? (
                  <p className="text-sm font-semibold text-foreground">
                    Revenue:{" "}
                    <span className="text-success">N$ {completedBookingsHist.reduce((s, b) => s + (b.totalPrice || b.price), 0).toFixed(2)}</span>
                    <span className="text-foreground/60 font-normal ml-2">· {completedBookingsHist.length} completed job{completedBookingsHist.length !== 1 ? "s" : ""}</span>
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-foreground">
                    <span className="text-destructive">{cancelledBookingsHist.length}</span>
                    <span className="text-foreground/60 font-normal ml-2">cancelled booking{cancelledBookingsHist.length !== 1 ? "s" : ""} (includes late cancellations)</span>
                  </p>
                )}

                {/* Export panel */}
                <div className="bg-card rounded-xl border border-border p-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-foreground">Export History</p>
                  <div className="flex items-end gap-3 flex-wrap">
                    <div>
                      <label className="text-xs font-semibold text-foreground/70 block mb-1">Start Date</label>
                      <input type="date" value={histExportStart} onChange={e => setHistExportStart(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-foreground/70 block mb-1">End Date</label>
                      <input type="date" value={histExportEnd} onChange={e => setHistExportEnd(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30" />
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={!!histExportLoading}
                        onClick={async () => {
                          setHistExportLoading("csv");
                          try {
                            const today   = new Date();
                            const defEnd   = today.toISOString().slice(0, 10);
                            const past30   = new Date(today); past30.setDate(today.getDate() - 30);
                            const defStart = past30.toISOString().slice(0, 10);
                            const start = histExportStart || defStart;
                            const end   = histExportEnd   || defEnd;
                            const rows  = await fetchBookingsForExport(start, end);
                            exportHistoryCsv(rows as any, start, end);
                          } catch (e: any) { alert("Export failed: " + e?.message); }
                          setHistExportLoading(false);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-bold text-foreground hover:bg-muted transition disabled:opacity-50"
                      >
                        {histExportLoading === "csv" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} CSV
                      </button>
                      <button
                        disabled={!!histExportLoading}
                        onClick={async () => {
                          setHistExportLoading("xlsx");
                          try {
                            const today   = new Date();
                            const defEnd   = today.toISOString().slice(0, 10);
                            const past30   = new Date(today); past30.setDate(today.getDate() - 30);
                            const defStart = past30.toISOString().slice(0, 10);
                            const start = histExportStart || defStart;
                            const end   = histExportEnd   || defEnd;
                            const rows  = await fetchBookingsForExport(start, end);
                            exportHistoryXlsx(rows as any, start, end);
                          } catch (e: any) { alert("Export failed: " + e?.message); }
                          setHistExportLoading(false);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition disabled:opacity-50"
                      >
                        {histExportLoading === "xlsx" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />} Excel
                      </button>
                    </div>
                    <p className="text-xs text-foreground/60 w-full">Default: last 30 days if no date selected.</p>
                  </div>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-secondary" />
              </div>
            ) : displayed.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <div className="w-16 h-12 mx-auto mb-4 flex items-center justify-center opacity-50"><img src={logo} alt="" className="w-full h-full object-contain" /></div>
                <p className="font-semibold">{tab === "history" ? (historySubTab === "completed" ? "No completed bookings yet" : "No cancelled bookings") : "No bookings found"}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayed.map(booking => {
                  const cfg        = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
                  const StatusIcon = cfg.icon;
                  const expanded   = expandedId === booking.id;
                  const canComplete = booking.paid && (booking.status === "confirmed" || booking.status === "in_progress");

                  return (
                    <motion.div key={booking.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-xl shadow-card overflow-hidden">

                      {/* Summary row */}
                      <div
                        className="px-5 py-4 flex items-center gap-3 cursor-pointer hover:bg-muted/20 transition"
                        onClick={() => {
                          const newId = expanded ? null : booking.id!;
                          setExpandedId(newId);
                          if (newId) loadBookingImages(newId);
                        }}
                      >
                        <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shrink-0 ${cfg.color}`}>
                          <StatusIcon className="w-3.5 h-3.5" /> {cfg.label}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate text-foreground">{booking.fullName}</p>
                          <p className="text-xs font-medium text-foreground/70">{booking.date} • {booking.time}</p>
                        </div>
                        {booking.paid      && <BadgeCheck className="w-5 h-5 text-success shrink-0" />}
                        {booking.isVip     && <span className="text-xs font-bold text-orange-dark shrink-0">⭐ VIP</span>}
                        <p className="font-display font-bold text-secondary shrink-0">N$ {booking.totalPrice || booking.price}</p>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${expanded ? "rotate-180" : ""}`} />
                      </div>

                      {/* Expanded detail */}
                      {expanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                          className="border-t border-border px-5 py-5 bg-muted/10 space-y-4"
                        >
                          {/* Info grid */}
                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-secondary shrink-0" />
                                <a href={`tel:${booking.whatsapp}`} className="text-foreground hover:text-secondary transition font-medium">{booking.whatsapp || "N/A"}</a>
                              </div>
                              <div className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-secondary" />
                                <span className="text-foreground/80 font-medium">{booking.address || booking.address_text}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <CreditCard className="w-4 h-4 text-secondary shrink-0" />
                                <span className="text-foreground font-semibold">{booking.paymentType || "N/A"}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-secondary shrink-0" />
                                <span className="text-foreground/70 font-medium">Booked: {booking.created_at ? new Date(booking.created_at).toLocaleDateString() : "—"}</span>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Vehicles & Services</p>
                              {(booking.vehicles || []).map((v, i) => (
                                <div key={i} className="bg-card rounded-lg p-3 border border-border text-sm">
                                  <p className="font-semibold">{v.plateNumber} <span className="text-muted-foreground">({v.vehicleCategory})</span></p>
                                  <p className="text-muted-foreground text-xs mt-0.5">{v.services.join(", ")} — <span className="text-secondary font-bold">N$ {v.subtotal}</span></p>
                                </div>
                              ))}

                              {booking.assigned_employee_id && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Assigned: <strong className="text-foreground">{getStaffName(booking.assigned_employee_id)}</strong>
                                </p>
                              )}
                            </div>
                          </div>

                          {/* ── Split layout: Map (left) + Photos (right) ── */}
                          {(booking.latitude && booking.longitude) || bookingImages[booking.id!]?.length ? (
                            <div className="pt-3 border-t border-border">
                              <div className="grid md:grid-cols-2 gap-4">
                                {/* Left: Map */}
                                {booking.latitude && booking.longitude && (
                                  <div className="flex flex-col">
                                    <p className="text-xs font-bold uppercase tracking-wider text-foreground mb-2 flex items-center gap-1.5">
                                      <MapPin className="w-3.5 h-3.5 text-secondary" /> Location
                                    </p>
                                    <div className="rounded-xl overflow-hidden" style={{ maxHeight: 320 }}>
                                      <MapPicker
                                        initialLat={booking.latitude}
                                        initialLng={booking.longitude}
                                        readOnly showDirections
                                        onLocationSelect={() => {}}
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* Right: Job Photos */}
                                {(() => {
                                  const imgs    = bookingImages[booking.id!];
                                  const isLoad  = imagesLoading[booking.id!];
                                  return (
                                    <div className="flex flex-col">
                                      <h4 className="text-xs font-bold uppercase tracking-wider text-foreground mb-2 flex items-center gap-1.5">
                                        <Camera className="w-3.5 h-3.5 text-secondary" /> Job Photos
                                        {imgs && imgs.length > 0 && <span className="ml-1 text-foreground/60">({imgs.length})</span>}
                                      </h4>
                                      {isLoad ? (
                                        <div className="flex items-center gap-2 text-sm text-foreground/60 py-3">
                                          <Loader2 className="w-4 h-4 animate-spin" /> Loading photos…
                                        </div>
                                      ) : !imgs || imgs.length === 0 ? (
                                        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-border rounded-xl p-6 text-foreground/50">
                                          <div className="text-center">
                                            <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                            <p className="text-xs">No photos uploaded yet</p>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="overflow-y-auto max-h-72 grid grid-cols-3 gap-2 pr-1">
                                          {imgs.map(img => (
                                            <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden bg-muted border border-border flex-shrink-0">
                                              {img.signedUrl ? (
                                                <img
                                                  src={img.signedUrl}
                                                  alt="Job photo"
                                                  loading="lazy"
                                                  className="w-full h-full object-cover cursor-pointer transition group-hover:brightness-90"
                                                  onClick={() => setImagesLightbox(img)}
                                                />
                                              ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                  <ImageIcon className="w-5 h-5 opacity-30" />
                                                </div>
                                              )}
                                              <button
                                                onClick={async () => {
                                                  if (!confirm("Delete this photo?")) return;
                                                  try {
                                                    await deleteJobPhoto(img.id);
                                                    setBookingImages(prev => ({ ...prev, [booking.id!]: (prev[booking.id!] || []).filter(i => i.id !== img.id) }));
                                                  } catch (e: any) { alert(e?.message); }
                                                }}
                                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-destructive"
                                              >
                                                <X className="w-2.5 h-2.5" />
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          ) : null}

                          {/* ── Action controls (active bookings only) ── */}
                          {tab === "bookings" && (
                            <div className="pt-3 border-t border-border space-y-3">

                              {/* Paid toggle */}
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Payment:</span>
                                <button
                                  onClick={() => handlePaidToggle(booking.id!, !booking.paid)}
                                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition flex items-center gap-1.5 ${
                                    booking.paid
                                      ? "bg-success/20 text-success hover:bg-success/30"
                                      : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                                  }`}
                                >
                                  {booking.paid ? <><BadgeCheck className="w-3.5 h-3.5" /> Paid</> : "✗ Unpaid — Mark Paid"}
                                </button>
                              </div>

                              {/* Assign employee */}
                              {staff.filter(s => s.role === "employee").length > 0 && (
                                <div className="flex items-center gap-3 flex-wrap">
                                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Assign to:</span>
                                  <select
                                    value={booking.assigned_employee_id || ""}
                                    onChange={(e) => handleAssign(booking.id!, e.target.value)}
                                    className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                  >
                                    <option value="">— Unassigned —</option>
                                    {staff.filter(s => s.role === "employee").map(s => (
                                      <option key={s.id} value={s.id}>{s.full_name} ({s.employee_number})</option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              {/* Action buttons */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mr-1">Actions:</span>

                                {booking.status === "pending" && (
                                  <button
                                    onClick={() => { handleStatusChange(booking.id!, "confirmed"); openWhatsApp(booking, "confirm"); }}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase bg-info/20 text-info hover:bg-info/30 transition flex items-center gap-1.5"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" /> Confirm + WhatsApp
                                  </button>
                                )}

                                {booking.status === "confirmed" && (
                                  <button
                                    onClick={() => openWhatsApp(booking, "confirm")}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase bg-muted text-muted-foreground hover:bg-muted/80 transition flex items-center gap-1.5"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" /> Resend WhatsApp
                                  </button>
                                )}

                                {canComplete && (
                                  <button
                                    onClick={() => handleStatusChange(booking.id!, "completed")}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase bg-success/20 text-success hover:bg-success/30 transition flex items-center gap-1.5"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" /> Complete
                                  </button>
                                )}

                                {!canComplete && booking.status !== "pending" && booking.status !== "cancelled" && (
                                  <span className="text-xs text-muted-foreground italic">
                                    {!booking.paid ? "Must be marked paid first" : ""}
                                  </span>
                                )}

                                <button
                                  onClick={() => { handleStatusChange(booking.id!, "cancelled"); openWhatsApp(booking, "cancel"); }}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase bg-destructive/10 text-destructive hover:bg-destructive/20 transition"
                                >
                                  Cancel
                                </button>

                                <button
                                  onClick={() => handleDelete(booking.id!)}
                                  className="ml-auto p-2 rounded-lg text-destructive hover:bg-destructive/10 transition"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )}

                          {/* History meta */}
                          {tab === "history" && (
                            <div className="pt-3 border-t border-border text-sm text-foreground/80 flex gap-6 flex-wrap items-center">
                              <span className="font-medium">Assigned: <strong className="text-foreground">{booking.assigned_employee_id ? getStaffName(booking.assigned_employee_id) : "N/A"}</strong></span>
                              <span className="font-medium">Payment: <strong className={booking.paid ? "text-success" : "text-destructive"}>{booking.paid ? "Paid" : "Unpaid"}</strong></span>

                              {/* Cancellation type badge */}
                              {(booking.status === "cancelled" || booking.status === "late_cancelled") && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${
                                  booking.status === "late_cancelled"
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                    : "bg-muted text-muted-foreground"
                                }`}>
                                  {booking.status === "late_cancelled"
                                    ? <><AlertTriangle className="w-3 h-3" /> Late Cancel</>
                                    : "Normal Cancel"
                                  }
                                </span>
                              )}
                              {booking.cancelled_at && (
                                <span>At: <strong className="text-foreground">{toNamibiaDisplay(booking.cancelled_at)}</strong></span>
                              )}

                              <button onClick={() => handleDelete(booking.id!)} className="ml-auto text-destructive hover:text-destructive/80 transition flex items-center gap-1">
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                              </button>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ══════════════════ STAFF TAB ══════════════════ */}
        {tab === "employees" && (
          <div className="space-y-6">

            {/* Register form */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl shadow-card p-6">
              <h3 className="font-display font-bold text-lg mb-5 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-secondary" /> Register Staff Member
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <input placeholder="First Name *" value={staffForm.name}
                  onChange={e => setStaffForm({ ...staffForm, name: e.target.value })}
                  className="px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition" />
                <input placeholder="Last Name *" value={staffForm.surname}
                  onChange={e => setStaffForm({ ...staffForm, surname: e.target.value })}
                  className="px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition" />
                <input placeholder="ID Number" value={staffForm.idNumber}
                  onChange={e => setStaffForm({ ...staffForm, idNumber: e.target.value })}
                  className="px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition" />
                <input placeholder="Cellphone *" value={staffForm.cellphone}
                  onChange={e => setStaffForm({ ...staffForm, cellphone: e.target.value })}
                  className="px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition" />
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="email" placeholder="Email *" value={staffForm.email}
                    onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition" />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="password" placeholder="Password *" value={staffForm.password}
                    onChange={e => setStaffForm({ ...staffForm, password: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition" />
                </div>

                {/* Role selector */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Role *</label>
                  <select
                    value={staffForm.role}
                    onChange={e => setStaffForm({ ...staffForm, role: e.target.value as "admin" | "employee" })}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                  >
                    <option value="employee">Employee</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              {staffMsg && (
                <p className={`text-sm mb-3 ${staffMsg.startsWith("✓") ? "text-success" : "text-destructive"}`}>{staffMsg}</p>
              )}
              <button
                onClick={handleAddStaff} disabled={staffLoading}
                className="bg-secondary text-secondary-foreground px-6 py-3 rounded-lg font-bold hover:opacity-90 transition flex items-center gap-2 shadow-orange disabled:opacity-50"
              >
                {staffLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Register
              </button>
            </motion.div>

            {/* Staff list */}
            <div className="bg-card rounded-xl shadow-card overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-display font-bold text-lg">Staff ({staff.length})</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Roles are assigned at registration and cannot be changed after.
                  </p>
                </div>
                <div className="flex gap-2 text-xs font-semibold">
                  <span className="px-2 py-1 rounded-full bg-primary/10 text-primary">Admin: {staff.filter(s => s.role === "admin").length}</span>
                  <span className="px-2 py-1 rounded-full bg-info/10 text-info">Employee: {staff.filter(s => s.role === "employee").length}</span>
                </div>
              </div>
              {staff.length === 0 ? (
                <p className="text-muted-foreground text-sm p-6">No staff registered yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left py-3 px-4 text-xs font-bold uppercase text-muted-foreground">Full Name</th>
                        <th className="text-left py-3 px-4 text-xs font-bold uppercase text-muted-foreground">Role</th>
                        <th className="text-left py-3 px-4 text-xs font-bold uppercase text-muted-foreground">Emp No.</th>
                        <th className="text-left py-3 px-4 text-xs font-bold uppercase text-muted-foreground">Email</th>
                        <th className="text-left py-3 px-4 text-xs font-bold uppercase text-muted-foreground">Cellphone</th>
                        <th className="py-3 px-4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Admins first, then employees */}
                      {[...staff].sort((a, b) => {
                        if (a.role === b.role) return a.full_name.localeCompare(b.full_name);
                        return a.role === "admin" ? -1 : 1;
                      }).map(s => (
                        <tr key={s.id} className="border-b border-border/50 hover:bg-muted/20 transition">
                          <td className="py-3 px-4 font-semibold">{s.full_name}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              s.role === "admin"
                                ? "bg-primary/10 text-primary"
                                : "bg-info/10 text-info"
                            }`}>
                              {s.role === "admin" ? "Admin" : "Employee"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground font-mono text-xs">{s.employee_number || "—"}</td>
                          <td className="py-3 px-4 text-muted-foreground truncate max-w-[160px]">{s.email}</td>
                          <td className="py-3 px-4 text-muted-foreground">{s.cellphone || "—"}</td>
                          <td className="py-3 px-4">
                            {(s.role === "admin" || s.role === "employee") && (
                              <button
                                onClick={async () => {
                                  if (!confirm(`Remove ${s.full_name} from staff?`)) return;
                                  try { await requireReAuth(); } catch { return; }
                                  await deleteStaffMember(s.id);
                                  setStaff(prev => prev.filter(x => x.id !== s.id));
                                  auditLog(adminUserId, "employee.deleted", "employee", s.id, { name: s.full_name, role: s.role });
                                }}
                                className="p-1.5 rounded text-destructive hover:bg-destructive/10 transition"
                                title="Remove staff member"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════ SERVICES / SETTINGS TAB ══════════════════ */}
        {tab === "settings" && (
          <div className="space-y-6">

            {/* Service form */}
            <AnimatePresence>
              {showServiceForm && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="bg-card rounded-xl shadow-card p-6 border-2 border-secondary/30"
                >
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-display font-bold text-lg flex items-center gap-2">
                      <Settings className="w-5 h-5 text-secondary" />
                      {editingServiceId !== null ? "Edit Service" : "Add New Service"}
                    </h3>
                    <button onClick={() => { setShowServiceForm(false); setEditingServiceId(null); setServiceForm(emptyServiceForm()); }}
                      className="p-2 rounded-lg hover:bg-muted transition text-muted-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Service Name *</label>
                      <input
                        placeholder="e.g. Full Detailing"
                        value={serviceForm.name}
                        onChange={e => setServiceForm({ ...serviceForm, name: e.target.value })}
                        className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Description</label>
                      <input
                        placeholder="Short description shown to customers"
                        value={serviceForm.description || ""}
                        onChange={e => setServiceForm({ ...serviceForm, description: e.target.value })}
                        className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Price – Small (N$)</label>
                      <input type="number" min={0} value={serviceForm.price_small}
                        onChange={e => setServiceForm({ ...serviceForm, price_small: +e.target.value })}
                        className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition" />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Price – Large (N$)</label>
                      <input type="number" min={0} value={serviceForm.price_large}
                        onChange={e => setServiceForm({ ...serviceForm, price_large: +e.target.value })}
                        className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition" />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Price – XL (N$)</label>
                      <input type="number" min={0} value={serviceForm.price_xl}
                        onChange={e => setServiceForm({ ...serviceForm, price_xl: +e.target.value })}
                        className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition" />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Price – Truck (N$)</label>
                      <input type="number" min={0} value={serviceForm.price_truck}
                        onChange={e => setServiceForm({ ...serviceForm, price_truck: +e.target.value })}
                        className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition" />
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={serviceForm.is_addon}
                          onChange={e => setServiceForm({ ...serviceForm, is_addon: e.target.checked })}
                          className="w-4 h-4 accent-secondary" />
                        <span className="text-sm font-semibold">Add-on service</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={serviceForm.is_active}
                          onChange={e => setServiceForm({ ...serviceForm, is_active: e.target.checked })}
                          className="w-4 h-4 accent-secondary" />
                        <span className="text-sm font-semibold">Active</span>
                      </label>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Display Order</label>
                      <input type="number" min={0} value={serviceForm.sort_order}
                        onChange={e => setServiceForm({ ...serviceForm, sort_order: +e.target.value })}
                        className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition" />
                    </div>
                  </div>

                  {serviceMsg && (
                    <p className={`text-sm mb-3 ${serviceMsg.startsWith("✓") ? "text-success" : "text-destructive"}`}>{serviceMsg}</p>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveService}
                      className="bg-secondary text-secondary-foreground px-6 py-3 rounded-lg font-bold hover:opacity-90 transition flex items-center gap-2 shadow-orange"
                    >
                      <Save className="w-4 h-4" /> {editingServiceId !== null ? "Update Service" : "Create Service"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Services table */}
            <div className="bg-card rounded-xl shadow-card overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h3 className="font-display font-bold text-lg">Services ({services.length})</h3>
                <button
                  onClick={() => { setShowServiceForm(true); setEditingServiceId(null); setServiceForm(emptyServiceForm()); }}
                  className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition flex items-center gap-2 shadow-orange"
                >
                  <Plus className="w-4 h-4" /> Add Service
                </button>
              </div>

              {services.length === 0 ? (
                <p className="text-muted-foreground text-sm p-6">No services configured yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left py-3 px-4 text-xs font-bold uppercase text-muted-foreground">Service</th>
                        <th className="text-center py-3 px-3 text-xs font-bold uppercase text-muted-foreground">Small</th>
                        <th className="text-center py-3 px-3 text-xs font-bold uppercase text-muted-foreground">Large</th>
                        <th className="text-center py-3 px-3 text-xs font-bold uppercase text-muted-foreground">XL</th>
                        <th className="text-center py-3 px-3 text-xs font-bold uppercase text-muted-foreground">Truck</th>
                        <th className="text-center py-3 px-3 text-xs font-bold uppercase text-muted-foreground">Type</th>
                        <th className="text-center py-3 px-3 text-xs font-bold uppercase text-muted-foreground">Status</th>
                        <th className="py-3 px-4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.map(svc => (
                        <tr key={svc.id} className={`border-b border-border/50 hover:bg-muted/20 transition ${!svc.is_active ? "opacity-50" : ""}`}>
                          <td className="py-3 px-4">
                            <p className="font-semibold">{svc.name}</p>
                            {svc.description && <p className="text-xs text-muted-foreground">{svc.description}</p>}
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-secondary font-bold">N${svc.price_small}</td>
                          <td className="py-3 px-3 text-center font-mono text-secondary font-bold">N${svc.price_large}</td>
                          <td className="py-3 px-3 text-center font-mono text-secondary font-bold">N${svc.price_xl}</td>
                          <td className="py-3 px-3 text-center font-mono text-secondary font-bold">N${svc.price_truck}</td>
                          <td className="py-3 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${svc.is_addon ? "bg-info/10 text-info" : "bg-primary/10 text-primary"}`}>
                              {svc.is_addon ? "Add-on" : "Primary"}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button onClick={() => handleToggleServiceActive(svc)} className="text-muted-foreground hover:text-foreground transition">
                              {svc.is_active
                                ? <ToggleRight className="w-5 h-5 text-success" />
                                : <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                              }
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleEditService(svc)} className="p-1.5 rounded hover:bg-muted transition text-muted-foreground hover:text-foreground">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDeleteService(svc.id)} className="p-1.5 rounded hover:bg-destructive/10 transition text-destructive">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Commission rate */}
            <div className="bg-card rounded-xl shadow-card p-6">
              <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
                <Percent className="w-5 h-5 text-secondary" /> Default Commission Rate
              </h3>
              <div className="flex items-center gap-4">
                <input
                  type="number" min={0} max={100} value={commissionPercent}
                  onChange={e => setCommissionPercent(+e.target.value)}
                  className="w-24 px-4 py-3 rounded-lg border border-border bg-background text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-xl font-bold text-muted-foreground">%</span>
                <button
                  onClick={handleSaveCommission}
                  className="bg-secondary text-secondary-foreground px-6 py-3 rounded-lg font-bold hover:opacity-90 transition flex items-center gap-2 shadow-orange"
                >
                  <Save className="w-4 h-4" /> Save
                </button>
                {commissionSaved && <span className="text-sm text-success font-semibold">✓ Saved!</span>}
              </div>
            </div>
          </div>
        )}


        {/* ══════════════════ PAYOUTS TAB ══════════════════ */}
        {tab === "payouts" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

            {/* ── Header ── */}
            <div className="bg-card rounded-xl shadow-card p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
                <div>
                  <h3 className="font-display font-bold text-xl flex items-center gap-2">
                    <ReceiptText className="w-5 h-5 text-secondary" /> Monthly Commission Payouts
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Generate, approve, and export monthly payslips. Commission is {commissionPercent}% of original service price (free wash jobs included).
                  </p>
                </div>
                {/* Export buttons — only when summaries exist */}
                {payoutSummaries.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => exportMonthCsv(payoutSummaries, payoutMonth, payoutYear)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-muted text-muted-foreground hover:bg-muted/80 transition"
                    >
                      <Download className="w-3.5 h-3.5" /> CSV
                    </button>
                    <button
                      onClick={() => exportMonthXlsx(payoutSummaries, payoutMonth, payoutYear)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700 transition"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel
                    </button>
                  </div>
                )}
              </div>

              {/* Period selector + Generate */}
              <div className="flex items-end gap-3 flex-wrap">
                {/* Employee filter */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Employee</label>
                  <select value={payoutEmpFilter} onChange={e => setPayoutEmpFilter(e.target.value)}
                    className="px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/30">
                    <option value="all">All Employees</option>
                    {staff.filter(s => s.role === "employee").map(s => (
                      <option key={s.id} value={s.id}>{s.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Month</label>
                  <select
                    value={payoutMonth}
                    onChange={e => setPayoutMonth(+e.target.value)}
                    className="px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
                  >
                    {MONTH_NAMES.map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Year</label>
                  <select
                    value={payoutYear}
                    onChange={e => setPayoutYear(+e.target.value)}
                    className="px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
                  >
                    {payoutYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <button
                  onClick={() => loadPayouts(payoutMonth, payoutYear)}
                  disabled={payoutLoading}
                  className="px-4 py-2.5 rounded-lg border border-border text-sm font-bold hover:bg-muted transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {payoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Load
                </button>
                <button
                  onClick={() => handleGeneratePayouts(false)}
                  disabled={payoutGenerating}
                  className="px-4 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-bold hover:opacity-90 transition shadow-orange flex items-center gap-1.5 disabled:opacity-50"
                >
                  {payoutGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ReceiptText className="w-4 h-4" />}
                  {payoutGenerating ? "Generating…" : "Generate Summary"}
                </button>
                {payoutSummaries.some(s => s.payout_status === "pending") && (
                  <button
                    onClick={() => handleGeneratePayouts(true)}
                    disabled={payoutGenerating}
                    className="px-4 py-2.5 rounded-lg border border-secondary/40 text-secondary text-sm font-bold hover:bg-secondary/10 transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                  </button>
                )}
              </div>

              {/* Feedback message */}
              <AnimatePresence>
                {payoutMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className={`mt-4 px-4 py-3 rounded-lg text-sm font-semibold flex items-center gap-2 ${
                      payoutMsg.ok
                        ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400"
                        : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400"
                    }`}
                  >
                    {payoutMsg.ok ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                    {payoutMsg.text}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Summary table ── */}
            {payoutLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-secondary" />
              </div>
            ) : payoutSummaries.length === 0 ? (
              <div className="bg-card rounded-xl shadow-card p-10 text-center text-muted-foreground">
                <ReceiptText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No commission summaries for {monthName(payoutMonth)} {payoutYear}</p>
                <p className="text-xs mt-1">Click "Generate Summary" to compute from completed bookings.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Totals banner */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total Jobs",       value: payoutSummaries.reduce((s, x) => s + x.total_jobs, 0),                                         icon: Briefcase,    color: "text-blue-600"  },
                    { label: "Total Revenue",    value: `N$ ${payoutSummaries.reduce((s, x) => s + Number(x.total_revenue), 0).toFixed(2)}`,            icon: DollarSign,   color: "text-green-600" },
                    { label: "Total Commission", value: `N$ ${payoutSummaries.reduce((s, x) => s + Number(x.total_commission), 0).toFixed(2)}`,         icon: Banknote,     color: "text-secondary" },
                  ].map(stat => (
                    <div key={stat.label} className="bg-card rounded-xl shadow-card p-4 text-center">
                      <stat.icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className={`font-display font-bold text-lg ${stat.color}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Per-employee cards */}
                {payoutSummaries
                  .filter(s => payoutEmpFilter === "all" || s.employee_id === payoutEmpFilter)
                  .map(summary => {
                  const sc      = PAYOUT_STATUS_CONFIG[summary.payout_status] ?? PAYOUT_STATUS_CONFIG.pending;
                  const expanded = expandedPayout === summary.id;
                  const isPaid   = summary.payout_status === "paid";
                  const isApproved = summary.payout_status === "approved";

                  return (
                    <motion.div key={summary.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="bg-card rounded-xl shadow-card overflow-hidden">

                      {/* Summary row */}
                      <div
                        className="px-5 py-4 flex items-center gap-3 cursor-pointer hover:bg-muted/20 transition"
                        onClick={() => setExpandedPayout(expanded ? null : summary.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{summary.employee_name}</p>
                          <p className="text-xs font-medium text-foreground/70">{summary.employee_number} · {summary.total_jobs} jobs · Revenue N$ {Number(summary.total_revenue).toFixed(2)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-display font-bold text-secondary">N$ {Number(summary.total_commission).toFixed(2)}</p>
                          <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${sc.bg} ${sc.color}`}>{sc.label}</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${expanded ? "rotate-180" : ""}`} />
                      </div>

                      {/* Expanded detail */}
                      <AnimatePresence>
                        {expanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            className="border-t border-border px-5 py-5 bg-muted/10 space-y-4"
                          >
                            {/* Commission breakdown */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                              {[
                                { label: "Total Jobs",       value: summary.total_jobs },
                                { label: "Total Revenue",    value: `N$ ${Number(summary.total_revenue).toFixed(2)}` },
                                { label: `Rate (${summary.commission_rate ?? commissionPercent}%)`, value: `× ${summary.commission_rate ?? commissionPercent}%` },
                                { label: "Commission Due",   value: `N$ ${Number(summary.total_commission).toFixed(2)}` },
                              ].map(item => (
                                <div key={item.label} className="bg-card rounded-lg p-3 border border-border text-center">
                                  <p className="text-xs font-semibold text-foreground/70 mb-0.5">{item.label}</p>
                                  <p className="font-bold">{item.value}</p>
                                </div>
                              ))}
                            </div>

                            {/* Meta */}
                            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                              <span>Generated: <strong className="text-foreground">{new Date(summary.generated_at).toLocaleString("en-NA")}</strong></span>
                              {summary.paid_at && <span>Paid at: <strong className="text-green-600">{new Date(summary.paid_at).toLocaleString("en-NA")}</strong></span>}
                              {summary.approved_by_name && <span>Approved by: <strong className="text-foreground">{summary.approved_by_name}</strong></span>}
                            </div>

                            {/* Notes */}
                            {!isPaid ? (
                              <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Notes (optional)</label>
                                <div className="flex gap-2">
                                  <input
                                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
                                    placeholder="Add payment notes…"
                                    value={payoutNotesEdit[summary.id] ?? summary.notes ?? ""}
                                    onChange={e => setPayoutNotesEdit(prev => ({ ...prev, [summary.id]: e.target.value }))}
                                  />
                                  {payoutNotesEdit[summary.id] !== undefined && (
                                    <button onClick={() => handleSavePayoutNotes(summary)}
                                      className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-bold hover:opacity-90 transition flex items-center gap-1">
                                      <Save className="w-3.5 h-3.5" /> Save
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : summary.notes ? (
                              <p className="text-xs text-muted-foreground italic">Notes: {summary.notes}</p>
                            ) : null}

                            {/* Actions */}
                            <div className="flex items-center justify-between pt-3 border-t border-border gap-3 flex-wrap">
                              <div className="flex gap-2 flex-wrap">
                                {summary.payout_status === "pending" && (
                                  <button onClick={() => handleApprove(summary)}
                                    className="px-4 py-2 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold hover:bg-blue-200 transition flex items-center gap-1.5">
                                    <CheckSquare className="w-3.5 h-3.5" /> Approve
                                  </button>
                                )}
                                {isApproved && (
                                  <button onClick={() => handleMarkPaid(summary)}
                                    className="px-4 py-2 rounded-lg bg-green-100 text-green-700 text-xs font-bold hover:bg-green-200 transition flex items-center gap-1.5">
                                    <Banknote className="w-3.5 h-3.5" /> Mark as Paid
                                  </button>
                                )}
                                {isPaid && (
                                  <span className="px-4 py-2 rounded-lg bg-green-50 text-green-700 text-xs font-bold flex items-center gap-1.5">
                                    <CheckCircle className="w-3.5 h-3.5" /> Paid &amp; Locked
                                  </span>
                                )}
                              </div>
                              {/* Per-employee export + payslip */}
                              <div className="flex gap-2 flex-wrap">
                                <button onClick={() => exportSingleCsv(summary)}
                                  className="px-3 py-1.5 rounded-lg border border-border text-xs font-bold hover:bg-muted transition flex items-center gap-1">
                                  <Download className="w-3 h-3" /> CSV
                                </button>
                                <button onClick={() => exportSingleXlsx(summary)}
                                  className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition flex items-center gap-1">
                                  <FileSpreadsheet className="w-3 h-3" /> XLSX
                                </button>
                                <button
                                  onClick={() => generatePayslipPdf(summary, commissionPercent)}
                                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition flex items-center gap-1">
                                  <ReceiptText className="w-3 h-3" /> PDF Payslip
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* ══ Commission Per Employee (merged) ══ */}
            <div className="mt-2 space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-bold uppercase tracking-widest text-foreground/50 px-3">Commission Tracker</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Export commission by date range */}
              <div className="bg-card rounded-xl shadow-card p-5 border border-border">
                <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <Download className="w-4 h-4 text-secondary" /> Export Commission by Date Range
                </h4>
                <div className="flex items-end gap-3 flex-wrap">
                  <div>
                    <label className="text-xs font-semibold text-foreground/70 block mb-1">Start Date</label>
                    <input type="date" value={commExportStart} onChange={e => setCommExportStart(e.target.value)}
                      className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground/70 block mb-1">End Date</label>
                    <input type="date" value={commExportEnd} onChange={e => setCommExportEnd(e.target.value)}
                      className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30" />
                  </div>
                  <div className="flex gap-2">
                    <button disabled={!!commExportLoading}
                      onClick={async () => {
                        setCommExportLoading("csv");
                        try {
                          const today = new Date(); const defEnd = today.toISOString().slice(0,10);
                          const past30 = new Date(today); past30.setDate(today.getDate()-30);
                          const start = commExportStart || past30.toISOString().slice(0,10);
                          const end   = commExportEnd   || defEnd;
                          const rows  = await fetchCommissionExportData(start, end);
                          exportCommissionCsv(rows as any, start, end);
                        } catch (e: any) { alert("Export failed: " + e?.message); }
                        setCommExportLoading(false);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-bold text-foreground hover:bg-muted transition disabled:opacity-50">
                      {commExportLoading === "csv" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} CSV
                    </button>
                    <button disabled={!!commExportLoading}
                      onClick={async () => {
                        setCommExportLoading("xlsx");
                        try {
                          const today = new Date(); const defEnd = today.toISOString().slice(0,10);
                          const past30 = new Date(today); past30.setDate(today.getDate()-30);
                          const start = commExportStart || past30.toISOString().slice(0,10);
                          const end   = commExportEnd   || defEnd;
                          const rows  = await fetchCommissionExportData(start, end);
                          exportCommissionXlsx(rows as any, start, end);
                        } catch (e: any) { alert("Export failed: " + e?.message); }
                        setCommExportLoading(false);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition disabled:opacity-50">
                      {commExportLoading === "xlsx" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />} Excel
                    </button>
                  </div>
                  <p className="text-xs text-foreground/60 w-full">Default: last 30 days · includes all employees</p>
                </div>
              </div>

              {/* Per-employee commission cards */}
              <div className="bg-card rounded-xl shadow-card p-6">
                <h3 className="font-display font-bold text-xl mb-1 flex items-center gap-2">
                  <Percent className="w-5 h-5 text-secondary" /> Employee Commission
                </h3>
                <p className="text-sm font-medium text-foreground/80 mb-6">Current rate: <strong className="text-foreground">{commissionPercent}%</strong> of completed job value.</p>
                {staff.filter(s => s.role === "employee").length === 0 ? (
                  <p className="text-muted-foreground text-sm">No employees registered yet.</p>
                ) : (
                  <div className="space-y-3">
                    {staff.filter(s => s.role === "employee").map(s => {
                      const comm = getEmployeeCommission(s.id);
                      return (
                        <div key={s.id} className="bg-muted/30 rounded-xl border border-border p-5">
                          <div className="flex items-start justify-between mb-3 gap-4 flex-wrap">
                            <div>
                              <p className="font-semibold text-lg">{s.full_name}</p>
                              <p className="text-xs font-medium text-foreground/70">{s.employee_number} • {comm.jobs} completed jobs</p>
                            </div>
                            <div className="text-right text-sm">
                              <p className="text-muted-foreground">Total Job Value: <strong className="text-foreground">N$ {comm.totalValue}</strong></p>
                              <p className="text-muted-foreground">Commission ({commissionPercent}%): <strong className="text-secondary">N$ {comm.earned}</strong></p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-3 border-t border-border gap-3 flex-wrap">
                            <div className="flex items-center gap-4">
                              <span className={`text-sm font-bold ${comm.owed > 0 ? "text-orange-dark" : "text-success"}`}>Owed: N$ {comm.owed}</span>
                              <span className="text-xs text-muted-foreground">Lifetime Paid: <strong className="text-foreground">N$ {comm.lifetimePaid}</strong></span>
                            </div>
                            <div className="flex gap-2">
                              <button disabled={comm.owed <= 0} onClick={() => handlePayCommission(s.id)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition ${comm.owed > 0 ? "bg-success/20 text-success hover:bg-success/30" : "bg-muted text-muted-foreground cursor-not-allowed"}`}>
                                {comm.owed > 0 ? `Pay N$ ${comm.owed}` : "✓ Settled"}
                              </button>
                              <button onClick={async () => { await resetEmployeeCommission(s.id); fetchAll(); }}
                                className="px-4 py-2 rounded-lg text-xs font-bold uppercase bg-destructive/10 text-destructive hover:bg-destructive/20 transition">
                                Reset
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ══════════════════ ABOUT & LEGAL TAB ══════════════════ */}
        {tab === "about" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

            {legalLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-secondary" />
              </div>
            ) : (
              <>
                {/* ── Legal Documents ── */}
                <div className="bg-card rounded-xl shadow-card p-6">
                  <h3 className="font-display font-bold text-xl mb-1 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-secondary" /> Legal & Content Documents
                  </h3>
                  <p className="text-sm text-muted-foreground mb-5">Edit any document — version auto-increments on save. Changes appear on the booking page immediately.</p>

                  {docMsg && (
                    <div className={`text-sm font-semibold mb-4 p-3 rounded-lg ${docMsg.startsWith("✓") ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                      {docMsg}
                    </div>
                  )}

                  <div className="space-y-4">
                    {legalDocs.map(doc => (
                      <div key={doc.document_key} className="border border-border rounded-xl overflow-hidden">
                        {/* Doc header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <span className="font-semibold text-sm">{doc.title}</span>
                              <span className="ml-2 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                v{doc.version} · {new Date(doc.updated_at).toLocaleDateString("en-NA")}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => editingDoc === doc.document_key ? setEditingDoc(null) : handleEditDoc(doc)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition flex items-center gap-1.5 ${
                              editingDoc === doc.document_key
                                ? "bg-muted text-muted-foreground"
                                : "bg-secondary/10 text-secondary hover:bg-secondary/20"
                            }`}
                          >
                            {editingDoc === doc.document_key ? <><ChevronUp className="w-3 h-3" /> Collapse</> : <><Edit2 className="w-3 h-3" /> Edit</>}
                          </button>
                        </div>

                        {/* Inline editor */}
                        {editingDoc === doc.document_key && (
                          <div className="p-4 space-y-3 border-t border-border bg-background">
                            <div>
                              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Title</label>
                              <input
                                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-secondary/30 transition"
                                value={docForm.title}
                                onChange={e => setDocForm(p => ({ ...p, title: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Content</label>
                              <textarea
                                rows={14}
                                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-secondary/30 transition resize-y font-mono"
                                value={docForm.content}
                                onChange={e => setDocForm(p => ({ ...p, content: e.target.value }))}
                                placeholder="Enter document content..."
                              />
                              <p className="text-xs text-muted-foreground mt-1">Use double line breaks to separate paragraphs. Start lines with "- " for bullet points.</p>
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button onClick={handleSaveDoc}
                                className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-xs font-bold uppercase hover:opacity-90 transition flex items-center gap-1.5 shadow-orange">
                                <Save className="w-3.5 h-3.5" /> Save & Increment Version
                              </button>
                              <button onClick={() => setEditingDoc(null)}
                                className="px-4 py-2 rounded-lg text-xs font-bold uppercase border border-border hover:bg-muted transition">
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Team Members ── */}
                <div className="bg-card rounded-xl shadow-card p-6">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-display font-bold text-xl flex items-center gap-2">
                      <Users className="w-5 h-5 text-secondary" /> Team Members
                    </h3>
                    <button onClick={() => handleEditMember(null)}
                      className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-xs font-bold uppercase hover:opacity-90 transition flex items-center gap-1.5 shadow-orange">
                      <Plus className="w-3.5 h-3.5" /> Add Member
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground mb-5">Team members are displayed in the About section of the booking page.</p>

                  {memberMsg && (
                    <div className={`text-sm font-semibold mb-4 p-3 rounded-lg ${memberMsg.startsWith("✓") ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                      {memberMsg}
                    </div>
                  )}

                  {/* New / Edit member form */}
                  {editingMember !== null && (
                    <div className="border border-secondary/30 rounded-xl p-5 mb-5 bg-secondary/5 space-y-4">
                      <h4 className="font-semibold text-sm">{editingMember === "new" ? "Add New Member" : "Edit Member"}</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Full Name *</label>
                          <input className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-secondary/30"
                            value={memberForm.full_name} onChange={e => setMemberForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Marius Nanghanda" />
                        </div>
                        <div>
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Title / Role</label>
                          <input className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-secondary/30"
                            value={memberForm.title} onChange={e => setMemberForm(p => ({ ...p, title: e.target.value }))} placeholder="Co-Founder | Operations" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Bio</label>
                        <textarea rows={3} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-secondary/30 resize-none"
                          value={memberForm.bio} onChange={e => setMemberForm(p => ({ ...p, bio: e.target.value }))} placeholder="Short description of their role and expertise..." />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Photo</label>
                          <div className="flex items-start gap-3">
                            {memberForm.image_url && (
                              <img src={memberForm.image_url} alt="Preview" className="w-14 h-14 rounded-xl object-cover border border-border" />
                            )}
                            <label className="flex-1 cursor-pointer">
                              <div className="border-2 border-dashed border-border rounded-xl p-3 text-center hover:border-secondary/50 transition">
                                {memberImgLoading ? (
                                  <Loader2 className="w-4 h-4 animate-spin mx-auto text-secondary" />
                                ) : (
                                  <>
                                    <Image className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                                    <span className="text-xs text-muted-foreground">Upload photo</span>
                                  </>
                                )}
                              </div>
                              <input type="file" accept="image/*" className="hidden"
                                onChange={e => { const f = e.target.files?.[0]; if (f) handleMemberImageUpload(f); }} />
                            </label>
                          </div>
                          {memberForm.image_url && (
                            <button onClick={() => setMemberForm(p => ({ ...p, image_url: "" }))}
                              className="text-xs text-destructive mt-1.5 hover:underline">Remove photo</button>
                          )}
                        </div>
                        <div>
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Display Order</label>
                          <input type="number" min={0}
                            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-secondary/30"
                            value={memberForm.display_order} onChange={e => setMemberForm(p => ({ ...p, display_order: +e.target.value }))} />
                          <p className="text-xs text-muted-foreground mt-1">Lower = shown first</p>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={handleSaveMember}
                          className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-xs font-bold uppercase hover:opacity-90 transition flex items-center gap-1.5 shadow-orange">
                          <Save className="w-3.5 h-3.5" /> Save Member
                        </button>
                        <button onClick={() => setEditingMember(null)}
                          className="px-4 py-2 rounded-lg text-xs font-bold uppercase border border-border hover:bg-muted transition">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Members list */}
                  {teamMembers.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-6 text-center">No team members yet. Add your first member above.</p>
                  ) : (
                    <div className="space-y-3">
                      {teamMembers.map(member => (
                        <div key={member.id} className="flex items-start gap-4 p-4 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 transition">
                          {/* Avatar */}
                          {member.image_url ? (
                            <img src={member.image_url} alt={member.full_name} className="w-14 h-14 rounded-xl object-cover border border-border flex-shrink-0" />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0 font-display">
                              {member.full_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm">{member.full_name}</p>
                            <p className="text-xs font-semibold" style={{ color: "#FF8C00" }}>{member.title}</p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{member.bio}</p>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button onClick={() => handleEditMember(member)}
                              className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition">
                              <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                            <button onClick={() => handleDeleteMember(member.id)}
                              className="p-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 transition">
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>


            {/* ══ Booking Timeslots Manager ══════════════════════════════════════ */}
            <div className="bg-card rounded-2xl shadow-card border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-100 dark:bg-blue-900/30">
                    <Clock className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-display font-bold">Booking Timeslots</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Manage which time slots customers can choose when booking. Changes apply instantly.
                    </p>
                  </div>
                </div>
                {timeslotSaved && (
                  <span className="flex items-center gap-1 text-xs font-bold text-green-600 shrink-0">
                    <CheckCircle className="w-4 h-4" /> Saved
                  </span>
                )}
              </div>

              <div className="px-5 py-4 space-y-2">
                {timeslots.map((slot, idx) => (
                  <div key={slot.value + idx} className={`flex items-center gap-3 p-3 rounded-xl border ${slot.is_vip ? "border-orange-200 bg-orange-50/50 dark:bg-orange-900/10" : "border-border bg-muted/30"}`}>
                    {/* Drag handle indicator */}
                    <div className="flex flex-col gap-0.5 shrink-0 opacity-30">
                      <div className="w-4 h-0.5 bg-foreground rounded-full" />
                      <div className="w-4 h-0.5 bg-foreground rounded-full" />
                      <div className="w-4 h-0.5 bg-foreground rounded-full" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{slot.label}</p>
                      <p className="text-xs text-muted-foreground font-mono">{slot.value}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${slot.is_vip ? "text-orange-600 bg-orange-100 dark:bg-orange-900/30" : "text-muted-foreground bg-muted"}`}>
                      {slot.is_vip ? "⭐ VIP" : "Standard"}
                    </span>
                    {/* Move up / down */}
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        disabled={idx === 0}
                        onClick={() => {
                          const s = [...timeslots];
                          [s[idx-1], s[idx]] = [s[idx], s[idx-1]];
                          setTimeslots(s);
                        }}
                        className="w-6 h-5 flex items-center justify-center rounded hover:bg-muted transition disabled:opacity-20"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        disabled={idx === timeslots.length - 1}
                        onClick={() => {
                          const s = [...timeslots];
                          [s[idx], s[idx+1]] = [s[idx+1], s[idx]];
                          setTimeslots(s);
                        }}
                        className="w-6 h-5 flex items-center justify-center rounded hover:bg-muted transition disabled:opacity-20"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => setTimeslots(prev => prev.filter((_, i) => i !== idx))}
                      className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-destructive/10 hover:bg-destructive/20 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                ))}

                {/* Add new slot form */}
                <div className="mt-4 p-4 rounded-xl border-2 border-dashed border-border bg-muted/20 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Add New Timeslot</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">Time Value *</label>
                      <input
                        placeholder="e.g. 12:00-13:30"
                        value={newSlotValue}
                        onChange={e => setNewSlotValue(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">Display Label *</label>
                      <input
                        placeholder="e.g. 12:00 – 13:30"
                        value={newSlotLabel}
                        onChange={e => setNewSlotLabel(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div className="flex items-end gap-3">
                      <label className="flex items-center gap-2 cursor-pointer pb-2">
                        <input
                          type="checkbox"
                          checked={newSlotIsVip}
                          onChange={e => setNewSlotIsVip(e.target.checked)}
                          className="w-4 h-4 accent-secondary"
                        />
                        <span className="text-sm font-semibold">VIP slot</span>
                      </label>
                      <button
                        onClick={() => {
                          const value = newSlotValue.trim();
                          const label = newSlotLabel.trim();
                          if (!value || !label) { setTimeslotMsg("Both value and label are required."); return; }
                          if (timeslots.some(s => s.value === value)) { setTimeslotMsg("A slot with this value already exists."); return; }
                          const finalValue = newSlotIsVip && !value.startsWith("VIP") ? `VIP ${value}` : value;
                          setTimeslots(prev => [...prev, { value: finalValue, label, is_vip: newSlotIsVip }]);
                          setNewSlotValue(""); setNewSlotLabel(""); setNewSlotIsVip(false);
                          setTimeslotMsg(null);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-bold hover:opacity-90 transition mb-0.5"
                      >
                        <Plus className="w-4 h-4" /> Add
                      </button>
                    </div>
                  </div>
                  {timeslotMsg && <p className="text-xs text-destructive">{timeslotMsg}</p>}
                  <p className="text-xs text-muted-foreground">
                    Time value format: <code className="font-mono bg-muted px-1 rounded">HH:MM-HH:MM</code> for standard, or <code className="font-mono bg-muted px-1 rounded">VIP HH:MM-HH:MM</code> for VIP slots.
                  </p>
                </div>

                {/* Save button */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => { setTimeslots(DEFAULT_TIMESLOTS); setTimeslotMsg("Timeslots reset to defaults."); }}
                    className="text-xs text-muted-foreground hover:text-foreground underline transition"
                  >
                    Reset to defaults
                  </button>
                  <button
                    disabled={timeslotSaving}
                    onClick={async () => {
                      setTimeslotSaving(true);
                      setTimeslotMsg(null);
                      try {
                        await saveTimeslots(timeslots);
                        setTimeslotSaved(true);
                        setTimeslotMsg("Timeslots saved. Customers will see the updated slots on their next page load.");
                        setTimeout(() => { setTimeslotSaved(false); setTimeslotMsg(null); }, 4000);
                        auditLog(adminUserId, "settings.timeslots_updated", "settings", undefined, { count: timeslots.length });
                      } catch (e: any) {
                        setTimeslotMsg("Failed to save: " + (e?.message ?? "Unknown error"));
                      } finally {
                        setTimeslotSaving(false);
                      }
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50 shadow-orange"
                    style={{ background: "#FF8C00" }}
                  >
                    {timeslotSaving
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                      : <><Save className="w-4 h-4" /> Save Timeslots</>}
                  </button>
                </div>
                {timeslotMsg && (
                  <p className={`text-xs ${timeslotMsg.startsWith("Failed") ? "text-destructive" : "text-green-600 font-medium"}`}>
                    {timeslotMsg}
                  </p>
                )}
              </div>
            </div>

      {/* ══════════════════ LOYALTY TAB ══════════════════ */}
      {/* Always mounted after first open to prevent content flash on re-visit */}
      <div className={`relative z-10 ${tab === "loyalty" ? "block" : "hidden"}`}>
          <div className="space-y-5">
            {/* ── Referral System Toggle ── */}
            <div className="bg-card rounded-2xl shadow-card border border-border overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${referralEnabled ? "bg-green-100 dark:bg-green-900/30" : "bg-muted"}`}>
                    <Gift className={`w-5 h-5 ${referralEnabled ? "text-green-600" : "text-foreground/40"}`} />
                  </div>
                  <div>
                    <p className="font-display font-bold text-foreground">Referral System</p>
                    <p className="text-xs font-medium text-foreground/70 mt-0.5">
                      {referralEnabled
                        ? "Active — customers can share codes and earn +25 pts per referral"
                        : "Disabled — referral code field hidden on signup & user dashboard"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${referralEnabled ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-foreground/50"}`}>
                    {referralEnabled ? "ON" : "OFF"}
                  </span>
                  <button
                    disabled={referralSaving}
                    onClick={async () => {
                      setReferralSaving(true);
                      try {
                        const next = !referralEnabled;
                        await setBoolSetting(SETTINGS_KEYS.REFERRAL_SYSTEM_ENABLED, next);
                        setReferralEnabled(next);
                        auditLog(adminUserId, "settings.referral_toggled", "settings", undefined, { enabled: next });
                      } catch (e: any) {
                        alert("Failed to update referral setting: " + e?.message);
                      } finally {
                        setReferralSaving(false);
                      }
                    }}
                    className="transition"
                    title={referralEnabled ? "Deactivate referral system" : "Activate referral system"}
                  >
                    {referralSaving
                      ? <Loader2 className="w-8 h-8 animate-spin text-secondary" />
                      : referralEnabled
                      ? <ToggleRight className="w-10 h-10 text-green-500" />
                      : <ToggleLeft  className="w-10 h-10 text-foreground/30" />
                    }
                  </button>
                </div>
              </div>
              {referralEnabled && (
                <div className="px-5 pb-4 pt-0">
                  <div className="bg-green-50 dark:bg-green-900/10 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    {[
                      { icon: "🎁", text: "Referral code field shown on Sign Up page" },
                      { icon: "📊", text: "Referral codes & stats shown in user Loyalty tab" },
                      { icon: "💰", text: "Referrer earns +25 pts per successful signup" },
                    ].map(item => (
                      <div key={item.text} className="flex items-start gap-2 text-green-800 dark:text-green-400 font-medium">
                        <span>{item.icon}</span><span>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── WhatsApp Agent Number Setting ── */}
            <div className="bg-card rounded-2xl shadow-card border border-border overflow-hidden">
              <div className="flex items-start justify-between gap-4 p-5">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-green-100 dark:bg-green-900/30">
                    <MessageCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm">Chatbot WhatsApp Number</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Phone number Winny redirects customers to when they request a live agent.
                      Include country code, no spaces or dashes (e.g. 264812781123).
                    </p>
                    <div className="flex gap-2 mt-3 items-center">
                      <span className="text-sm text-muted-foreground select-none">+</span>
                      <input
                        value={waNumberInput}
                        onChange={e => { setWaNumberInput(e.target.value.replace(/\D/g,"")); setWaNumberSaved(false); }}
                        placeholder="264812781123"
                        className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition font-mono"
                        maxLength={15}
                      />
                      <button
                        disabled={waNumberSaving || !waNumberInput.trim()}
                        onClick={async () => {
                          setWaNumberSaving(true);
                          try {
                            await setSetting(SETTINGS_KEYS.WHATSAPP_AGENT_NUMBER, waNumberInput.trim());
                            setWaNumber(waNumberInput.trim());
                            setWaNumberSaved(true);
                            setTimeout(() => setWaNumberSaved(false), 3000);
                            auditLog(adminUserId, "settings.whatsapp_updated", "settings", undefined, { number: waNumberInput.trim() });
                          } catch (e: any) {
                            alert("Failed to save: " + e?.message);
                          } finally {
                            setWaNumberSaving(false);
                          }
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-1.5 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {waNumberSaving
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : waNumberSaved
                          ? <><CheckCircle className="w-4 h-4" /> Saved!</>
                          : <><Save className="w-4 h-4" /> Save</>}
                      </button>
                    </div>
                    {waNumber && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Current: <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className="text-green-600 font-mono hover:underline">+{waNumber}</a>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-display font-bold flex items-center gap-2">
                  <Award className="w-5 h-5 text-secondary" /> Loyalty Overview
                </h2>
                <p className="text-sm font-medium text-foreground/80 mt-0.5">
                  {loyaltyRows.length} customer{loyaltyRows.length !== 1 ? "s" : ""} enrolled
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Filter buttons */}
                {([
                  { key: "all",       label: "All Customers" },
                  { key: "available", label: "Has Free Washes" },
                  { key: "top",       label: "Top Earners" },
                ] as const).map(f => (
                  <button key={f.key} onClick={() => setLoyaltyFilter(f.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                      loyaltyFilter === f.key
                        ? "bg-secondary text-secondary-foreground border-secondary"
                        : "bg-background border-border text-foreground/70 hover:border-secondary/50"
                    }`}>
                    {f.label}
                  </button>
                ))}
                <button
                  onClick={() => { setLoyaltyLoading(true); fetchAdminLoyaltyOverview().then(setLoyaltyRows).catch(() => {}).finally(() => setLoyaltyLoading(false)); }}
                  className="p-2 rounded-lg border border-border hover:bg-muted transition text-foreground/70 hover:text-foreground">
                  <RefreshCwIcon className={`w-4 h-4 ${loyaltyLoading ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={async () => {
                    setExpiringLoading(true);
                    try {
                      const n = await expireStaleRedemptions();
                      alert(`Expired ${n} stale redemption${n !== 1 ? "s" : ""} and refunded their points.`);
                      fetchAdminLoyaltyOverview().then(setLoyaltyRows).catch(() => {});
                    } catch (e: any) { alert("Error: " + e?.message); }
                    setExpiringLoading(false);
                  }}
                  disabled={expiringLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-900/20 text-xs font-bold hover:bg-amber-100 transition disabled:opacity-50">
                  <Crown className={`w-3.5 h-3.5 ${expiringLoading ? "animate-spin" : ""}`} />
                  Expire Stale
                </button>
              </div>
            </div>

            {/* Summary cards */}
            {loyaltyRows.length > 0 && (() => {
              const totalLifetime   = loyaltyRows.reduce((s, r) => s + (r.lifetime_points || 0), 0);
              const totalFreeWashes = loyaltyRows.reduce((s, r) => s + (r.free_washes_available || 0), 0);
              const topTier         = loyaltyRows.filter(r => r.tier === "Platinum").length;
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Total Lifetime Pts", value: totalLifetime.toLocaleString(), icon: TrendingUp, color: "text-purple-500" },
                    { label: "Free Washes Pending", value: totalFreeWashes, icon: Gift, color: "text-green-600" },
                    { label: "Platinum Customers", value: topTier, icon: Crown, color: "text-yellow-600" },
                    { label: "Total Customers", value: loyaltyRows.length, icon: Users, color: "text-secondary" },
                  ].map(s => (
                    <div key={s.label} className="bg-card rounded-xl p-4 shadow-card">
                      <s.icon className={`w-4 h-4 ${s.color} mb-2`} />
                      <p className={`text-2xl font-display font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-xs font-semibold text-foreground/70 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Customer table */}
            {loyaltyLoading && loyaltyRows.length === 0 ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
            ) : (() => {
              const filtered = loyaltyRows
                .filter(r => {
                  if (loyaltyFilter === "available") return (r.free_washes_available || 0) > 0;
                  if (loyaltyFilter === "top")       return (r.lifetime_points || 0) >= 100;
                  return true;
                })
                .sort((a, b) => {
                  if (loyaltyFilter === "available") return (b.free_washes_available || 0) - (a.free_washes_available || 0);
                  return (b.lifetime_points || 0) - (a.lifetime_points || 0);
                });

              if (filtered.length === 0) return (
                <div className="text-center py-12 text-foreground/70">
                  <Award className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-semibold text-foreground">No customers match this filter</p>
                </div>
              );

              return (
                <div className="space-y-2">
                  {filtered.map((row) => {
                    const tier    = TIER_CONFIG[row.tier] || TIER_CONFIG.Bronze;
                    const isOpen  = expandedLoyalty === row.user_id;
                    const redemps = userRedemptions[row.user_id];

                    return (
                      <div key={row.user_id} className="bg-card rounded-xl shadow-card overflow-hidden">
                        {/* Row header */}
                        <button
                          onClick={async () => {
                            if (isOpen) { setExpandedLoyalty(null); return; }
                            setExpandedLoyalty(row.user_id);
                            if (!userRedemptions[row.user_id]) {
                              const r = await fetchUserRedemptions(row.user_id).catch(() => [] as FreeWashRedemption[]);
                              setUserRedemptions(prev => ({ ...prev, [row.user_id]: r }));
                            }
                          }}
                          className="w-full px-3 sm:px-5 py-3 sm:py-4 flex items-center gap-2 sm:gap-4 hover:bg-muted/30 transition text-left">
                          {/* Tier badge */}
                          <span className={`text-xl shrink-0`}>{tier.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold truncate">{row.full_name || "—"}</p>
                            <p className="text-xs text-foreground/70 truncate">{row.email}</p>
                          </div>
                          {/* Key stats inline */}
                          <div className="flex items-center gap-3 sm:gap-5 text-sm shrink-0">
                            <div className="text-center">
                              <p className={`font-display font-bold text-sm sm:text-base ${tier.color}`}>{(row.lifetime_points || 0).toLocaleString()}</p>
                              <p className="text-xs font-semibold text-foreground/70">lifetime</p>
                            </div>
                            <div className="text-center">
                              <p className="font-display font-bold text-sm sm:text-base text-secondary">{(row.redeemable_points || 0).toLocaleString()}</p>
                              <p className="text-xs font-semibold text-foreground/70">redeemable</p>
                            </div>
                            <div className="text-center">
                              <p className={`font-display font-bold text-sm sm:text-base ${(row.free_washes_available || 0) > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                                {row.free_washes_available || 0}
                              </p>
                              <p className="text-xs font-semibold text-foreground/70">avail.</p>
                            </div>
                          </div>
                          <span className={`ml-2 inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${tier.bg} ${tier.color}`}>
                            {tier.emoji} {tier.label}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-foreground/50 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </button>

                        {/* Expanded detail */}
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                              className="border-t border-border overflow-hidden">
                              <div className="px-5 py-4 space-y-4">
                                {/* Full stats grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                  {[
                                    { label: "Lifetime Points",   value: (row.lifetime_points || 0).toLocaleString(),   icon: TrendingUp,    color: "text-purple-500" },
                                    { label: "Redeemable Points", value: (row.redeemable_points || 0).toLocaleString(), icon: Zap,            color: "text-secondary" },
                                    { label: "Completed Bookings",value: row.completed_bookings_count || 0,              icon: CheckCircle,    color: "text-blue-500" },
                                    { label: "Washes Earned",     value: row.free_washes_earned || 0,                   icon: Gift,           color: "text-green-600" },
                                    { label: "Washes Used",       value: row.free_washes_used || 0,                     icon: CheckCircle,    color: "text-foreground/60" },
                                    { label: "Available Washes",  value: row.free_washes_available || 0,                icon: Sparkles,       color: (row.free_washes_available || 0) > 0 ? "text-green-600" : "text-foreground/50" },
                                  ].map(s => (
                                    <div key={s.label} className="bg-muted/30 rounded-lg p-3">
                                      <s.icon className={`w-3.5 h-3.5 ${s.color} mb-1`} />
                                      <p className={`font-display font-bold text-lg ${s.color}`}>{s.value}</p>
                                      <p className="text-xs font-semibold text-foreground/70">{s.label}</p>
                                    </div>
                                  ))}
                                </div>

                                {/* Referral code */}
                                {row.referral_code && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="text-foreground/70 font-semibold">Referral code:</span>
                                    <span className="font-mono font-bold text-secondary">{row.referral_code}</span>
                                    <span className="text-foreground/70 text-xs font-medium">· {row.total_referrals || 0} referrals</span>
                                  </div>
                                )}

                                {/* Redemption history */}
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-wider text-foreground/70 mb-2">Redemption History</p>
                                  {!redemps ? (
                                    <div className="flex items-center gap-2 text-sm text-foreground/70 py-2">
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
                                    </div>
                                  ) : redemps.length === 0 ? (
                                    <p className="text-sm text-foreground/70">No redemptions yet.</p>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {redemps.map(r => {
                                        const sc = REDEMPTION_STATUS[r.status] || REDEMPTION_STATUS.cancelled;
                                        return (
                                          <div key={r.id} className="flex items-center justify-between gap-3 text-sm bg-muted/20 rounded-lg px-3 py-2">
                                            <div>
                                              <span className="font-semibold">Free Standard Wash</span>
                                              <span className="text-foreground/70 text-xs ml-2 font-medium">
                                                {new Date(r.redeemed_at).toLocaleDateString("en-NA", { day:"numeric", month:"short", year:"numeric" })}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                              {r.status === "reserved" && (
                                                <span className="text-xs text-amber-600">{formatExpiry(r.expires_at)}</span>
                                              )}
                                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sc.color}`}>{sc.label}</span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>

      {/* ══════════════════ MARKETING ADS TAB ══════════════════ */}
      {/* Always mounted - prevents data-reload flash on tab switch */}
      <div className={`relative z-10 ${tab === "ads" ? "block" : "hidden"}`}>
        <AdminAds />
      </div>

      {/* ══════════════════ SECURITY TAB ══════════════════ */}
      {tab === "security" && (
        <div className="relative z-10 px-3 sm:px-6 pb-8 space-y-6">

          {/* Active Blocks */}
          <div className="bg-card rounded-2xl shadow-card border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              <div>
                <h3 className="font-bold text-sm">Active Abuse Blocks</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Identifiers blocked for excessive failed attempts</p>
              </div>
              <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold bg-destructive/10 text-destructive">
                {abuseBlocks.filter(b => new Date(b.expires_at) > new Date()).length} active
              </span>
            </div>
            {abuseBlocks.filter(b => new Date(b.expires_at) > new Date()).length === 0 ? (
              <div className="px-5 py-8 text-center text-muted-foreground text-sm">
                <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No active blocks
              </div>
            ) : (
              <div className="divide-y divide-border">
                {abuseBlocks.filter(b => new Date(b.expires_at) > new Date()).map((b: any) => (
                  <div key={b.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                    <div className="font-mono text-xs bg-muted px-2 py-1 rounded">{b.identifier}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-destructive">{b.reason}</p>
                      <p className="text-xs text-muted-foreground">Expires: {new Date(b.expires_at).toLocaleString("en-NA")}</p>
                    </div>
                    <button
                      onClick={async () => {
                        await supabase.from("abuse_blocks").delete().eq("id", b.id);
                        setAbuseBlocks(prev => prev.filter(x => x.id !== b.id));
                        auditLog(adminUserId, "security.abuse_unblocked", "abuse_block", b.id, { identifier: b.identifier, reason: b.reason });
                      }}
                      className="px-3 py-1 rounded-lg text-xs font-bold bg-destructive/10 text-destructive hover:bg-destructive/20 transition"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Security Logs */}
          <div className="bg-card rounded-2xl shadow-card border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <ShieldCheck className="w-5 h-5 text-secondary shrink-0" />
                <div>
                  <h3 className="font-bold text-sm">Security Logs</h3>
                  <p className="text-xs text-muted-foreground">Last 200 events</p>
                </div>
              </div>
              <div className="flex gap-1.5">
                {(["all","allowed","blocked"] as const).map(f => (
                  <button key={f} onClick={() => setSecLogFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                      secLogFilter === f
                        ? f === "blocked" ? "bg-destructive text-white border-destructive"
                          : f === "allowed" ? "bg-green-600 text-white border-green-600"
                          : "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border text-muted-foreground hover:border-border"
                    }`}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setSecLogsLoading(true);
                    supabase.from("security_logs").select("*").order("created_at", { ascending: false }).limit(200)
                      .then(r => setSecLogs(r.data ?? [])).finally(() => setSecLogsLoading(false));
                  }}
                  className="p-1.5 rounded-lg border border-border hover:bg-muted transition"
                >
                  <RefreshCwIcon className={`w-4 h-4 ${secLogsLoading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>
            {secLogsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-secondary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Time</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Action</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Result</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground hidden sm:table-cell">Fingerprint</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground hidden md:table-cell">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {secLogs
                      .filter(l => secLogFilter === "all" || l.result === secLogFilter)
                      .map((log: any) => (
                        <tr key={log.id} className={`hover:bg-muted/20 transition ${log.result === "blocked" ? "bg-red-50/40 dark:bg-red-900/10" : ""}`}>
                          <td className="px-4 py-2 font-mono whitespace-nowrap text-muted-foreground">
                            {new Date(log.created_at).toLocaleString("en-NA", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                          </td>
                          <td className="px-4 py-2">
                            <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-primary/10 text-primary uppercase tracking-wide">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${log.result === "allowed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                              {log.result}
                            </span>
                          </td>
                          <td className="px-4 py-2 font-mono text-muted-foreground hidden sm:table-cell">
                            {log.ip ?? "—"}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground hidden md:table-cell max-w-[200px] truncate">
                            {log.reason ?? "—"}
                          </td>
                        </tr>
                      ))}
                    {secLogs.filter(l => secLogFilter === "all" || l.result === secLogFilter).length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No logs found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ Analytics tab ══════════════════════════════════════════════════════════ */}
      {tab === "analytics" && (
        <div>
          <AdminAnalytics />
        </div>
      )}

      {/* ══ Audit Log tab ══════════════════════════════════════════════════════════ */}
      {tab === "audit" && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl shadow-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <h3 className="font-bold text-sm">Admin Action Log</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Tamper-proof record of every mutating admin action. Entries cannot be edited or deleted.</p>
              </div>
              <button
                onClick={() => {
                  setAuditLogsLoading(true);
                  supabase.from("admin_audit_log").select("*, admin:admin_id(full_name)").order("created_at", { ascending: false }).limit(300)
                    .then(({ data }) => setAuditLogs(data ?? []))
                    .catch(() => {}).finally(() => setAuditLogsLoading(false));
                }}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition"
                title="Refresh"
              >
                <RefreshCwIcon className={`w-4 h-4 ${auditLogsLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
            {auditLogsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No audit entries yet. Actions taken by admins will appear here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Time</th>
                      <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Admin</th>
                      <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Action</th>
                      <th className="px-4 py-2 text-left font-semibold text-muted-foreground hidden sm:table-cell">Target</th>
                      <th className="px-4 py-2 text-left font-semibold text-muted-foreground hidden md:table-cell">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {auditLogs.map((entry: any) => {
                      const actionColor =
                        entry.action.includes("deleted") ? "text-destructive bg-destructive/10" :
                        entry.action.includes("paid") || entry.action.includes("approved") ? "text-success bg-success/10" :
                        entry.action.includes("created") ? "text-info bg-info/10" :
                        "text-foreground bg-muted";
                      return (
                        <tr key={entry.id} className="hover:bg-muted/20 transition">
                          <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                            {new Date(entry.created_at).toLocaleString("en-NA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="px-4 py-2.5 font-medium truncate max-w-[100px]">
                            {entry.admin?.full_name ?? entry.admin_id?.slice(0, 8) ?? "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${actionColor}`}>
                              {entry.action}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">
                            {entry.target_type ?? "—"}{entry.target_id ? ` #${entry.target_id.slice(0, 8)}` : ""}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell max-w-[220px] truncate">
                            {entry.payload ? JSON.stringify(entry.payload).slice(0, 80) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ Admin image lightbox ══ */}
      <AnimatePresence>
        {imagesLightbox && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setImagesLightbox(null)}
          >
            <button
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              onClick={() => setImagesLightbox(null)}
            >
              <X className="w-5 h-5" />
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

      {tab === "payments" && (
        <div className="bg-card rounded-2xl shadow-card p-4 sm:p-6">
          <AdminPaymentVerification />
        </div>
      )}

      {tab === "subscriptions" && (
        <div className="bg-card rounded-2xl shadow-card p-4 sm:p-6">
          <AdminSubscriptions />
        </div>
      )}

      <CopyrightFooter />
    </div>
  );
};

export default AdminDashboard;
