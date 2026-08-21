/**
 * LandingPage.tsx — Oasis Pure Cleaning CC
 * Premium motion-driven landing page. UI/UX Pro Max.
 *
 * Architecture:  Page orchestrator — all sections are separate components.
 * Data:          Supabase (services, plans, reviews, session).
 * Motion:        Framer Motion with shared variant system.
 * Performance:   prefers-reduced-motion respected, no parallax,
 *               animations are entrance-only or hover-only.
 * Conversion:    Every section drives toward /book.
 */

import React, { useState, useEffect } from "react";
import { Link }                        from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowRight, BadgeCheck, Building2, CalendarCheck,
  Car, ChevronDown, CheckCircle2, Clock, Crown,
  Facebook, Instagram, Layers, Lock,
  Mail, MapPin, Menu, MessageCircle,
  Navigation, PackageCheck, Phone, Recycle,
  ShieldCheck, Smartphone, Star, Timer,
  Truck, Users, Wallet, X, Zap,
} from "lucide-react";

import { supabase }                from "@/lib/supabase";
import { getAllServices }           from "@/lib/bookingService";
import { fetchSubscriptionPlans }  from "@/lib/subscriptionService";
import { getSessionUser, getUserProfile } from "@/lib/authService";
import logoBrand                   from "@/assets/logo-brand.png";
import { BeforeAfter }             from "@/components/landing/BeforeAfter";
import { Technology }              from "@/components/landing/Technology";
import type { ServiceRow }         from "@/lib/bookingService";

// ─── Shared motion tokens ─────────────────────────────────────────────────────
const E = [0.22, 1, 0.36, 1] as const;
const V = {
  fadeUp:  { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: E } } },
  fadeIn:  { hidden: { opacity: 0 },        visible: { opacity: 1,       transition: { duration: 0.5, ease: E } } },
  scaleIn: { hidden: { opacity: 0, scale: 0.93 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.55, ease: E } } },
  slideL:  { hidden: { opacity: 0, x: -32 }, visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: E } } },
  slideR:  { hidden: { opacity: 0, x: 32 },  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: E } } },
  stagger: { hidden: {}, visible: { transition: { staggerChildren: 0.11, delayChildren: 0.05 } } },
};
const VP = { once: true, margin: "-60px" };

// ─── Primitive helpers ────────────────────────────────────────────────────────
function Reveal({ children, v = "fadeUp", delay = 0, className = "" }: {
  children: React.ReactNode; v?: keyof typeof V; delay?: number; className?: string;
}) {
  return (
    <motion.div variants={V[v] as any} initial="hidden" whileInView="visible" viewport={VP}
      transition={{ delay } as any} className={className}>
      {children}
    </motion.div>
  );
}

function SectionBadge({ label, light = false }: { label: string; light?: boolean }) {
  return (
    <Reveal>
      <span className={`inline-flex items-center gap-1.5 font-bold uppercase px-3 py-1 rounded-full mb-3 sm:mb-4
        text-[10px] sm:text-[11px] tracking-widest
        ${light
          ? "bg-white/10 text-white/70 border border-white/15"
          : "bg-secondary/10 text-secondary border border-secondary/20"
        }`}>
        <Zap className="w-2.5 h-2.5" /> {label}
      </span>
    </Reveal>
  );
}

function SectionHeading({ badge, title, sub, light = false, left = false }: {
  badge?: string; title: React.ReactNode; sub?: string; light?: boolean; left?: boolean;
}) {
  return (
    <div className={`mb-10 sm:mb-16 ${left ? "" : "text-center"}`}>
      {badge && <SectionBadge label={badge} light={light} />}
      <Reveal v="fadeUp" delay={0.08}>
        <h2 className={`font-display font-black tracking-tight leading-[1.1] mb-3
          ${light ? "text-white" : "text-foreground"}`}
          style={{ fontSize: "clamp(1.75rem, 4.5vw, 3.25rem)" }}>
          {title}
        </h2>
      </Reveal>
      {sub && (
        <Reveal v="fadeUp" delay={0.16}>
          <p className={`leading-relaxed ${left ? "" : "max-w-2xl mx-auto"}
            ${light ? "text-white/55" : "text-muted-foreground"}`}
            style={{ fontSize: "clamp(0.875rem, 2vw, 1.075rem)" }}>
            {sub}
          </p>
        </Reveal>
      )}
    </div>
  );
}

