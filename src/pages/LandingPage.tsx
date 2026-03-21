/**
 * LandingPage.tsx  —  v4
 * Fixes: no dashes, professional icons, stable carousel (no layout shift),
 * addon per-vehicle pricing, About stats labels, mobile nav tabs visible,
 * services/pricing fully visible on mobile, chatbot sizing in WinnyChatbot.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  MapPin, Phone, Mail, MessageCircle, ChevronDown, ChevronLeft, ChevronRight,
  Star, CheckCircle2, ArrowRight, Truck, Car, ShieldCheck, Clock, Award,
  Instagram, Facebook, Menu, X, Zap, Crown, Leaf, Quote, Users, Lock,
  CalendarCheck, Wrench, TrendingUp, Building2, Wallet,
  Sparkles, BadgeCheck, Timer, Recycle, Navigation, PackageCheck,
  HeartHandshake, ThumbsUp,
} from "lucide-react";
import { getAllWebsiteContent } from "@/lib/websiteService";
import { supabase } from "@/lib/supabase";
import WinnyChatbot from "@/components/WinnyChatbot";
import logoBrand from "@/assets/logo-brand.png";
import { getSessionUser, getUserProfile } from "@/lib/authService";

// ─── CMS defaults (no dashes) ─────────────────────────────────────────────────
const D: Record<string, any> = {
  hero: {
    headline: "OASIS",
    subheadline2: "WE COME. YOU SHINE.",
    body: "Premium mobile car wash and detailing at your doorstep anywhere in Windhoek.",
    cta_primary: "Book a Wash",
    cta_secondary: "Our Services",
    badge: "Serving Windhoek, Namibia",
  },
  about: {
    title: "About Oasis Pure Cleaning CC",
    story: "Born from a simple belief: your vehicle deserves exceptional care and you deserve convenience. We bring professional-grade services directly to you, wherever you are in Windhoek.",
    mission: "To deliver premium mobile car care that respects your time, protects your investment, and leaves every vehicle spotless.",
    values: ["Professional and reliable", "Eco-conscious cleaning", "On-time, every time", "Customer-first approach"],
    founded_year: "2020", vehicles_washed: "2,500+", happy_customers: "800+", areas_served: "15+",
  },
  contact: {
    phone: "+264 81 278 1123", whatsapp: "+264 81 278 1123",
    email: "info@oasispurecleaning.com", address: "Windhoek, Namibia",
    operating_hours: "Monday to Saturday: 07:00 to 19:00", instagram: "", facebook: "",
  },
  how_it_works: {
    steps: [
      { icon: "calendar", title: "Book Online",    desc: "Choose your service and time slot in under 2 minutes." },
      { icon: "truck",    title: "We Come to You", desc: "Our team arrives fully equipped at home, office or anywhere." },
      { icon: "star",     title: "You Shine",      desc: "We only leave when your vehicle is spotless and you are satisfied." },
    ],
  },
  features: {
    title: "Why Windhoek Chooses Oasis",
    subtitle: "Professional standards you can see, feel, and trust.",
    items: [
      { icon: "map-pin",  title: "We Come to You",      desc: "No queues, no travel. Book from anywhere in Windhoek." },
      { icon: "shield",   title: "Vetted Professionals", desc: "Trained, background-checked and insured detailers." },
      { icon: "leaf",     title: "Eco-Conscious",        desc: "Water-efficient and biodegradable products used throughout." },
      { icon: "clock",    title: "On Time, Every Time",  desc: "Real-time updates so you never wait or wonder." },
    ],
  },
  cta_band: {
    headline: "Your car deserves better.",
    headline2: "Book today.",
    body: "Spots fill fast especially on weekends. Reserve your time slot now.",
    cta1: "Book a Wash Now",
    cta2: "Create Free Account",
  },
  reviews_section: { title: "What Our Clients Say", subtitle: "Real reviews from verified Oasis customers." },
  pricing_section: { title: "Unlimited Clean Rides", subtitle: "Subscribe and save. The more you wash, the more you save.", note: "All plans include loyalty points. Cancel anytime." },
  footer: { tagline: "Premium mobile car wash and detailing in Windhoek, Namibia. We come to you.", copyright: "Oasis Pure Cleaning CC. All rights reserved." },
};

// ─── Water drops ──────────────────────────────────────────────────────────────
const DROPS = Array.from({ length: 16 }, (_, i) => ({
  id: i, x: Math.random() * 100, size: 5 + Math.random() * 10,
  delay: Math.random() * 6, dur: 5 + Math.random() * 4, opacity: 0.05 + Math.random() * 0.12,
}));

function WaterDrops() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {DROPS.map(d => (
        <motion.div key={d.id} className="absolute rounded-full"
          style={{ left: `${d.x}%`, width: d.size, height: d.size * 1.35, top: "-6%",
            background: "radial-gradient(ellipse at 35% 30%,rgba(255,255,255,0.9),rgba(96,190,255,0.25))", opacity: d.opacity }}
          animate={{ y: ["0vh", "112vh"] }}
          transition={{ duration: d.dur, delay: d.delay, repeat: Infinity, ease: "linear" }} />
      ))}
    </div>
  );
}

// ─── Reveal on scroll ─────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }} className={className}>
      {children}
    </motion.div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SH({ badge, title, sub, light = false }: { badge?: string; title: string; sub?: string; light?: boolean }) {
  return (
    <div className="text-center mb-10 sm:mb-14">
      {badge && (
        <Reveal>
          <span className={`inline-flex items-center gap-1.5 font-bold uppercase px-4 py-1.5 rounded-full mb-3 sm:mb-4 ${light ? "bg-white/10 text-white/80 border border-white/10" : "bg-secondary/10 text-secondary border border-secondary/10"}`}
            style={{ fontSize: "clamp(9px,1.8vw,11px)", letterSpacing: "0.18em" }}>
            <TrendingUp className="w-3 h-3 flex-shrink-0" /> {badge}
          </span>
        </Reveal>
      )}
      <Reveal delay={0.08}>
        <h2 className={`font-display font-black leading-tight tracking-tight mb-2 ${light ? "text-white" : "text-foreground"}`}
          style={{ fontSize: "clamp(1.55rem,4.5vw,3rem)" }}>{title}</h2>
      </Reveal>
      {sub && (
        <Reveal delay={0.16}>
          <p className={`max-w-xl mx-auto leading-relaxed ${light ? "text-white/60" : "text-muted-foreground"}`}
            style={{ fontSize: "clamp(0.82rem,2vw,1.05rem)" }}>{sub}</p>
        </Reveal>
      )}
    </div>
  );
}

// ─── STABLE carousel (no layout shift) ───────────────────────────────────────
// Key: exits use position:absolute, container height is fixed via minHeight prop
function StableCarousel({ items, renderItem, interval = 4200, minHeight }: {
  items: any[]; renderItem: (item: any, i: number) => React.ReactNode; interval?: number; minHeight: string;
}) {
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const advance = useCallback((d: number) => {
    setDir(d);
    setIdx(prev => (prev + d + items.length) % items.length);
  }, [items.length]);

  const restart = useCallback((d: number, i: number) => {
    if (timer.current) clearInterval(timer.current);
    setDir(d); setIdx(i);
    timer.current = setInterval(() => advance(1), interval);
  }, [advance, interval]);

  useEffect(() => {
    if (paused) { if (timer.current) clearInterval(timer.current); return; }
    timer.current = setInterval(() => advance(1), interval);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [advance, interval, paused]);

  return (
    <div className="relative rounded-2xl" style={{ minHeight }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => { setPaused(false); }}
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}>
      {/* Container with fixed height so exits don't collapse/expand it */}
      <div className="relative overflow-hidden rounded-2xl" style={{ minHeight }}>
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div key={idx} custom={dir}
            initial={(d: number) => ({ x: d > 0 ? "100%" : "-100%", opacity: 0 })}
            animate={{ x: 0, opacity: 1 }}
            exit={(d: number) => ({ x: d > 0 ? "-60%" : "60%", opacity: 0 })}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="w-full">
            {renderItem(items[idx], idx)}
          </motion.div>
        </AnimatePresence>
      </div>
      {/* Dots */}
      <div className="flex justify-center gap-1.5 mt-3">
        {items.map((_, i) => (
          <button key={i} onClick={() => restart(i > idx ? 1 : -1, i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${i === idx ? "bg-secondary w-5" : "bg-border w-1.5"}`} />
        ))}
      </div>
      {/* Prev/Next */}
      <button onClick={() => advance(-1)} aria-label="Previous"
        className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/15 hover:bg-black/30 flex items-center justify-center text-white transition z-10"
        style={{ marginTop: "-0.75rem" }}>
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button onClick={() => advance(1)} aria-label="Next"
        className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/15 hover:bg-black/30 flex items-center justify-center text-white transition z-10"
        style={{ marginTop: "-0.75rem" }}>
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Subtle car background pattern ────────────────────────────────────────────
function CarPattern({ opacity = 0.04 }: { opacity?: number }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" style={{ opacity }}>
        <defs>
          <pattern id="car-tile" x="0" y="0" width="120" height="80" patternUnits="userSpaceOnUse">
            <path d="M22 54 L22 47 L30 40 L46 38 L56 40 L64 47 L64 54 Z" fill="currentColor" fillOpacity="1" />
            <circle cx="29" cy="55" r="5.5" fill="currentColor" />
            <circle cx="57" cy="55" r="5.5" fill="currentColor" />
            <rect x="32" y="40" width="22" height="7" rx="2" fill="currentColor" fillOpacity="0.4" />
            <line x1="15" y1="50" x2="22" y2="50" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="64" y1="50" x2="71" y2="50" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#car-tile)" />
      </svg>
    </div>
  );
}

// ─── Professional icon map ────────────────────────────────────────────────────
const ICON: Record<string, React.ReactNode> = {
  "map-pin":  <Navigation className="w-5 h-5 sm:w-6 sm:h-6" />,
  "truck":    <PackageCheck className="w-5 h-5 sm:w-6 sm:h-6" />,
  "calendar": <CalendarCheck className="w-5 h-5 sm:w-6 sm:h-6" />,
  "star":     <ThumbsUp  className="w-5 h-5 sm:w-6 sm:h-6" />,
  "shield":   <BadgeCheck className="w-5 h-5 sm:w-6 sm:h-6" />,
  "leaf":     <Recycle   className="w-5 h-5 sm:w-6 sm:h-6" />,
  "clock":    <Timer     className="w-5 h-5 sm:w-6 sm:h-6" />,
  "wrench":   <Wrench    className="w-5 h-5 sm:w-6 sm:h-6" />,
};

// ─────────────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll();
  const heroY  = useTransform(scrollYProgress, [0, 0.2], ["0%", "12%"]);
  const heroOp = useTransform(scrollYProgress, [0, 0.22], [1, 0]);

  const [cms,      setCms]      = useState<Record<string, any>>(D);
  const [services, setServices] = useState<any[]>([]);
  const [plans,    setPlans]    = useState<any[]>([]);
  const [reviews,  setReviews]  = useState<any[]>([]);
  const [navOpen,  setNavOpen]  = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [userLink, setUserLink] = useState("/auth");
  const [promos, setPromos] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      getAllWebsiteContent(),
      import("@/lib/bookingService").then(m => m.getAllServices()),
      supabase.from("subscription_plans").select("plan_name,monthly_price,allowed_bookings_per_month,description").eq("status", "active").order("sort_order"),
      supabase.from("reviews").select("star_rating,review_comment,created_at,customer_name").eq("review_status", "published").order("created_at", { ascending: false }).limit(12),
      supabase.from("marketing_ads").select("id,title,message,button_text,button_link,image_url").eq("active", true).order("priority").limit(5),
    ]).then(([wc, svcs, plansR, revR, promosR]) => {
      setCms({ ...D, ...wc });
      setServices((svcs as any[]).filter(s => s.is_active));
      setPlans(plansR.data ?? []);
      setReviews(revR.data ?? []);
      setPromos(promosR.data ?? []);
    }).catch(() => {});

    getSessionUser().then(async u => {
      if (!u) return;
      const p = await getUserProfile(u.id).catch(() => null);
      if (p?.role === "super_admin") setUserLink("/platform");
      else if (p?.role === "admin") setUserLink("/admin/dashboard");
      else if (p?.role === "employee") setUserLink("/employee");
      else setUserLink("/dashboard");
    }).catch(() => {});

    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const g  = (sec: string) => ({ ...(D[sec] ?? {}), ...(cms[sec] ?? {}) });
  const h  = (k: string) => g("hero")[k];
  const ab = (k: string) => g("about")[k];
  const co = (k: string) => g("contact")[k];
  const fe = (k: string) => g("features")[k];
  const cb = (k: string) => g("cta_band")[k];
  const ps = (k: string) => g("pricing_section")[k];
  const rs = (k: string) => g("reviews_section")[k];
  const ft = (k: string) => g("footer")[k];
  const hw = () => g("how_it_works");

  const mainSvc = services.filter(s => !s.is_addon);
  const addons  = services.filter(s => s.is_addon);

  const displaySvc = mainSvc.length > 0 ? mainSvc : [
    { id: 1, name: "Basic Wash (Interior)", description: "Interior vacuum, wipe-down and window clean", price_small: 60, price_large: 80, price_xl: 100, price_truck: 180 },
    { id: 2, name: "Basic Wash (Exterior)", description: "Exterior hand wash, rinse and dry", price_small: 80, price_large: 100, price_xl: 130, price_truck: 250 },
    { id: 3, name: "Full Detailing", description: "Interior and exterior full detail and polish", price_small: 150, price_large: 180, price_xl: 250, price_truck: 450 },
  ];
  const displayAddons = addons.length > 0 ? addons : [
    { id: 4, name: "Engine Bay Cleaning", description: "Degrease and rinse engine bay", price_small: 80, price_large: 100, price_xl: 150, price_truck: 250 },
  ];
  const displayPlans = plans.length > 0 ? plans : [
    { plan_name: "Basic",     monthly_price: 250, allowed_bookings_per_month: 2,  description: "2 standard washes per month" },
    { plan_name: "Standard",  monthly_price: 450, allowed_bookings_per_month: 4,  description: "4 standard washes per month" },
    { plan_name: "Premium",   monthly_price: 650, allowed_bookings_per_month: 4,  description: "4 washes plus 1 full detail" },
    { plan_name: "Corporate", monthly_price: 0,   allowed_bookings_per_month: 99, description: "Fleet pricing — contact us" },
  ];

  const scrollTo = (id: string) => { setNavOpen(false); document.querySelector(id)?.scrollIntoView({ behavior: "smooth" }); };

  const NAV = [
    { label: "Services",     href: "#services" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "About",        href: "#about" },
    { label: "Pricing",      href: "#pricing" },
    { label: "Contact",      href: "#contact" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ──── NAVBAR ──────────────────────────────────────────────────────── */}
      <motion.nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "bg-primary/96 backdrop-blur-md shadow-xl" : "bg-transparent"}`}
        initial={{ y: -80 }} animate={{ y: 0 }} transition={{ duration: 0.55 }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4" style={{ height: "clamp(56px,9vw,72px)" }}>
          <Link to="/" className="flex-shrink-0">
            <img src={logoBrand} alt="Oasis Pure Cleaning CC" className="w-auto object-contain" style={{ height: "clamp(2.8rem,7vw,3.75rem)" }} />
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-5 xl:gap-8">
            {NAV.map(n => (
              <button key={n.label} onClick={() => scrollTo(n.href)}
                className="font-semibold text-primary-foreground/80 hover:text-primary-foreground transition whitespace-nowrap"
                style={{ fontSize: "clamp(11px,1.5vw,14px)" }}>
                {n.label}
              </button>
            ))}
          </div>

          {/* Desktop auth + CTA */}
          <div className="hidden md:flex items-center gap-2.5">
            <Link to={userLink} className="font-semibold text-primary-foreground/70 hover:text-primary-foreground transition px-2"
              style={{ fontSize: "clamp(11px,1.4vw,13px)" }}>
              {userLink === "/auth" ? "Sign In" : "Dashboard"}
            </Link>
            <Link to="/book" className="flex items-center gap-1.5 bg-secondary text-secondary-foreground font-bold rounded-xl hover:opacity-90 transition shadow-lg"
              style={{ fontSize: "clamp(11px,1.5vw,14px)", padding: "clamp(0.45rem,1.2vw,0.7rem) clamp(0.9rem,2.5vw,1.4rem)" }}>
              <Car className="w-3.5 h-3.5 flex-shrink-0" /> Book Now
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setNavOpen(o => !o)} className="md:hidden text-primary-foreground p-1.5">
            {navOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu — full nav + quick section links */}
        <AnimatePresence>
          {navOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="md:hidden overflow-hidden bg-primary border-t border-white/10">
              {/* Section nav links */}
              <div className="px-4 pt-3 pb-2">
                <p className="text-[10px] text-primary-foreground/40 font-bold uppercase tracking-widest mb-2">Navigate</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {NAV.map(n => (
                    <button key={n.label} onClick={() => scrollTo(n.href)}
                      className="py-2.5 px-2 rounded-xl text-xs text-primary-foreground/80 hover:bg-white/10 font-semibold text-center transition border border-white/10">
                      {n.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-4 pb-4 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
                <Link to={userLink} onClick={() => setNavOpen(false)} className="py-2.5 text-center rounded-xl border border-white/20 text-primary-foreground font-semibold text-sm">
                  {userLink === "/auth" ? "Sign In" : "Dashboard"}
                </Link>
                <Link to="/book" onClick={() => setNavOpen(false)} className="py-2.5 text-center rounded-xl bg-secondary text-secondary-foreground font-bold text-sm">
                  Book Now
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ──── MOBILE SECTION TABS — sticky pill bar below hero ────────────── */}
      {/* Visible on small screens only, allows quick jumping to sections */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-md border-t border-border shadow-2xl safe-bottom">
        <div className="grid grid-cols-6 px-1 py-1">
          {NAV.map(n => (
            <button key={n.label} onClick={() => scrollTo(n.href)}
              className="flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg text-muted-foreground hover:text-secondary hover:bg-secondary/10 transition">
              <span className="font-bold uppercase" style={{ fontSize: "clamp(7px,2vw,9px)", letterSpacing: "0.05em", lineHeight: 1.2 }}>{n.label}</span>
            </button>
          ))}
          <Link to="/book"
            className="flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg bg-secondary/15 text-secondary">
            <span className="font-black uppercase" style={{ fontSize: "clamp(7px,2vw,9px)", letterSpacing: "0.05em" }}>Book</span>
          </Link>
        </div>
      </div>


      {/* ──── PROMOTIONS BANNER ──────────────────────────────────────── */}
      {promos.length > 0 && (
        <div className="fixed top-0 inset-x-0 z-[60]" style={{ marginTop: "clamp(56px,9vw,72px)" }}>
          <div className="overflow-hidden" style={{ background: "linear-gradient(90deg,#0d2744,#FF8C00 60%,#0d2744)" }}>
            <motion.div
              animate={{ x: ["0%", "-50%"] }}
              transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
              className="flex items-center gap-0 whitespace-nowrap py-2 px-0"
              style={{ width: "200%" }}>
              {[...promos, ...promos].map((p, i) => (
                <span key={i} className="inline-flex items-center gap-3 px-8 text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary flex-shrink-0" />
                  <span className="font-bold text-xs sm:text-sm tracking-wide">{p.title}</span>
                  <span className="text-white/70 text-xs sm:text-sm">{p.message}</span>
                  {p.button_text && p.button_link && (
                    <a href={p.button_link} target="_blank" rel="noreferrer"
                      className="bg-secondary text-secondary-foreground px-2.5 py-0.5 rounded-full text-xs font-bold hover:opacity-90 transition flex-shrink-0"
                      onClick={e => e.stopPropagation()}>
                      {p.button_text} →
                    </a>
                  )}
                </span>
              ))}
            </motion.div>
          </div>
        </div>
      )}

      {/* ──── HERO ────────────────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-[100svh] flex items-center overflow-hidden bg-primary pb-10 lg:pb-0">
        <WaterDrops />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary/20 blur-[100px]"
            style={{ width: "min(900px,120vw)", height: "min(450px,60vh)" }} />
        </div>
        <div className="absolute inset-0 opacity-[0.025]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)",
          backgroundSize: "clamp(30px,5vw,60px) clamp(30px,5vw,60px)"
        }} />

        <motion.div style={{ opacity: heroOp, y: heroY }} className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-16 sm:pt-28 text-center">
          {/* Badge */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5 }}
            className="inline-flex items-center gap-2 bg-white/10 border border-white/15 text-primary-foreground/85 font-bold uppercase rounded-full mb-6"
            style={{ padding: "0.375rem 1rem", fontSize: "clamp(8px,1.8vw,11px)", letterSpacing: "0.18em" }}>
            <MapPin className="w-3 h-3 text-secondary flex-shrink-0" /> {h("badge")}
          </motion.div>

          {/* "OASIS" slides up first */}
          <div className="overflow-hidden mb-1">
            <motion.div initial={{ y: "105%", opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}>
              <span className="block font-display font-black text-white leading-none tracking-tight"
                style={{ fontSize: "clamp(3.5rem,14vw,10rem)", letterSpacing: "-0.02em" }}>
                {h("headline")}
              </span>
            </motion.div>
          </div>

          {/* Tagline slides up second */}
          <div className="overflow-hidden mb-7 sm:mb-9">
            <motion.div initial={{ y: "105%", opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.9, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}>
              <span className="block font-display font-black text-secondary leading-tight"
                style={{ fontSize: "clamp(1.1rem,4.5vw,3.5rem)" }}>
                {String(h("subheadline2")).replace(/\n/g, " · ")}
              </span>
            </motion.div>
          </div>

          {/* Body */}
          <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65, delay: .9 }}
            className="text-primary-foreground/70 leading-relaxed mb-8 max-w-xl mx-auto"
            style={{ fontSize: "clamp(0.9rem,2.2vw,1.15rem)" }}>
            {h("body")}
          </motion.p>

          {/* CTAs */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6, delay: 1.1 }}
            className="flex flex-wrap items-center gap-3 justify-center">
            <Link to="/book"
              className="group flex items-center gap-2 bg-secondary text-secondary-foreground font-bold rounded-2xl hover:scale-105 transition-transform shadow-2xl"
              style={{ padding: "clamp(0.65rem,2vw,0.95rem) clamp(1.3rem,4vw,2.2rem)", fontSize: "clamp(0.85rem,1.8vw,1rem)" }}>
              <Car className="w-4 h-4 flex-shrink-0" /> {h("cta_primary")}
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <button onClick={() => scrollTo("#services")}
              className="flex items-center gap-2 text-primary-foreground/75 hover:text-primary-foreground border border-white/20 hover:bg-white/5 font-semibold rounded-2xl transition"
              style={{ padding: "clamp(0.65rem,2vw,0.95rem) clamp(1.3rem,4vw,2.2rem)", fontSize: "clamp(0.85rem,1.8vw,1rem)" }}>
              {h("cta_secondary")} <ChevronDown className="w-4 h-4" />
            </button>
          </motion.div>
        </motion.div>

        <motion.div className="absolute bottom-12 lg:bottom-5 left-1/2 -translate-x-1/2" animate={{ y: [0, 7, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
          <ChevronDown className="w-5 h-5 text-primary-foreground/30" />
        </motion.div>
      </section>

      {/* ──── HOW IT WORKS ────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-9 sm:py-24 bg-muted/25 relative">
        <CarPattern opacity={0.03} />
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SH badge="Simple Process" title="Done in 3 Easy Steps" sub="Getting your car professionally detailed has never been easier." />
          <div className="grid grid-cols-3 gap-3 sm:gap-6 lg:gap-10 relative">
            <div className="hidden sm:block absolute top-[4.5rem] left-[18%] right-[18%] h-px bg-gradient-to-r from-secondary/20 via-secondary to-secondary/20" />
            {(hw().steps || D.how_it_works.steps).map((step: any, i: number) => (
              <Reveal key={i} delay={i * 0.12}>
                <div className="text-center relative">
                  <div className="rounded-xl sm:rounded-2xl bg-secondary text-secondary-foreground flex items-center justify-center mx-auto mb-2 sm:mb-5 shadow-lg shadow-secondary/20 relative z-10"
                    style={{ width: "clamp(2.5rem,8vw,5rem)", height: "clamp(2.5rem,8vw,5rem)" }}>
                    {ICON[step.icon] || <CalendarCheck />}
                    <span className="absolute -top-1.5 -right-1.5 rounded-full bg-primary text-primary-foreground font-black flex items-center justify-center border-2 border-card"
                      style={{ width: "clamp(1rem,3vw,1.5rem)", height: "clamp(1rem,3vw,1.5rem)", fontSize: "clamp(8px,1.5vw,11px)" }}>{i + 1}</span>
                  </div>
                  <h3 className="font-bold leading-tight mb-1" style={{ fontSize: "clamp(0.72rem,2vw,1rem)" }}>{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed hidden sm:block" style={{ fontSize: "clamp(0.68rem,1.4vw,0.85rem)" }}>{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="sm:hidden mt-4 space-y-2">
            {(hw().steps || D.how_it_works.steps).map((step: any, i: number) => (
              <div key={i} className="flex items-start gap-3 bg-card rounded-xl border border-border px-3 py-2.5">
                <span className="w-5 h-5 rounded-full bg-secondary text-secondary-foreground font-black flex items-center justify-center flex-shrink-0 text-[10px] mt-0.5">{i + 1}</span>
                <div><p className="font-bold text-sm">{step.title}</p><p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">{step.desc}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──── SERVICES — stable carousel on mobile ────────────────────────── */}
      <section id="services" className="py-9 sm:py-24 bg-background relative">
        <CarPattern opacity={0.035} />
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SH badge="What We Do" title="Services for Every Vehicle" sub="Professional-grade cleaning for all vehicle sizes." />

          {/* Desktop: grid | Mobile: stable carousel */}
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
            {displaySvc.map((svc: any, i: number) => (
              <Reveal key={svc.id} delay={i * 0.1}><ServiceCard svc={svc} /></Reveal>
            ))}
          </div>
          <div className="sm:hidden mb-6">
            <StableCarousel items={displaySvc} interval={4500} minHeight="420px"
              renderItem={(svc: any) => <ServiceCard svc={svc} />} />
          </div>

          {/* Add-ons with per-vehicle pricing */}
          {displayAddons.length > 0 && (
            <Reveal delay={0.2}>
              <div className="bg-muted/30 rounded-2xl border border-border p-4 sm:p-5">
                <p className="font-bold text-muted-foreground uppercase tracking-widest mb-3" style={{ fontSize: "clamp(8px,1.2vw,10px)" }}>
                  Add-on Services
                </p>
                <div className="space-y-3">
                  {displayAddons.map((a: any) => (
                    <div key={a.id} className="bg-card rounded-xl border border-border p-3 sm:p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Wrench className="w-4 h-4 text-secondary flex-shrink-0" />
                        <span className="font-semibold" style={{ fontSize: "clamp(0.78rem,1.6vw,0.9rem)" }}>{a.name}</span>
                        <span className="text-muted-foreground ml-auto hidden sm:block" style={{ fontSize: "clamp(0.7rem,1.3vw,0.8rem)" }}>{a.description}</span>
                      </div>
                      <p className="text-muted-foreground text-xs mb-2 sm:hidden">{a.description}</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[["Small", a.price_small], ["Large", a.price_large], ["XL", a.price_xl], ["Truck", a.price_truck]].map(([l, v]) => (
                          <div key={l as string} className="bg-muted/60 rounded-lg py-1 text-center">
                            <p className="text-muted-foreground font-medium" style={{ fontSize: "clamp(7px,1.2vw,9px)" }}>{l}</p>
                            <p className="font-bold" style={{ fontSize: "clamp(0.62rem,1.3vw,0.78rem)" }}>N${v}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          )}
        </div>
      </section>

      {/* ──── WHY OASIS ───────────────────────────────────────────────────── */}
      <section className="py-9 sm:py-24 bg-primary relative overflow-hidden">
        <div className="absolute top-0 right-0 rounded-full bg-secondary/10 blur-3xl" style={{ width: "min(24rem,60vw)", height: "min(24rem,60vw)" }} />
        <div className="absolute bottom-0 left-0 rounded-full bg-sky-500/10 blur-3xl" style={{ width: "min(16rem,40vw)", height: "min(16rem,40vw)" }} />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
          <SH light badge="Our Advantage" title={fe("title")} sub={fe("subtitle")} />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {(fe("items") || D.features.items).map((item: any, i: number) => (
              <Reveal key={i} delay={i * 0.09}>
                <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl hover:bg-white/10 transition" style={{ padding: "clamp(0.75rem,2.5vw,1.5rem)" }}>
                  <div className="rounded-lg sm:rounded-xl bg-secondary/15 text-secondary flex items-center justify-center mb-2.5 sm:mb-4" style={{ width: "clamp(2rem,5vw,2.75rem)", height: "clamp(2rem,5vw,2.75rem)" }}>
                    {ICON[item.icon] || <ShieldCheck />}
                  </div>
                  <h3 className="font-bold text-white mb-1 sm:mb-2 leading-tight" style={{ fontSize: "clamp(0.75rem,1.8vw,1rem)" }}>{item.title}</h3>
                  <p className="text-primary-foreground/55 leading-relaxed" style={{ fontSize: "clamp(0.65rem,1.4vw,0.82rem)" }}>{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ──── PRICING — stable carousel on mobile ─────────────────────────── */}
      <section id="pricing" className="py-9 sm:py-24 bg-background relative">
        <CarPattern opacity={0.035} />
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SH badge="Subscription Plans" title={ps("title")} sub={ps("subtitle")} />
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {displayPlans.map((plan: any, i: number) => (
              <Reveal key={i} delay={i * 0.08}><PlanCard plan={plan} isPopular={i === 1} /></Reveal>
            ))}
          </div>
          <div className="sm:hidden">
            <StableCarousel items={displayPlans} interval={5000} minHeight="380px"
              renderItem={(plan: any, i: number) => <PlanCard plan={plan} isPopular={i === 1} />} />
          </div>
          <Reveal delay={0.3}>
            <p className="text-center text-muted-foreground mt-4" style={{ fontSize: "clamp(0.7rem,1.4vw,0.82rem)" }}>
              {ps("note")}{" "}<Link to="/auth" className="text-secondary font-semibold hover:underline">Sign up free</Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ──── REVIEWS — stable carousel on mobile ─────────────────────────── */}
      {reviews.length > 0 && (
        <section className="py-9 sm:py-24 bg-muted/25">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <SH badge="Reviews" title={rs("title")} sub={rs("subtitle")} />
            <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {reviews.slice(0, 6).map((rev: any, i: number) => (
                <Reveal key={i} delay={i * 0.09}><ReviewCard rev={rev} /></Reveal>
              ))}
            </div>
            <div className="sm:hidden">
              <StableCarousel items={reviews} interval={4200} minHeight="220px"
                renderItem={(rev: any) => <ReviewCard rev={rev} />} />
            </div>
          </div>
        </section>
      )}


      {/* ──── LOYALTY PROGRAMME ──────────────────────────────────────── */}
      <section className="py-9 sm:py-24 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none overflow-hidden">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs><pattern id="star-tile" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
              <polygon points="40,8 48,30 70,30 53,46 60,68 40,55 20,68 27,46 10,30 32,30" fill="white" opacity="1"/>
            </pattern></defs>
            <rect width="100%" height="100%" fill="url(#star-tile)"/>
          </svg>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
          <SH light badge="Loyalty Rewards" title="Earn Points. Get Free Washes." sub="Every booking earns you points. Collect enough and your next wash is on us." />

          {/* 3-step flow */}
          <div className="grid grid-cols-3 gap-3 sm:gap-6 mb-8 relative">
            <div className="hidden sm:block absolute top-8 left-[18%] right-[18%] h-px bg-gradient-to-r from-white/10 via-white/30 to-white/10" />
            {[
              { step: "1", icon: <Car className="w-5 h-5 sm:w-7 sm:h-7" />,   title: "Book a Wash",    body: "Every completed wash earns you 10 loyalty points automatically." },
              { step: "2", icon: <Award className="w-5 h-5 sm:w-7 sm:h-7" />, title: "Collect Points",  body: "Reach 100 redeemable points. Refer a friend for bonus points too." },
              { step: "3", icon: <Crown className="w-5 h-5 sm:w-7 sm:h-7" />, title: "Redeem Free Wash",body: "Use 100 points to unlock a completely free standard car wash." },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <div className="text-center">
                  <div className="rounded-xl sm:rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center mx-auto mb-2 sm:mb-4 relative"
                    style={{ width: "clamp(2.5rem,8vw,4.5rem)", height: "clamp(2.5rem,8vw,4.5rem)" }}>
                    {item.icon}
                    <span className="absolute -top-1.5 -right-1.5 rounded-full bg-secondary text-secondary-foreground font-black flex items-center justify-center border-2 border-primary"
                      style={{ width: "clamp(1rem,3vw,1.4rem)", height: "clamp(1rem,3vw,1.4rem)", fontSize: "clamp(8px,1.5vw,10px)" }}>{item.step}</span>
                  </div>
                  <h3 className="font-bold text-white mb-1 leading-tight" style={{ fontSize: "clamp(0.7rem,2vw,1rem)" }}>{item.title}</h3>
                  <p className="text-primary-foreground/60 leading-relaxed hidden sm:block" style={{ fontSize: "clamp(0.68rem,1.4vw,0.85rem)" }}>{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Mobile descriptions */}
          <div className="sm:hidden mb-8 space-y-2">
            {[
              { step:"1", title:"Book a Wash",    body:"Every completed wash earns you 10 loyalty points." },
              { step:"2", title:"Collect Points",  body:"Reach 100 redeemable points to unlock a free wash." },
              { step:"3", title:"Redeem Free Wash",body:"Use 100 points for a completely free standard wash." },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                <span className="w-5 h-5 rounded-full bg-secondary text-secondary-foreground font-black flex items-center justify-center flex-shrink-0 text-[10px] mt-0.5">{item.step}</span>
                <div>
                  <p className="font-bold text-white text-sm">{item.title}</p>
                  <p className="text-primary-foreground/55 text-xs mt-0.5 leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Tier cards */}
          <Reveal delay={0.2}>
            <div className="bg-white/5 border border-white/10 rounded-2xl mb-6" style={{ padding: "clamp(1rem,3vw,1.5rem)" }}>
              <p className="text-center text-primary-foreground/60 font-bold uppercase tracking-widest mb-4" style={{ fontSize: "clamp(8px,1.5vw,10px)" }}>Membership Tiers</p>
              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                {[
                  { tier:"Bronze",  emoji:"🥉", pts:"0+",    grad:"from-amber-700/30 to-amber-800/10", desc:"Starter" },
                  { tier:"Silver",  emoji:"🥈", pts:"500+",  grad:"from-slate-400/30  to-slate-500/10", desc:"Double pts" },
                  { tier:"Gold",    emoji:"🥇", pts:"1500+", grad:"from-yellow-500/30  to-yellow-600/10",desc:"Priority" },
                  { tier:"Platinum",emoji:"💎", pts:"3000+", grad:"from-violet-500/30  to-violet-600/10",desc:"VIP" },
                ].map(t => (
                  <div key={t.tier} className={"bg-gradient-to-br " + t.grad + " rounded-xl border border-white/10 text-center"} style={{ padding: "clamp(0.5rem,2vw,1rem)" }}>
                    <span style={{ fontSize: "clamp(1rem,4vw,2rem)" }}>{t.emoji}</span>
                    <p className="font-black text-white leading-tight mt-0.5" style={{ fontSize: "clamp(0.65rem,1.8vw,0.9rem)" }}>{t.tier}</p>
                    <p className="text-secondary font-bold" style={{ fontSize: "clamp(0.6rem,1.3vw,0.75rem)" }}>{t.pts} pts</p>
                    <p className="text-primary-foreground/50 hidden sm:block" style={{ fontSize: "clamp(0.58rem,1.1vw,0.68rem)" }}>{t.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Bonus info strip */}
          <Reveal delay={0.25}>
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
              {[
                { val:"+10 pts", label:"per completed booking" },
                { val:"100 pts", label:"= 1 free standard wash" },
                { val:"+Bonus",  label:"for referring a friend" },
              ].map((s, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl text-center" style={{ padding: "clamp(0.5rem,2vw,0.9rem)" }}>
                  <p className="text-secondary font-black" style={{ fontSize: "clamp(0.85rem,2.5vw,1.4rem)" }}>{s.val}</p>
                  <p className="text-primary-foreground/50" style={{ fontSize: "clamp(0.58rem,1.3vw,0.72rem)" }}>{s.label}</p>
                </div>
              ))}
            </div>
          </Reveal>

          {/* CTA */}
          <Reveal delay={0.3}>
            <div className="text-center">
              <Link to="/auth"
                className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground font-bold rounded-2xl hover:scale-105 transition-transform shadow-2xl"
                style={{ padding: "clamp(0.65rem,2vw,0.95rem) clamp(1.5rem,4vw,2.5rem)", fontSize: "clamp(0.85rem,1.8vw,1rem)" }}>
                <Award className="w-4 h-4" /> Start Earning Points Today
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <p className="text-primary-foreground/45 mt-3" style={{ fontSize: "clamp(0.7rem,1.4vw,0.82rem)" }}>
                Free to join. Points count from your very first booking.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ──── ABOUT ───────────────────────────────────────────────────────── */}
      <section id="about" className="py-9 sm:py-24 bg-background relative">
        <CarPattern opacity={0.025} />
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 lg:gap-14 items-center">
            <div>
              <Reveal>
                <span className="inline-flex items-center gap-1.5 text-secondary bg-secondary/10 border border-secondary/10 font-bold uppercase rounded-full mb-4 sm:mb-6"
                  style={{ padding: "0.375rem 0.875rem", fontSize: "clamp(8px,1.4vw,11px)", letterSpacing: "0.18em" }}>
                  <Building2 className="w-3 h-3 flex-shrink-0" /> Our Story
                </span>
              </Reveal>
              <Reveal delay={0.1}>
                <h2 className="font-display font-black leading-tight mb-3 sm:mb-4" style={{ fontSize: "clamp(1.45rem,4vw,2.8rem)" }}>{ab("title")}</h2>
              </Reveal>
              <Reveal delay={0.18}>
                <p className="text-muted-foreground leading-relaxed mb-4 sm:mb-5" style={{ fontSize: "clamp(0.82rem,1.8vw,1rem)" }}>{ab("story")}</p>
              </Reveal>
              <Reveal delay={0.24}>
                <div className="bg-muted/50 border border-border rounded-xl sm:rounded-2xl mb-4" style={{ padding: "clamp(0.7rem,2vw,1.2rem)" }}>
                  <p className="font-bold uppercase tracking-widest text-muted-foreground mb-1" style={{ fontSize: "clamp(8px,1.2vw,10px)" }}>Our Mission</p>
                  <p className="text-foreground leading-relaxed" style={{ fontSize: "clamp(0.78rem,1.7vw,0.92rem)" }}>{ab("mission")}</p>
                </div>
              </Reveal>
              <Reveal delay={0.3}>
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                  {(ab("values") || D.about.values).map((v: string, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <BadgeCheck className="w-4 h-4 text-secondary flex-shrink-0" />
                      <span className="font-medium" style={{ fontSize: "clamp(0.7rem,1.5vw,0.83rem)" }}>{v}</span>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            {/* Stat visual card */}
            <Reveal delay={0.2}>
              <div className="relative">
                <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary via-primary to-secondary/20 overflow-hidden shadow-2xl" style={{ aspectRatio: "4/3" }}>
                  <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 30% 40%,#FF8C00,transparent 50%),radial-gradient(circle at 70% 70%,rgba(0,120,200,.8),transparent 50%)" }} />
                  <div className="relative z-10 h-full flex flex-col items-center justify-center" style={{ padding: "clamp(1rem,4vw,2rem)" }}>
                    <img src={logoBrand} alt="Oasis" className="w-auto drop-shadow-2xl mb-4 sm:mb-6" style={{ height: "clamp(4rem,10vw,7rem)" }} />
                    <div className="grid grid-cols-3 gap-2 sm:gap-5 w-full">
                      {[
                        { val: ab("vehicles_washed") || "2,500+", label: "Vehicles Washed" },
                        { val: ab("happy_customers") || "800+",   label: "Happy Clients" },
                        { val: ab("areas_served")    || "15+",    label: "Areas Served" },
                      ].map(s => (
                        <div key={s.label} className="text-center">
                          <p className="text-white font-black" style={{ fontSize: "clamp(1rem,3.5vw,2rem)" }}>{s.val}</p>
                          <p className="text-white/50 uppercase tracking-wider mt-0.5" style={{ fontSize: "clamp(6px,1.1vw,9px)" }}>{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <motion.div animate={{ y: [-4, 4, -4] }} transition={{ duration: 3, repeat: Infinity }}
                  className="absolute -top-3 -right-3 sm:-top-4 sm:-right-4 bg-secondary text-secondary-foreground font-bold px-2.5 sm:px-3 py-1.5 rounded-full shadow-xl"
                  style={{ fontSize: "clamp(8px,1.3vw,11px)" }}>
                  <Award className="w-3 h-3 inline mr-0.5" />Windhoek's Best
                </motion.div>
                <motion.div animate={{ y: [4, -4, 4] }} transition={{ duration: 4, repeat: Infinity }}
                  className="absolute -bottom-3 -left-3 sm:-bottom-4 sm:-left-4 bg-card border border-border font-bold px-2.5 sm:px-3 py-1.5 rounded-full shadow-xl"
                  style={{ fontSize: "clamp(8px,1.3vw,11px)" }}>
                  <Zap className="w-3 h-3 inline mr-0.5 text-secondary" />Book in 2 min
                </motion.div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ──── CONTACT ─────────────────────────────────────────────────────── */}
      <section id="contact" className="py-9 sm:py-24 bg-muted/25 relative">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SH badge="Get in Touch" title="Contact Us" sub="Ready to book or have a question? We are always available." />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <Reveal>
              <div className="bg-card rounded-2xl border border-border h-full" style={{ padding: "clamp(1rem,3vw,2rem)" }}>
                <h3 className="font-bold mb-4 sm:mb-5" style={{ fontSize: "clamp(1rem,2.2vw,1.25rem)" }}>Reach Out</h3>
                <div className="space-y-3">
                  {[
                    { icon: <Phone className="w-4 h-4" />,        label: "Phone",    val: co("phone") || "+264 81 278 1123" },
                    { icon: <MessageCircle className="w-4 h-4" />, label: "WhatsApp", val: co("whatsapp") || "+264 81 278 1123" },
                    { icon: <Mail className="w-4 h-4" />,          label: "Email",    val: co("email") || "info@oasispurecleaning.com" },
                    { icon: <MapPin className="w-4 h-4" />,        label: "Location", val: co("address") || "Windhoek, Namibia" },
                    { icon: <Clock className="w-4 h-4" />,         label: "Hours",    val: co("operating_hours") || "Mon to Sat: 07:00 to 19:00" },
                  ].map(item => (
                    <div key={item.label} className="flex items-start gap-3">
                      <div className="rounded-lg sm:rounded-xl bg-secondary/10 text-secondary flex items-center justify-center flex-shrink-0"
                        style={{ width: "clamp(1.8rem,4vw,2.25rem)", height: "clamp(1.8rem,4vw,2.25rem)" }}>{item.icon}</div>
                      <div className="min-w-0">
                        <p className="font-bold uppercase tracking-wider text-muted-foreground" style={{ fontSize: "clamp(7px,1.1vw,9px)" }}>{item.label}</p>
                        <p className="font-semibold truncate" style={{ fontSize: "clamp(0.72rem,1.6vw,0.875rem)" }}>{item.val}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <a href={`tel:${(co("phone") || "").replace(/\s+/g, "")}`}
                    className="flex items-center justify-center gap-1.5 bg-secondary text-secondary-foreground py-2.5 rounded-xl font-bold hover:opacity-90 transition"
                    style={{ fontSize: "clamp(0.7rem,1.5vw,0.82rem)" }}>
                    <Phone className="w-3.5 h-3.5" /> Call Us
                  </a>
                  <a href={`https://wa.me/${(co("whatsapp") || "264812781123").replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 bg-green-600 text-white py-2.5 rounded-xl font-bold hover:opacity-90 transition"
                    style={{ fontSize: "clamp(0.7rem,1.5vw,0.82rem)" }}>
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.12}>
              <div className="bg-card rounded-2xl border border-border h-full flex flex-col" style={{ padding: "clamp(1rem,3vw,2rem)" }}>
                <h3 className="font-bold mb-3 sm:mb-4 flex items-center gap-2" style={{ fontSize: "clamp(1rem,2.2vw,1.25rem)" }}>
                  <ShieldCheck className="text-secondary flex-shrink-0" style={{ width: "clamp(16px,2.5vw,20px)", height: "clamp(16px,2.5vw,20px)" }} />
                  EFT Payment Details
                </h3>
                <div className="flex-1 bg-muted/40 rounded-xl border border-dashed border-border flex flex-col items-center justify-center text-center mb-4"
                  style={{ padding: "clamp(1.2rem,3.5vw,2.5rem)" }}>
                  <Lock className="text-muted-foreground/30 mb-2.5" style={{ width: "clamp(2rem,5vw,2.5rem)", height: "clamp(2rem,5vw,2.5rem)" }} />
                  <p className="font-bold mb-1" style={{ fontSize: "clamp(0.8rem,1.8vw,0.95rem)" }}>Banking details are private</p>
                  <p className="text-muted-foreground leading-relaxed" style={{ fontSize: "clamp(0.7rem,1.4vw,0.8rem)" }}>Sign in to view full EFT banking details for payment.</p>
                </div>
                <div className="bg-secondary/5 border border-secondary/15 rounded-xl mb-3" style={{ padding: "clamp(0.6rem,1.8vw,0.9rem)" }}>
                  <p className="text-muted-foreground leading-relaxed" style={{ fontSize: "clamp(0.65rem,1.2vw,0.75rem)" }}>
                    <strong className="text-foreground">After payment:</strong> Upload proof in your booking confirmation. Admin will verify and confirm.
                  </p>
                </div>
                <Link to="/auth" className="block text-center bg-primary text-primary-foreground py-2.5 rounded-xl font-bold hover:opacity-90 transition"
                  style={{ fontSize: "clamp(0.72rem,1.4vw,0.85rem)" }}>
                  Sign In to View Banking Details
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ──── CTA BAND ────────────────────────────────────────────────────── */}
      <section className="py-9 sm:py-20 bg-secondary relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle at 20% 50%,white,transparent 55%),radial-gradient(circle at 80% 50%,white,transparent 55%)" }} />
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <Reveal>
            <h2 className="font-display font-black text-secondary-foreground leading-tight mb-3" style={{ fontSize: "clamp(1.6rem,5.5vw,3.2rem)" }}>
              {cb("headline")} <span className="block sm:inline">{cb("headline2")}</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-secondary-foreground/80 mb-6" style={{ fontSize: "clamp(0.85rem,2vw,1.05rem)" }}>{cb("body")}</p>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/book" className="flex items-center justify-center gap-2 bg-primary text-primary-foreground font-black rounded-2xl hover:scale-105 transition-transform shadow-2xl"
                style={{ padding: "clamp(0.7rem,2vw,0.95rem) clamp(1.4rem,4vw,2.2rem)", fontSize: "clamp(0.82rem,1.8vw,1rem)" }}>
                <Car className="w-4 h-4" /> {cb("cta1")}
              </Link>
              <Link to="/auth" className="flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 text-secondary-foreground font-bold rounded-2xl transition"
                style={{ padding: "clamp(0.7rem,2vw,0.95rem) clamp(1.4rem,4vw,2.2rem)", fontSize: "clamp(0.82rem,1.8vw,1rem)" }}>
                {cb("cta2")}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ──── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="bg-primary text-primary-foreground pb-12 lg:pb-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 sm:gap-8 mb-7">
            <div className="col-span-2 sm:col-span-1">
              <img src={logoBrand} alt="Oasis" className="w-auto mb-3 object-contain" style={{ height: "clamp(2.2rem,5.5vw,3rem)" }} />
              <p className="text-primary-foreground/55 leading-relaxed" style={{ fontSize: "clamp(0.68rem,1.4vw,0.8rem)" }}>{ft("tagline")}</p>
              {(co("instagram") || co("facebook")) && (
                <div className="flex gap-2 mt-3">
                  {co("instagram") && <a href={co("instagram")} target="_blank" rel="noreferrer" className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition"><Instagram className="w-3.5 h-3.5" /></a>}
                  {co("facebook")  && <a href={co("facebook")}  target="_blank" rel="noreferrer" className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition"><Facebook  className="w-3.5 h-3.5" /></a>}
                </div>
              )}
            </div>
            <div>
              <h4 className="font-bold uppercase tracking-widest mb-3 text-primary-foreground/40" style={{ fontSize: "clamp(7px,1.1vw,9px)" }}>Services</h4>
              <ul className="space-y-1.5 text-primary-foreground/60" style={{ fontSize: "clamp(0.68rem,1.3vw,0.78rem)" }}>
                {["Basic Interior", "Basic Exterior", "Full Detailing", "Engine Bay"].map(s => (
                  <li key={s}><Link to="/book" className="hover:text-secondary transition">{s}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-bold uppercase tracking-widest mb-3 text-primary-foreground/40" style={{ fontSize: "clamp(7px,1.1vw,9px)" }}>Quick Links</h4>
              <ul className="space-y-1.5 text-primary-foreground/60" style={{ fontSize: "clamp(0.68rem,1.3vw,0.78rem)" }}>
                <li><Link to="/book" className="hover:text-secondary transition">Book a Wash</Link></li>
                <li><Link to="/auth" className="hover:text-secondary transition">Customer Portal</Link></li>
                <li><Link to="/dashboard" className="hover:text-secondary transition">My Dashboard</Link></li>
                <li><Link to="/admin" className="hover:text-secondary transition">Admin Login</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold uppercase tracking-widest mb-3 text-primary-foreground/40" style={{ fontSize: "clamp(7px,1.1vw,9px)" }}>Contact</h4>
              <ul className="space-y-1.5 text-primary-foreground/60" style={{ fontSize: "clamp(0.68rem,1.3vw,0.78rem)" }}>
                <li className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-secondary flex-shrink-0" /><span className="truncate">{co("phone") || "+264 81 278 1123"}</span></li>
                <li className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-secondary flex-shrink-0" /><span className="truncate">{co("email") || "info@oasispurecleaning.com"}</span></li>
                <li className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-secondary flex-shrink-0" />{co("address") || "Windhoek, Namibia"}</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-primary-foreground/30"
            style={{ fontSize: "clamp(0.62rem,1.1vw,0.72rem)" }}>
            <p>© {new Date().getFullYear()} {ft("copyright")}</p>
            <div className="flex items-center gap-3"><span>Windhoek, Namibia</span><span>·</span><Link to="/book" className="hover:text-secondary transition">Book Now</Link></div>
          </div>
        </div>
      </footer>

      <WinnyChatbot />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ServiceCard({ svc }: { svc: any }) {
  return (
    <div className="bg-card rounded-2xl border border-border flex flex-col">
      <div className="rounded-t-2xl bg-gradient-to-br from-primary to-secondary/20 relative overflow-hidden flex items-center justify-center"
        style={{ height: "clamp(90px,15vw,130px)" }}>
        <Car className="absolute right-3 bottom-2 text-white/8" style={{ width: "clamp(3rem,8vw,5rem)", height: "clamp(3rem,8vw,5rem)" }} />
        <div className="rounded-xl bg-white/10 border border-white/15 flex items-center justify-center relative z-10"
          style={{ width: "clamp(2.5rem,6vw,3.5rem)", height: "clamp(2.5rem,6vw,3.5rem)" }}>
          <Sparkles className="text-secondary" style={{ width: "clamp(1.1rem,3vw,1.6rem)", height: "clamp(1.1rem,3vw,1.6rem)" }} />
        </div>
      </div>
      <div className="flex flex-col flex-1" style={{ padding: "clamp(0.85rem,2.5vw,1.25rem)" }}>
        <h3 className="font-bold mb-1.5 leading-tight" style={{ fontSize: "clamp(0.82rem,2vw,1rem)" }}>{svc.name}</h3>
        <p className="text-muted-foreground mb-3 flex-1" style={{ fontSize: "clamp(0.72rem,1.5vw,0.85rem)" }}>{svc.description}</p>
        <div className="grid grid-cols-4 gap-1 mb-3">
          {[["Small", svc.price_small], ["Large", svc.price_large], ["XL", svc.price_xl], ["Truck", svc.price_truck]].map(([l, v]) => (
            <div key={l as string} className="bg-muted/60 rounded-lg py-1.5 text-center">
              <p className="text-muted-foreground font-medium" style={{ fontSize: "clamp(7px,1.2vw,9px)" }}>{l}</p>
              <p className="font-bold text-foreground" style={{ fontSize: "clamp(0.62rem,1.3vw,0.78rem)" }}>N${v}</p>
            </div>
          ))}
        </div>
        <Link to="/book" className="block text-center bg-secondary/10 hover:bg-secondary/20 text-secondary py-2 rounded-xl font-bold transition"
          style={{ fontSize: "clamp(0.72rem,1.5vw,0.85rem)" }}>
          Book This Service
        </Link>
      </div>
    </div>
  );
}

function PlanCard({ plan, isPopular }: { plan: any; isPopular: boolean }) {
  return (
    <div className={`relative rounded-2xl border flex flex-col ${isPopular ? "bg-secondary text-secondary-foreground border-secondary shadow-2xl shadow-secondary/20" : "bg-card border-border"}`}
      style={{ padding: "clamp(0.9rem,2.5vw,1.6rem)" }}>
      {isPopular && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap"
          style={{ fontSize: "clamp(8px,1.3vw,10px)" }}>
          <Crown className="w-2.5 h-2.5" /> Most Popular
        </div>
      )}
      <div className="flex items-center gap-2 mb-2">
        <Wallet className={`w-4 h-4 ${isPopular ? "text-secondary-foreground/80" : "text-secondary"}`} />
        <h3 className="font-black" style={{ fontSize: "clamp(0.95rem,2.2vw,1.25rem)" }}>{plan.plan_name}</h3>
      </div>
      <p className={`mb-3 leading-relaxed ${isPopular ? "text-secondary-foreground/75" : "text-muted-foreground"}`}
        style={{ fontSize: "clamp(0.67rem,1.3vw,0.78rem)" }}>{plan.description}</p>
      <div className="mb-4 flex items-baseline gap-1">
        {plan.monthly_price > 0
          ? <><span className="font-black" style={{ fontSize: "clamp(1.4rem,4.5vw,2.2rem)" }}>N${plan.monthly_price}</span>
              <span className={`font-medium ${isPopular ? "text-secondary-foreground/60" : "text-muted-foreground"}`}
                style={{ fontSize: "clamp(0.65rem,1.1vw,0.75rem)" }}>/mo</span></>
          : <span className="font-black" style={{ fontSize: "clamp(1rem,3vw,1.4rem)" }}>Custom</span>}
      </div>
      <div className="flex-1 space-y-1.5 mb-4">
        {[
          plan.allowed_bookings_per_month < 50 ? `${plan.allowed_bookings_per_month} washes per month` : "Unlimited washes",
          "Priority booking",
          "Loyalty points earned",
        ].map((f, j) => (
          <div key={j} className="flex items-center gap-1.5">
            <PackageCheck className={`w-3.5 h-3.5 flex-shrink-0 ${isPopular ? "text-secondary-foreground" : "text-secondary"}`} />
            <span style={{ fontSize: "clamp(0.67rem,1.3vw,0.78rem)" }}>{f}</span>
          </div>
        ))}
      </div>
      <Link to="/dashboard"
        className={`block text-center py-2.5 rounded-xl font-bold transition ${isPopular ? "bg-primary text-primary-foreground hover:opacity-90" : "bg-secondary/10 text-secondary hover:bg-secondary/20"}`}
        style={{ fontSize: "clamp(0.7rem,1.4vw,0.82rem)" }}>
        Get Started
      </Link>
    </div>
  );
}

function ReviewCard({ rev }: { rev: any }) {
  return (
    <div className="bg-card rounded-2xl border border-border" style={{ padding: "clamp(0.9rem,2.5vw,1.5rem)" }}>
      <Quote className="text-secondary/20 mb-2" style={{ width: "clamp(1.5rem,4vw,2rem)", height: "clamp(1.5rem,4vw,2rem)" }} />
      <div className="flex gap-0.5 mb-2.5">
        {Array.from({ length: 5 }).map((_, j) => (
          <Star key={j} className={`${j < rev.star_rating ? "fill-secondary text-secondary" : "text-border"}`}
            style={{ width: "clamp(10px,2vw,14px)", height: "clamp(10px,2vw,14px)" }} />
        ))}
      </div>
      <p className="text-muted-foreground leading-relaxed mb-2" style={{ fontSize: "clamp(0.72rem,1.5vw,0.875rem)" }}>
        {rev.review_comment || "Great service. Very professional and thorough."}
      </p>
      <p className="text-muted-foreground/50 font-medium" style={{ fontSize: "clamp(0.62rem,1.1vw,0.72rem)" }}>
        {rev.customer_name || "Verified Oasis Customer"}
      </p>
    </div>
  );
}