function BookBtn({ to = "/book", label = "Book a Wash", variant = "primary", className = "" }: {
  to?: string; label?: string; variant?: "primary" | "dark" | "ghost"; className?: string;
}) {
  const styles = {
    primary: "bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-lg shadow-secondary/25",
    dark:    "bg-primary text-primary-foreground hover:bg-primary/85 shadow-lg",
    ghost:   "bg-white/10 text-white border border-white/20 hover:bg-white/18",
  };
  return (
    <motion.div whileTap={{ scale: 0.97 }} className={`inline-block ${className}`}>
      <Link to={to}
        className={`inline-flex items-center gap-2 font-bold rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${styles[variant]}`}
        style={{ padding: "clamp(0.7rem,1.8vw,0.9rem) clamp(1.4rem,3.5vw,2rem)", fontSize: "clamp(0.875rem,1.8vw,1rem)" }}>
        {label} <ArrowRight className="w-4 h-4 flex-shrink-0" />
      </Link>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// NAVBAR
// ══════════════════════════════════════════════════════════════════════════════
function Navbar({ userLink }: { userLink: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [open,     setOpen]     = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 64);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const go = (id: string) => {
    setOpen(false);
    setTimeout(() => document.querySelector(id)?.scrollIntoView({ behavior: "smooth" }), 80);
  };

  const NAV = [
    { l: "Services",     h: "#services"     },
    { l: "How It Works", h: "#how-it-works"  },
    { l: "Membership",   h: "#membership"    },
    { l: "Fleet",        h: "#fleet"         },
    { l: "Technology",   h: "#technology"    },
    { l: "About",        h: "#about"         },
  ];

  return (
    <>
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55, ease: E }}
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300
          ${scrolled ? "bg-primary/96 backdrop-blur-lg shadow-2xl border-b border-white/5" : "bg-transparent"}`}>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between"
          style={{ height: "clamp(60px,8vw,76px)" }}>

          <Link to="/" aria-label="Oasis Pure Cleaning CC" className="flex-shrink-0">
            <img src={logoBrand} alt="Oasis Pure Cleaning CC" className="w-auto object-contain"
              style={{ height: "clamp(2.6rem,6vw,3.25rem)" }} />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-6 xl:gap-7" aria-label="Main navigation">
            {NAV.map(n => (
              <button key={n.l} onClick={() => go(n.h)}
                className="text-primary-foreground/70 hover:text-primary-foreground font-semibold transition-colors text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
                {n.l}
              </button>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link to={userLink} className="text-primary-foreground/60 hover:text-primary-foreground text-sm font-semibold transition-colors">
              {userLink === "/auth" ? "Sign In" : "Dashboard"}
            </Link>
            <motion.div whileTap={{ scale: 0.97 }}>
              <Link to="/book"
                className="flex items-center gap-1.5 bg-secondary text-secondary-foreground font-bold rounded-xl hover:bg-secondary/90 transition-colors shadow-md text-sm"
                style={{ padding: "0.5rem 1.15rem" }}>
                <Car className="w-3.5 h-3.5" /> Book a Wash
              </Link>
            </motion.div>
          </div>

          <button onClick={() => setOpen(o => !o)} aria-label="Toggle menu"
            className="lg:hidden text-primary-foreground p-2 rounded-lg hover:bg-white/10 transition-colors">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: E }}
              className="lg:hidden overflow-hidden bg-primary border-t border-white/10">
              <div className="px-4 py-3 space-y-0.5">
                {NAV.map(n => (
                  <button key={n.l} onClick={() => go(n.h)}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground/80 hover:bg-white/10 hover:text-primary-foreground transition-colors">
                    {n.l}
                  </button>
                ))}
              </div>
              <div className="px-4 pb-4 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
                <Link to={userLink} onClick={() => setOpen(false)}
                  className="py-2.5 text-center rounded-xl border border-white/20 text-primary-foreground text-sm font-semibold">
                  {userLink === "/auth" ? "Sign In" : "Dashboard"}
                </Link>
                <Link to="/book" onClick={() => setOpen(false)}
                  className="py-2.5 text-center rounded-xl bg-secondary text-secondary-foreground text-sm font-black">
                  Book Now
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Mobile bottom CTA bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card/96 backdrop-blur-md border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex gap-2 px-3 py-2">
          <Link to={userLink}
            className="flex-1 py-2.5 text-center rounded-xl border border-border text-foreground text-xs font-semibold">
            {userLink === "/auth" ? "Sign In" : "Dashboard"}
          </Link>
          <Link to="/book"
            className="flex-1 py-2.5 text-center rounded-xl bg-secondary text-secondary-foreground text-sm font-black flex items-center justify-center gap-1.5">
            <Car className="w-3.5 h-3.5" /> Book a Wash
          </Link>
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HERO
// ══════════════════════════════════════════════════════════════════════════════
function Hero() {
  const reduced = useReducedMotion();
  const go = (id: string) => document.querySelector(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <section className="relative min-h-[100svh] flex flex-col justify-center bg-primary overflow-hidden"
      style={{ paddingTop: "clamp(80px,12vw,100px)", paddingBottom: "clamp(80px,8vw,96px)" }}>

      {/* Dot grid */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.7) 1px,transparent 1px)", backgroundSize: "28px 28px" }} />

      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary/15 blur-[110px] pointer-events-none"
        style={{ width: "min(720px,95vw)", height: "min(380px,48vh)" }} />
      <div className="absolute bottom-0 right-0 rounded-full bg-sky-400/8 blur-[80px] pointer-events-none"
        style={{ width: "min(340px,50vw)", height: "min(260px,38vh)" }} />

      {/* Car silhouette — desktop decoration */}
      {!reduced && (
        <motion.div initial={{ opacity: 0, x: 80 }} animate={{ opacity: 0.07, x: 0 }}
          transition={{ duration: 1.4, delay: 0.6, ease: E }}
          className="absolute right-0 bottom-0 pointer-events-none hidden lg:block"
          style={{ width: "min(56vw,760px)" }}>
          <svg viewBox="0 0 760 400" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M100 300 L100 244 L190 168 L375 148 L560 168 L640 240 L660 300 Z" fill="white" />
            <path d="M210 244 L244 184 L460 170 L540 244" fill="white" fillOpacity="0.6" />
            <circle cx="215" cy="312" r="52" fill="white" />
            <circle cx="545" cy="312" r="52" fill="white" />
            <path d="M640 240 L660 252 L658 272 L636 270 Z" fill="white" fillOpacity="0.8" />
          </svg>
        </motion.div>
      )}

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 w-full">
        <div className="max-w-3xl">

          {/* Location badge */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: E }} className="flex items-center gap-3 mb-7 sm:mb-9">
            <span className="inline-flex items-center gap-1.5 bg-secondary/15 border border-secondary/25 text-secondary font-bold uppercase rounded-full text-[10px] tracking-widest"
              style={{ padding: "0.3rem 0.85rem" }}>
              <MapPin className="w-2.5 h-2.5" /> Windhoek, Namibia
            </span>
          </motion.div>

          {/* Headline — stagger lines */}
          <motion.div variants={V.stagger} initial="hidden" animate="visible" className="mb-5 sm:mb-7">
            <div className="overflow-hidden">
              <motion.div variants={V.fadeUp}>
                <h1 className="font-display font-black text-white leading-[1.0] tracking-tight"
                  style={{ fontSize: "clamp(2.8rem, 9vw, 7rem)" }}>
                  Your Car.<br />
                  <span className="text-secondary">Cleaned</span>
                </h1>
              </motion.div>
            </div>
            <div className="overflow-hidden">
              <motion.div variants={V.fadeUp}>
                <h1 className="font-display font-black text-white/90 leading-[1.0] tracking-tight"
                  style={{ fontSize: "clamp(2.8rem, 9vw, 7rem)" }}>
                  Where You Are.
                </h1>
              </motion.div>
            </div>
          </motion.div>

          {/* Supporting copy */}
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.72, ease: E }}
            className="text-primary-foreground/60 leading-relaxed mb-9 sm:mb-11 max-w-lg"
            style={{ fontSize: "clamp(0.95rem, 2vw, 1.15rem)" }}>
            Oasis dispatches professional detailers to your home, office, or wherever your vehicle sits.
            Premium care without the commute.
          </motion.p>

          {/* CTAs */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.9, ease: E }}
            className="flex flex-wrap items-center gap-3 mb-12 sm:mb-16">
            <motion.div whileTap={{ scale: 0.97 }}>
              <Link to="/book"
                className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground font-black rounded-xl hover:bg-secondary/90 transition-all shadow-2xl shadow-secondary/30"
                style={{ padding: "clamp(0.75rem,2vw,1rem) clamp(1.5rem,4vw,2.25rem)", fontSize: "clamp(0.9rem,1.8vw,1rem)" }}>
                <Car className="w-4 h-4" /> Book a Wash <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
            <motion.div whileTap={{ scale: 0.97 }}>
              <button onClick={() => go("#services")}
                className="inline-flex items-center gap-2 bg-white/10 text-white border border-white/20 font-semibold rounded-xl hover:bg-white/18 transition-all"
                style={{ padding: "clamp(0.75rem,2vw,1rem) clamp(1.5rem,4vw,2.25rem)", fontSize: "clamp(0.9rem,1.8vw,1rem)" }}>
                Explore Services <ChevronDown className="w-4 h-4" />
              </button>
            </motion.div>
          </motion.div>

          {/* Trust strip */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 1.1, ease: E }}
            className="flex flex-wrap items-center gap-5 sm:gap-8 text-primary-foreground/40"
            style={{ fontSize: "clamp(0.72rem, 1.4vw, 0.8rem)" }}>
            {[
              { icon: <ShieldCheck className="w-3.5 h-3.5 text-secondary" />, t: "Vetted detailers" },
              { icon: <CalendarCheck className="w-3.5 h-3.5 text-secondary" />, t: "Online booking" },
              { icon: <Timer className="w-3.5 h-3.5 text-secondary" />, t: "Mon–Sat 07:00–19:00" },
              { icon: <Navigation className="w-3.5 h-3.5 text-secondary" />, t: "We come to you" },
            ].map(i => (
              <span key={i.t} className="flex items-center gap-1.5 font-semibold">
                {i.icon} {i.t}
              </span>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Scroll nudge */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
        className="absolute bottom-24 lg:bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <ChevronDown className="w-5 h-5 text-primary-foreground/25" />
      </motion.div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TECH TICKER
// ══════════════════════════════════════════════════════════════════════════════
function TechTicker() {
  const items = [
    { icon: <CalendarCheck className="w-4 h-4" />, l: "Online Booking"         },
    { icon: <Smartphone     className="w-4 h-4" />, l: "Customer Portal"        },
    { icon: <ShieldCheck    className="w-4 h-4" />, l: "Job Documentation"      },
    { icon: <Recycle        className="w-4 h-4" />, l: "Eco-Friendly Products"  },
    { icon: <Star           className="w-4 h-4" />, l: "Loyalty Rewards"        },
    { icon: <Layers         className="w-4 h-4" />, l: "Subscription Plans"     },
    { icon: <Users          className="w-4 h-4" />, l: "Fleet Management"       },
    { icon: <BadgeCheck     className="w-4 h-4" />, l: "Vetted Professionals"   },
  ];
  return (
    <div className="py-8 sm:py-10 bg-primary border-y border-white/5 overflow-hidden">
      <motion.div className="flex gap-10 sm:gap-14"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}>
        {[...items, ...items].map((it, i) => (
          <span key={i} className="flex items-center gap-2.5 text-primary-foreground/55 whitespace-nowrap font-semibold text-sm flex-shrink-0">
            <span className="text-secondary">{it.icon}</span>
            {it.l}
            <span className="text-secondary/50 mx-1">·</span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SERVICES
// ══════════════════════════════════════════════════════════════════════════════
const SVC_ICONS: Record<string, React.ReactNode> = {
  "Exterior Wash":    <Recycle      className="w-5 h-5 sm:w-6 sm:h-6" />,
  "Interior Clean":   <Layers       className="w-5 h-5 sm:w-6 sm:h-6" />,
  "Full Detail":      <BadgeCheck   className="w-5 h-5 sm:w-6 sm:h-6" />,
  "Engine Bay Clean": <Zap          className="w-5 h-5 sm:w-6 sm:h-6" />,
  default:            <PackageCheck className="w-5 h-5 sm:w-6 sm:h-6" />,
};
const SVC_COLORS = [
  "from-sky-500/15 to-sky-600/5",
  "from-emerald-500/15 to-emerald-600/5",
  "from-secondary/20 to-secondary/5",
  "from-violet-500/15 to-violet-600/5",
];

const DEFAULT_SERVICES: ServiceRow[] = [
  { id:1, name:"Exterior Wash",    description:"Hand wash, rinse, dry. Spotless finish on every panel.",              price_small:80,  price_large:100, price_xl:130, price_truck:250, is_addon:false, is_active:true, sort_order:1 },
  { id:2, name:"Interior Clean",   description:"Full vacuum, wipe-down, window clean and odour treatment.",           price_small:60,  price_large:80,  price_xl:100, price_truck:180, is_addon:false, is_active:true, sort_order:2 },
  { id:3, name:"Full Detail",      description:"Our flagship service. Complete interior and exterior transformation.", price_small:150, price_large:180, price_xl:250, price_truck:450, is_addon:false, is_active:true, sort_order:3 },
  { id:4, name:"Engine Bay Clean", description:"Professional degrease and rinse. Keep your engine as clean as your car.",price_small:80, price_large:100, price_xl:150, price_truck:250, is_addon:true, is_active:true, sort_order:4 },
];

function ServiceCard({ svc, idx }: { svc: ServiceRow; idx: number }) {
  const icon = SVC_ICONS[svc.name] ?? SVC_ICONS.default;
  const grad = SVC_COLORS[idx % SVC_COLORS.length];
  return (
    <motion.article variants={V.fadeUp} initial="hidden" whileInView="visible" viewport={VP}
      transition={{ delay: idx * 0.09 } as any}
      whileHover={{ y: -5, transition: { duration: 0.22, ease: E } }}
      className="bg-card rounded-2xl border border-border flex flex-col overflow-hidden group h-full">
      <div className={`bg-gradient-to-br ${grad} p-5 sm:p-6 flex items-start justify-between`}>
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${grad.replace("/15","/35")} border border-white/15 flex items-center justify-center text-secondary group-hover:scale-110 transition-transform duration-200`}>
          {icon}
        </div>
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          {svc.is_addon ? "Add-on" : "Service"}
        </span>
      </div>
      <div className="flex flex-col flex-1 p-5 sm:p-6">
        <h3 className="font-bold text-foreground text-lg leading-tight mb-2">{svc.name}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed mb-4 flex-1">{svc.description}</p>
        <div className="grid grid-cols-4 gap-1.5 mb-4">
          {(["Small","Large","XL","Truck"] as const).map((l, li) => {
            const price = [svc.price_small, svc.price_large, svc.price_xl, svc.price_truck][li];
            return (
              <div key={l} className="bg-muted/60 rounded-lg py-2 text-center">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">{l}</p>
                <p className="text-xs font-black text-foreground mt-0.5">N${price}</p>
              </div>
            );
          })}
        </div>
        <Link to="/book"
          className="block text-center bg-secondary/10 hover:bg-secondary/20 text-secondary font-bold rounded-xl py-2.5 text-sm transition-colors">
          Book This Service
        </Link>
      </div>
    </motion.article>
  );
}

function ServicesSection({ services }: { services: ServiceRow[] }) {
  const main   = services.filter(s => !s.is_addon && s.is_active);
  const addons = services.filter(s =>  s.is_addon && s.is_active);
  const displayMain   = main.length   > 0 ? main   : DEFAULT_SERVICES.filter(s => !s.is_addon);
  const displayAddons = addons.length > 0 ? addons : DEFAULT_SERVICES.filter(s =>  s.is_addon);

  return (
    <section id="services" className="py-16 sm:py-28 bg-background relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <SectionHeading badge="What We Do" title="Services for Every Vehicle"
          sub="Professional-grade mobile detailing for all vehicle sizes, from a quick exterior wash to a complete full detail." />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-8">
          {displayMain.map((svc, i) => <ServiceCard key={svc.id} svc={svc} idx={i} />)}
        </div>
        {displayAddons.length > 0 && (
          <Reveal>
            <div className="bg-muted/40 rounded-2xl border border-border p-4 sm:p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 sm:mb-4">
                Add-on Services
              </p>
              <div className="flex flex-wrap gap-3">
                {displayAddons.map(a => (
                  <div key={a.id} className="bg-card rounded-xl border border-border p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-3.5 h-3.5 text-secondary flex-shrink-0" />
                      <span className="font-semibold text-sm">{a.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{a.description}</p>
                    <div className="grid grid-cols-4 gap-1">
                      {(["S","L","XL","T"] as const).map((l, li) => {
                        const p = [a.price_small, a.price_large, a.price_xl, a.price_truck][li];
                        return (
                          <div key={l} className="text-center">
                            <p className="text-[8px] text-muted-foreground font-bold uppercase">{l}</p>
                            <p className="text-xs font-black">N${p}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HOW IT WORKS
// ══════════════════════════════════════════════════════════════════════════════
function HowItWorks() {
  const steps = [
    { n:"01", icon:<Smartphone className="w-6 h-6 sm:w-7 sm:h-7" />, title:"Book Online",     body:"Choose service, date, time and location. Takes under two minutes." },
    { n:"02", icon:<Truck      className="w-6 h-6 sm:w-7 sm:h-7" />, title:"We Come to You",  body:"Your detailer arrives fully equipped. No travel, no waiting, no queue." },
    { n:"03", icon:<BadgeCheck className="w-6 h-6 sm:w-7 sm:h-7" />, title:"Drive Away Clean", body:"Professional care with before-and-after documentation on every job." },
  ];
  return (
    <section id="how-it-works" className="py-16 sm:py-28 bg-muted/30 relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <SectionHeading badge="Simple Process" title="Three Steps to Spotless"
          sub="No queues, no wasted time. We handle everything so you can focus on your day." />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 lg:gap-14 relative">
          <div className="hidden sm:block absolute top-11 left-[22%] right-[22%] h-px bg-gradient-to-r from-secondary/30 via-secondary/60 to-secondary/30" />
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.14}>
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-5 sm:mb-6">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl bg-secondary text-secondary-foreground flex items-center justify-center shadow-xl shadow-secondary/25">
                    {s.icon}
                  </div>
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary text-primary-foreground font-black text-xs border-2 border-card flex items-center justify-center z-10">
                    {i + 1}
                  </span>
                </div>
                <p className="text-secondary font-black text-xs tracking-widest mb-2">{s.n}</p>
                <h3 className="font-bold text-foreground text-lg sm:text-xl mb-2 leading-tight">{s.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.45}>
          <div className="text-center mt-12 sm:mt-16">
            <BookBtn to="/book" label="Book Your First Wash" variant="dark" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LOYALTY
// ══════════════════════════════════════════════════════════════════════════════
function LoyaltySection() {
  const tiers = [
    { n:"Bronze",   pts:"0+",    e:"🥉", d:"Starter",       g:"from-amber-700/20 to-amber-800/5" },
    { n:"Silver",   pts:"500+",  e:"🥈", d:"Double points", g:"from-slate-400/20 to-slate-500/5" },
    { n:"Gold",     pts:"1500+", e:"🥇", d:"Priority",      g:"from-yellow-500/20 to-yellow-600/5" },
    { n:"Platinum", pts:"3000+", e:"💎", d:"VIP",           g:"from-violet-500/20 to-violet-600/5" },
  ];
  return (
    <section id="loyalty" className="py-16 sm:py-28 bg-primary relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.035] pointer-events-none">
        <svg width="100%" height="100%"><defs>
          <pattern id="st2" x="0" y="0" width="72" height="72" patternUnits="userSpaceOnUse">
            <polygon points="36,6 44,26 64,26 48,40 54,60 36,48 18,60 24,40 8,26 28,26" fill="white"/>
          </pattern></defs>
          <rect width="100%" height="100%" fill="url(#st2)"/>
        </svg>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        <SectionHeading light badge="Loyalty Rewards" title={<>Earn Points.<br />Get Free Washes.</>}
          sub="Every completed booking earns 10 loyalty points. 100 points unlocks a free standard wash." />

        <div className="grid grid-cols-3 gap-3 sm:gap-6 lg:gap-10 mb-8 relative">
          <div className="hidden sm:block absolute top-9 left-[18%] right-[18%] h-px bg-white/15" />
          {[
            { s:"1", icon:<Car   className="w-5 h-5 sm:w-7 sm:h-7" />, t:"Book a Wash",    b:"Every completed wash earns you 10 loyalty points automatically." },
            { s:"2", icon:<Star  className="w-5 h-5 sm:w-7 sm:h-7" />, t:"Collect Points",  b:"Reach 100 redeemable points. Refer a friend for bonus points." },
            { s:"3", icon:<Crown className="w-5 h-5 sm:w-7 sm:h-7" />, t:"Redeem Free Wash",b:"Spend 100 points for a completely free standard car wash." },
          ].map((st, i) => (
            <Reveal key={st.s} delay={i * 0.12}>
              <div className="text-center">
                <div className="mx-auto mb-3 sm:mb-4 rounded-xl sm:rounded-2xl bg-white/10 border border-white/15 text-white flex items-center justify-center relative"
                  style={{ width:"clamp(2.5rem,7vw,4rem)", height:"clamp(2.5rem,7vw,4rem)" }}>
                  {st.icon}
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-secondary text-secondary-foreground font-black text-[10px] flex items-center justify-center border-2 border-primary">{st.s}</span>
                </div>
                <h3 className="font-bold text-white mb-1 leading-tight" style={{ fontSize:"clamp(0.75rem,1.8vw,1rem)" }}>{st.t}</h3>
                <p className="text-primary-foreground/55 leading-relaxed hidden sm:block" style={{ fontSize:"clamp(0.68rem,1.3vw,0.82rem)" }}>{st.b}</p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Mobile step descriptions */}
        <div className="sm:hidden mb-8 space-y-2">
          {[
            { s:"1", t:"Book a Wash",    b:"Every completed wash earns 10 loyalty points." },
            { s:"2", t:"Collect Points",  b:"Reach 100 redeemable points to unlock a free wash." },
            { s:"3", t:"Redeem Free Wash",b:"Spend 100 points for a completely free standard wash." },
          ].map((st, i) => (
            <div key={i} className="flex gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
              <span className="w-5 h-5 rounded-full bg-secondary text-secondary-foreground font-black text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">{st.s}</span>
              <div><p className="font-bold text-white text-sm">{st.t}</p><p className="text-primary-foreground/50 text-xs mt-0.5 leading-relaxed">{st.b}</p></div>
            </div>
          ))}
        </div>

        <Reveal delay={0.15}>
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 sm:mb-8">
            {[{v:"+10 pts",l:"per completed wash"},{v:"100 pts",l:"= 1 free wash"},{v:"+Bonus",l:"for referrals"}].map(s => (
              <div key={s.l} className="bg-white/5 border border-white/10 rounded-xl text-center" style={{ padding:"clamp(0.6rem,2vw,1rem)" }}>
                <p className="font-black text-secondary" style={{ fontSize:"clamp(0.9rem,2.5vw,1.4rem)" }}>{s.v}</p>
                <p className="text-primary-foreground/45 text-xs mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.22}>
          <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-10">
            {tiers.map(t => (
              <div key={t.n} className={`bg-gradient-to-br ${t.g} border border-white/10 rounded-xl text-center`}
                style={{ padding:"clamp(0.5rem,2vw,1.1rem)" }}>
                <span style={{ fontSize:"clamp(1rem,4vw,1.75rem)" }}>{t.e}</span>
                <p className="font-black text-white leading-tight mt-0.5" style={{ fontSize:"clamp(0.65rem,1.8vw,0.9rem)" }}>{t.n}</p>
                <p className="text-secondary font-bold" style={{ fontSize:"clamp(0.58rem,1.3vw,0.72rem)" }}>{t.pts} pts</p>
                <p className="text-white/35 hidden sm:block" style={{ fontSize:"clamp(0.55rem,1vw,0.65rem)" }}>{t.d}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.3}>
          <div className="text-center">
            <BookBtn to="/auth" label="Start Earning Points" variant="primary" />
            <p className="text-primary-foreground/35 text-xs mt-3">Free to join. Points start from your first booking.</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MEMBERSHIP
// ══════════════════════════════════════════════════════════════════════════════
type Plan = { id: string; plan_name: string; description: string; monthly_price: number; allowed_bookings_per_month: number; };
const DEFAULT_PLANS: Plan[] = [
  { id:"1", plan_name:"Basic",     description:"2 standard washes per month",          monthly_price:250, allowed_bookings_per_month:2  },
  { id:"2", plan_name:"Standard",  description:"4 standard washes per month",          monthly_price:450, allowed_bookings_per_month:4  },
  { id:"3", plan_name:"Premium",   description:"4 washes + 1 full interior detail",    monthly_price:650, allowed_bookings_per_month:4  },
  { id:"4", plan_name:"Corporate", description:"Fleet pricing — contact us for a quote",monthly_price:0,   allowed_bookings_per_month:99 },
];

function PlanCard({ plan, popular }: { plan: Plan; popular: boolean }) {
  const custom = plan.monthly_price === 0;
  return (
    <motion.article variants={V.fadeUp} initial="hidden" whileInView="visible" viewport={VP}
      whileHover={{ y: -5, transition: { duration: 0.22, ease: E } }}
      className={`relative rounded-2xl border flex flex-col h-full ${popular ? "bg-secondary border-secondary shadow-2xl shadow-secondary/30" : "bg-card border-border"}`}
      style={{ padding:"clamp(1rem,2.5vw,1.75rem)" }}>
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground font-black px-3 py-1 rounded-full text-xs flex items-center gap-1 whitespace-nowrap shadow-lg">
          <Crown className="w-3 h-3" /> Most Popular
        </div>
      )}
      <div className="flex items-center gap-2 mb-2">
        <Wallet className={`w-4 h-4 ${popular ? "text-secondary-foreground/80" : "text-secondary"}`} />
        <h3 className={`font-black text-lg ${popular ? "text-secondary-foreground" : "text-foreground"}`}>{plan.plan_name}</h3>
      </div>
      <p className={`text-sm mb-4 leading-relaxed ${popular ? "text-secondary-foreground/70" : "text-muted-foreground"}`}>{plan.description}</p>
      <div className="flex items-baseline gap-1 mb-5">
        {custom
          ? <span className={`font-black text-2xl ${popular ? "text-secondary-foreground" : "text-foreground"}`}>Custom</span>
          : <><span className={`font-black ${popular ? "text-secondary-foreground" : "text-foreground"}`} style={{ fontSize:"clamp(1.6rem,4vw,2.2rem)" }}>N${plan.monthly_price}</span>
              <span className={`text-xs font-medium ${popular ? "text-secondary-foreground/60" : "text-muted-foreground"}`}>/mo</span></>
        }
      </div>
      <div className="flex-1 space-y-2 mb-5">
        {[
          plan.allowed_bookings_per_month < 50 ? `${plan.allowed_bookings_per_month} washes per month` : "Unlimited washes",
          "Loyalty points on every wash",
          custom ? "Custom fleet scheduling" : "Priority booking slots",
        ].map((f, j) => (
          <div key={j} className="flex items-center gap-2 text-sm">
            <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${popular ? "text-secondary-foreground" : "text-secondary"}`} />
            <span className={popular ? "text-secondary-foreground/80" : "text-foreground/80"}>{f}</span>
          </div>
        ))}
      </div>
      <Link to={custom ? "#fleet" : "/dashboard"}
        className={`block text-center font-bold rounded-xl py-2.5 text-sm transition-colors ${
          popular ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-secondary/10 text-secondary hover:bg-secondary/20"}`}>
        {custom ? "Contact Us" : "Get Started"}
      </Link>
    </motion.article>
  );
}

function MembershipSection({ plans }: { plans: Plan[] }) {
  const display = plans.length > 0 ? plans : DEFAULT_PLANS;
  const pi = display.findIndex(p => p.plan_name === "Standard");
  return (
    <section id="membership" className="py-16 sm:py-28 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <SectionHeading badge="Subscription Plans" title="Unlimited Clean Rides"
          sub="Subscribe and save. The more you wash, the better the value. Cancel anytime." />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {display.map((plan, i) => <PlanCard key={plan.id} plan={plan} popular={i === (pi >= 0 ? pi : 1)} />)}
        </div>
        <Reveal delay={0.3}>
          <p className="text-center text-muted-foreground text-sm mt-6">
            All plans include loyalty points. Cancel anytime.{" "}
            <Link to="/auth" className="text-secondary font-semibold hover:underline">Create a free account</Link>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FLEET / CORPORATE
// ══════════════════════════════════════════════════════════════════════════════
function FleetSection() {
  return (
    <section id="fleet" className="py-16 sm:py-28 bg-primary relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage:"linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)", backgroundSize:"40px 40px" }} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div>
            <SectionBadge label="Fleet and Corporate" light />
            <Reveal v="fadeUp" delay={0.08}>
              <h2 className="font-display font-black text-white leading-tight mb-4"
                style={{ fontSize:"clamp(1.75rem,4.5vw,3.25rem)" }}>
                Keep Your Fleet Moving.<br />
                <span className="text-secondary">We Handle the Cleaning.</span>
              </h2>
            </Reveal>
            <Reveal v="fadeUp" delay={0.16}>
              <p className="text-primary-foreground/55 leading-relaxed mb-8"
                style={{ fontSize:"clamp(0.9rem,1.8vw,1.05rem)" }}>
                Whether you manage five vehicles or five hundred, Oasis delivers scheduled, professional cleaning
                at your premises. Custom pricing, centralised billing, and documented service records for every job.
              </p>
            </Reveal>
            <Reveal delay={0.22}>
              <BookBtn to="/book" label="Request Fleet Quote" variant="primary" />
            </Reveal>
          </div>
          <motion.div variants={V.stagger} initial="hidden" whileInView="visible" viewport={VP}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon:<Truck      className="w-5 h-5" />, t:"Fleet vehicles",       d:"Any size fleet — 2 to 200+ vehicles." },
              { icon:<Building2  className="w-5 h-5" />, t:"Corporate accounts",   d:"Centralised billing and management." },
              { icon:<CalendarCheck className="w-5 h-5" />, t:"Scheduled servicing",d:"Set a schedule. We handle the rest." },
              { icon:<BadgeCheck className="w-5 h-5" />, t:"Job documentation",    d:"Before/after photos on every vehicle." },
            ].map((f, i) => (
              <motion.div key={i} variants={V.fadeUp}
                className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-secondary/20 text-secondary flex items-center justify-center mb-3">{f.icon}</div>
                <h4 className="font-bold text-white text-sm mb-1">{f.t}</h4>
                <p className="text-primary-foreground/45 text-xs leading-relaxed">{f.d}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// REVIEWS
// ══════════════════════════════════════════════════════════════════════════════
function ReviewCard({ rev }: { rev: any }) {
  return (
    <div className="flex-shrink-0 bg-card border border-border rounded-2xl p-5 flex flex-col" style={{ width:"min(320px,85vw)" }}>
      <div className="flex gap-0.5 mb-3">
        {Array.from({length:5}).map((_,i) => (
          <Star key={i} className={`w-3.5 h-3.5 ${i < rev.star_rating ? "fill-secondary text-secondary" : "text-border"}`} />
        ))}
      </div>
      <p className="text-sm text-foreground leading-relaxed flex-1 mb-4 line-clamp-3">
        "{rev.review_comment || "Professional, punctual and left my car spotless."}"
      </p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center font-bold text-secondary text-[10px]">
          {(rev.customer_name || "C").charAt(0).toUpperCase()}
        </div>
        <span className="font-medium">{rev.customer_name || "Verified Customer"}</span>
      </div>
    </div>
  );
}

function ReviewsSection({ reviews }: { reviews: any[] }) {
  if (!reviews.length) return null;
  const doubled = [...reviews, ...reviews];
  return (
    <section className="py-16 sm:py-28 bg-muted/30 overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-10">
        <SectionHeading badge="Client Reviews" title="What Windhoek Is Saying"
          sub="Real reviews from verified Oasis customers." />
      </div>
      <motion.div className="flex gap-4 px-4 sm:px-6"
        animate={{ x:["0%","-50%"] }}
        transition={{ duration:42, repeat:Infinity, ease:"linear" }}>
        {doubled.map((rev, i) => <ReviewCard key={i} rev={rev} />)}
      </motion.div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ABOUT / TRUST
// ══════════════════════════════════════════════════════════════════════════════
function AboutSection() {
  return (
    <section id="about" className="py-16 sm:py-28 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div>
            <SectionBadge label="About Oasis" />
            <Reveal v="fadeUp" delay={0.08}>
              <h2 className="font-display font-black text-foreground leading-tight mb-4"
                style={{ fontSize:"clamp(1.75rem,4.5vw,3rem)" }}>
                A New Standard in<br /><span className="text-secondary">Mobile Vehicle Care</span>
              </h2>
            </Reveal>
            <Reveal v="fadeUp" delay={0.16}>
              <p className="text-muted-foreground leading-relaxed mb-4" style={{ fontSize:"clamp(0.875rem,1.8vw,1rem)" }}>
                Oasis Pure Cleaning CC was founded on a simple conviction: your vehicle deserves exceptional care,
                and you deserve the convenience of having that care come to you.
              </p>
            </Reveal>
            <Reveal v="fadeUp" delay={0.22}>
              <p className="text-muted-foreground leading-relaxed mb-8" style={{ fontSize:"clamp(0.875rem,1.8vw,1rem)" }}>
                We operate across Windhoek, dispatching trained, insured detailers with professional equipment
                directly to your home, office, or any other location.
              </p>
            </Reveal>
            <motion.div variants={V.stagger} initial="hidden" whileInView="visible" viewport={VP} className="space-y-2.5">
              {[
                { icon:<ShieldCheck  className="w-4 h-4" />, t:"Vetted professionals",    d:"Trained and background-checked detailers on every job." },
                { icon:<Recycle      className="w-4 h-4" />, t:"Eco-conscious",           d:"Biodegradable, water-efficient products throughout." },
                { icon:<Timer        className="w-4 h-4" />, t:"On time, every time",     d:"Real-time booking updates from confirmation to completion." },
                { icon:<Star         className="w-4 h-4" />, t:"Documented results",      d:"Before-and-after photography on every service." },
              ].map((val, i) => (
                <motion.div key={i} variants={V.fadeUp}
                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/60 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center flex-shrink-0 mt-0.5">{val.icon}</div>
                  <div>
                    <p className="font-bold text-foreground text-sm">{val.t}</p>
                    <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">{val.d}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
          <Reveal v="slideR" delay={0.2}>
            <div className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl overflow-hidden shadow-2xl relative">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage:"radial-gradient(circle at 30% 40%,#FF8C00,transparent 60%)" }} />
              <div className="relative z-10 p-8 sm:p-10">
                <img src={logoBrand} alt="Oasis" className="w-auto mb-8" style={{ height:"clamp(3rem,8vw,5rem)" }} />
                <div className="grid grid-cols-3 gap-4 sm:gap-6 mb-8">
                  {[{v:"2020",label:"Founded"},{v:"2,500+",label:"Vehicles Washed"},{v:"800+",label:"Happy Clients"}].map(s => (
                    <div key={s.label} className="text-center">
                      <p className="font-black text-white" style={{ fontSize:"clamp(1rem,3.5vw,2rem)" }}>{s.v}</p>
                      <p className="text-white/40 text-xs uppercase tracking-wider mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                  <p className="text-secondary font-bold text-xs uppercase tracking-widest mb-1">Our Mission</p>
                  <p className="text-white/65 text-sm leading-relaxed">
                    To deliver premium mobile car care that respects your time, protects your investment, and leaves every vehicle spotless.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CONTACT
// ══════════════════════════════════════════════════════════════════════════════
function ContactSection() {
  return (
    <section id="contact" className="py-16 sm:py-28 bg-muted/30 relative">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <SectionHeading badge="Get in Touch" title="Ready When You Are"
          sub="Book online or reach out through any channel below. We are available Monday to Saturday." />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
          <Reveal>
            <div className="bg-card rounded-2xl border border-border p-6 h-full">
              <h3 className="font-bold text-foreground text-lg mb-5">Contact Details</h3>
              <div className="space-y-4">
                {[
                  { icon:<Phone         className="w-4 h-4" />, l:"Phone",    v:"+264 81 278 1123",              href:"tel:+264812781123" },
                  { icon:<MessageCircle className="w-4 h-4" />, l:"WhatsApp", v:"Chat with us",                 href:"https://wa.me/264812781123" },
                  { icon:<Mail          className="w-4 h-4" />, l:"Email",    v:"info@oasispurecleaning.com",    href:"mailto:info@oasispurecleaning.com" },
                  { icon:<MapPin        className="w-4 h-4" />, l:"Location", v:"Windhoek, Namibia",             href:null },
                  { icon:<Clock         className="w-4 h-4" />, l:"Hours",    v:"Mon to Sat: 07:00 to 19:00",    href:null },
                ].map(c => (
                  <div key={c.l} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center flex-shrink-0">{c.icon}</div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{c.l}</p>
                      {c.href
                        ? <a href={c.href} target={c.href.startsWith("http")?"_blank":undefined} rel="noreferrer"
                            className="text-sm font-semibold hover:text-secondary transition-colors">{c.v}</a>
                        : <p className="text-sm font-semibold">{c.v}</p>
                      }
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-6">
                <a href="tel:+264812781123"
                  className="flex items-center justify-center gap-1.5 bg-secondary text-secondary-foreground py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity">
                  <Phone className="w-3.5 h-3.5" /> Call
                </a>
                <a href="https://wa.me/264812781123" target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 bg-green-600 text-white py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity">
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </a>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.12}>
            <div className="bg-card rounded-2xl border border-border p-6 h-full flex flex-col">
              <h3 className="font-bold text-foreground text-lg mb-3 flex items-center gap-2">
                <Lock className="w-5 h-5 text-secondary" /> EFT Payment Details
              </h3>
              <div className="flex-1 bg-muted/40 rounded-xl border border-dashed border-border flex flex-col items-center justify-center text-center p-8 mb-4">
                <Lock className="w-10 h-10 text-muted-foreground/25 mb-3" />
                <p className="font-bold text-sm mb-1">Banking details are private</p>
                <p className="text-muted-foreground text-xs leading-relaxed">Sign in to view EFT banking details for payment.</p>
              </div>
              <div className="bg-secondary/5 border border-secondary/15 rounded-xl p-3 mb-4">
                <p className="text-muted-foreground text-xs leading-relaxed">
                  <strong className="text-foreground">After payment:</strong> Upload proof in your booking confirmation. Admin will verify and confirm.
                </p>
              </div>
              <Link to="/auth" className="block text-center bg-primary text-primary-foreground py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity">
                Sign In to View Banking Details
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CTA BAND
// ══════════════════════════════════════════════════════════════════════════════
function CTABand() {
  return (
    <section className="py-16 sm:py-20 bg-secondary relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{ backgroundImage:"radial-gradient(circle at 20% 50%,white,transparent 55%),radial-gradient(circle at 80% 50%,white,transparent 55%)" }} />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center relative z-10">
        <Reveal>
          <h2 className="font-display font-black text-secondary-foreground leading-tight mb-4"
            style={{ fontSize:"clamp(1.75rem,5vw,3.25rem)" }}>
            Your car deserves better.<br />Book today.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="text-secondary-foreground/75 mb-8" style={{ fontSize:"clamp(0.9rem,2vw,1.05rem)" }}>
            Spots fill fast, especially on weekends. Reserve your slot now.
          </p>
        </Reveal>
        <Reveal delay={0.2}>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <BookBtn to="/book" label="Book a Wash Now" variant="dark" />
            <motion.div whileTap={{ scale: 0.97 }}>
              <Link to="/auth"
                className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/22 border border-white/20 text-secondary-foreground font-bold rounded-xl transition-all"
                style={{ padding:"clamp(0.7rem,1.8vw,0.9rem) clamp(1.4rem,3.5vw,2rem)", fontSize:"clamp(0.875rem,1.8vw,1rem)" }}>
                Create Free Account
              </Link>
            </motion.div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FOOTER
// ══════════════════════════════════════════════════════════════════════════════
function Footer() {
  const cols: Record<string, { label: string; href: string }[]> = {
    Services: [
      { label:"Exterior Wash", href:"/book" },
      { label:"Interior Clean",href:"/book" },
      { label:"Full Detail",   href:"/book" },
      { label:"Engine Bay",    href:"/book" },
    ],
    Company: [
      { label:"Book a Wash",   href:"/book"      },
      { label:"Customer Portal",href:"/auth"     },
      { label:"Subscriptions", href:"/dashboard" },
      { label:"Fleet Services",href:"/book"      },
    ],
    Account: [
      { label:"Sign In",         href:"/auth"      },
      { label:"Create Account",  href:"/auth"      },
      { label:"My Dashboard",    href:"/dashboard" },
      { label:"Loyalty Rewards", href:"/dashboard" },
    ],
  };
  return (
    <footer className="bg-primary text-primary-foreground pb-20 lg:pb-0" role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 mb-10">
          <div className="col-span-2 sm:col-span-1">
            <img src={logoBrand} alt="Oasis Pure Cleaning CC" className="w-auto mb-4 object-contain" style={{ height:"clamp(2rem,5vw,2.75rem)" }} />
            <p className="text-primary-foreground/50 text-sm leading-relaxed mb-4">
              Premium mobile car wash and detailing in Windhoek, Namibia. We come to you.
            </p>
            <div className="flex gap-2">
              <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram"
                className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                <Instagram className="w-3.5 h-3.5" />
              </a>
              <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook"
                className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                <Facebook className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
          {Object.entries(cols).map(([group, items]) => (
            <div key={group}>
              <h4 className="font-bold uppercase tracking-widest text-primary-foreground/35 text-[9px] mb-3">{group}</h4>
              <ul className="space-y-2">
                {items.map(item => (
                  <li key={item.label}>
                    <Link to={item.href} className="text-primary-foreground/55 hover:text-secondary text-sm transition-colors">{item.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-primary-foreground/30 text-xs">
          <p>© {new Date().getFullYear()} Oasis Pure Cleaning CC. All rights reserved.</p>
          <div className="flex items-center gap-3">
            <span>Windhoek, Namibia</span>
            <span>·</span>
            <Link to="/book" className="hover:text-secondary transition-colors">Book a Wash</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE ORCHESTRATOR
// ══════════════════════════════════════════════════════════════════════════════
export default function LandingPage() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [plans,    setPlans]    = useState<Plan[]>([]);
  const [reviews,  setReviews]  = useState<any[]>([]);
  const [userLink, setUserLink] = useState("/auth");

  useEffect(() => {
    // Services
    getAllServices()
      .then(s => setServices(s.filter(x => x.is_active)))
      .catch(() => {});

    // Plans
    fetchSubscriptionPlans()
      .then(p => setPlans(p as Plan[]))
      .catch(() => {});

    // Reviews (published only)
    supabase
      .from("reviews")
      .select("star_rating,review_comment,customer_name,created_at")
      .eq("review_status", "published")
      .order("created_at", { ascending: false })
      .limit(12)
      .then(({ data }) => { if (data) setReviews(data); })
      .catch(() => {});

    // User session → nav link
    getSessionUser()
      .then(async u => {
        if (!u) return;
        const p = await getUserProfile(u.id).catch(() => null);
        if      (p?.role === "super_admin") setUserLink("/platform");
        else if (p?.role === "admin")       setUserLink("/admin/dashboard");
        else if (p?.role === "employee")    setUserLink("/employee");
        else                                setUserLink("/dashboard");
      })
      .catch(() => {});
  }, []);

  return (
    <>
      {/* SEO — document level */}
      <title>Oasis Pure Cleaning CC — Mobile Car Wash Windhoek, Namibia</title>

      <Navbar userLink={userLink} />

      <main id="main-content">
        <Hero />
        <TechTicker />
        <ServicesSection services={services} />
        <HowItWorks />
        <BeforeAfter />
        <LoyaltySection />
        <MembershipSection plans={plans} />
        <FleetSection />
        <Technology />
        {reviews.length > 0 && <ReviewsSection reviews={reviews} />}
        <AboutSection />
        <ContactSection />
        <CTABand />
      </main>

      <Footer />

      {/* Reduced-motion + global utility */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
        html { scroll-behavior: smooth; }
      `}</style>
    </>
  );
}
