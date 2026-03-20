/**
 * LandingPage.tsx
 *
 * Full public-facing marketing website for Oasis Pure Cleaning CC.
 * Features: animated hero, services, how-it-works, about, reviews,
 * pricing, contact/banking, Winny chatbot, admin-editable content.
 */

import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  MapPin, Phone, Mail, MessageCircle, ChevronDown, Star,
  Check, ArrowRight, Sparkles, Droplets, Car, Shield,
  Clock, Users, Award, Instagram, Facebook, Menu, X,
  Zap, Crown, Leaf, ChevronRight, Quote,
} from "lucide-react";
import { getAllWebsiteContent } from "@/lib/websiteService";
import { getAllServices } from "@/lib/bookingService";
import { supabase } from "@/lib/supabase";
import WinnyChatbot from "@/components/WinnyChatbot";
import logoBrand from "@/assets/logo-brand.png";
import { getSessionUser, getUserProfile } from "@/lib/authService";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SiteContent {
  hero:          Record<string, any>;
  about:         Record<string, any>;
  contact:       Record<string, any>;
  how_it_works:  Record<string, any>;
  gallery:       Record<string, any>;
}

interface ServiceRow {
  id: number; name: string; description: string;
  price_small: number; price_large: number; price_xl: number;
  price_truck: number; is_addon: boolean; is_active: boolean;
}

interface Plan { plan_name: string; monthly_price: number; allowed_bookings_per_month: number; description: string; }
interface Review { star_rating: number; review_comment: string | null; created_at: string; }

// ─── Animated water drop particles ───────────────────────────────────────────
const NUM_DROPS = 18;
const drops = Array.from({ length: NUM_DROPS }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  size: 6 + Math.random() * 14,
  delay: Math.random() * 5,
  dur: 3 + Math.random() * 4,
  opacity: 0.08 + Math.random() * 0.18,
}));

function WaterDrops() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {drops.map(d => (
        <motion.div
          key={d.id}
          className="absolute rounded-full"
          style={{
            left: `${d.x}%`,
            width: d.size,
            height: d.size * 1.3,
            background: `radial-gradient(ellipse at 35% 35%, rgba(255,255,255,0.9), rgba(96,200,250,0.4))`,
            opacity: d.opacity,
            top: "-5%",
          }}
          animate={{ y: ["0vh", "110vh"] }}
          transition={{ duration: d.dur, delay: d.delay, repeat: Infinity, ease: "linear" }}
        />
      ))}
    </div>
  );
}

// ─── Scroll-reveal wrapper ────────────────────────────────────────────────────
function FadeUp({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionHeading({ badge, title, subtitle }: { badge?: string; title: string; subtitle?: string }) {
  return (
    <div className="text-center mb-14">
      {badge && (
        <FadeUp>
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-secondary bg-secondary/10 px-4 py-1.5 rounded-full mb-4">
            <Sparkles className="w-3 h-3" /> {badge}
          </span>
        </FadeUp>
      )}
      <FadeUp delay={0.08}>
        <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-foreground leading-tight mb-4">
          {title}
        </h2>
      </FadeUp>
      {subtitle && (
        <FadeUp delay={0.16}>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">{subtitle}</p>
        </FadeUp>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LandingPage() {
  const navigate  = useNavigate();
  const [content, setContent]   = useState<SiteContent | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [plans,    setPlans]    = useState<Plan[]>([]);
  const [reviews,  setReviews]  = useState<Review[]>([]);
  const [navOpen,  setNavOpen]  = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [userLink, setUserLink] = useState("/auth");   // will be /dashboard if logged in

  const heroRef   = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll();
  const heroOpacity  = useTransform(scrollYProgress, [0, 0.25], [1, 0]);
  const heroY        = useTransform(scrollYProgress, [0, 0.25], ["0%", "15%"]);

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      getAllWebsiteContent(),
      import("@/lib/bookingService").then(m => m.getAllServices()),
      supabase.from("subscription_plans").select("plan_name,monthly_price,allowed_bookings_per_month,description").eq("status", "active").order("sort_order"),
      supabase.from("reviews").select("star_rating,review_comment,created_at").eq("review_status", "published").order("created_at", { ascending: false }).limit(6),
    ]).then(([wc, svcs, plansRes, revRes]) => {
      setContent(wc as SiteContent);
      setServices((svcs as any[]).filter((s: any) => s.is_active));
      setPlans((plansRes.data ?? []) as Plan[]);
      setReviews((revRes.data ?? []) as Review[]);
    }).catch(() => {});

    // Check if user is already logged in
    getSessionUser().then(async (user) => {
      if (user) {
        const profile = await getUserProfile(user.id).catch(() => null);
        if (profile?.role === "admin" || profile?.role === "super_admin") {
          setUserLink("/admin/dashboard");
        } else if (profile?.role === "employee") {
          setUserLink("/employee");
        } else {
          setUserLink("/dashboard");
        }
      }
    }).catch(() => {});
  }, []);

  // ── Scroll shadow ──────────────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const hero     = content?.hero         ?? {};
  const about    = content?.about        ?? {};
  const contact  = content?.contact      ?? {};
  const howItWorks = content?.how_it_works ?? {};

  const mainServices = services.filter(s => !s.is_addon);
  const addons       = services.filter(s => s.is_addon);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ══ NAVBAR ═══════════════════════════════════════════════════════════ */}
      <motion.nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-primary/95 backdrop-blur-md shadow-2xl" : "bg-transparent"
        }`}
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0">
            <img src={logoBrand} alt="Oasis Pure Cleaning CC" className="h-9 w-auto object-contain" />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {[
              { label: "Services", href: "#services" },
              { label: "How It Works", href: "#how-it-works" },
              { label: "About", href: "#about" },
              { label: "Pricing", href: "#pricing" },
              { label: "Contact", href: "#contact" },
            ].map(item => (
              <a
                key={item.label}
                href={item.href}
                onClick={e => {
                  e.preventDefault();
                  document.querySelector(item.href)?.scrollIntoView({ behavior: "smooth" });
                }}
                className="text-sm font-semibold text-primary-foreground/80 hover:text-primary-foreground transition"
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link to={userLink}
              className="text-sm font-semibold text-primary-foreground/80 hover:text-primary-foreground transition px-3 py-2">
              {userLink === "/auth" ? "Sign In" : "Dashboard"}
            </Link>
            <Link to="/book"
              className="flex items-center gap-2 bg-secondary text-secondary-foreground px-5 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition shadow-lg">
              <Car className="w-4 h-4" /> Book Now
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setNavOpen(o => !o)}
            className="md:hidden text-primary-foreground p-2"
          >
            {navOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {navOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden bg-primary border-t border-white/10 overflow-hidden"
            >
              <div className="px-4 py-5 space-y-2">
                {[
                  { label: "Services", href: "#services" },
                  { label: "How It Works", href: "#how-it-works" },
                  { label: "About", href: "#about" },
                  { label: "Pricing", href: "#pricing" },
                  { label: "Contact", href: "#contact" },
                ].map(item => (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={e => {
                      e.preventDefault();
                      setNavOpen(false);
                      document.querySelector(item.href)?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="block py-2.5 px-4 rounded-xl text-primary-foreground/80 hover:bg-white/10 font-semibold transition"
                  >
                    {item.label}
                  </a>
                ))}
                <div className="pt-3 flex flex-col gap-2">
                  <Link to={userLink} className="block py-2.5 px-4 text-center rounded-xl border border-white/20 text-primary-foreground font-semibold">
                    {userLink === "/auth" ? "Sign In" : "My Dashboard"}
                  </Link>
                  <Link to="/book" className="block py-3 px-4 text-center rounded-xl bg-secondary text-secondary-foreground font-bold">
                    Book Now
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ══ HERO ═════════════════════════════════════════════════════════════ */}
      <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden bg-primary">
        {/* Animated water drops */}
        <WaterDrops />

        {/* Radial glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] rounded-full bg-secondary/20 blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[400px] rounded-full bg-blue-500/10 blur-[100px]" />
        </div>

        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px"
        }} />

        <motion.div
          style={{ opacity: heroOpacity, y: heroY }}
          className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-16 text-center"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-primary-foreground/90 text-xs font-bold uppercase tracking-widest px-5 py-2 rounded-full mb-8"
          >
            <MapPin className="w-3.5 h-3.5 text-secondary" />
            {hero.badge || "Serving Windhoek, Namibia"}
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }}
            className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-white leading-none tracking-tight mb-6"
          >
            {(hero.headline || "WE COME.\nYOU SHINE.").split("\n").map((line: string, i: number) => (
              <span key={i} className={`block ${i === 1 ? "text-secondary" : ""}`}>{line}</span>
            ))}
          </motion.h1>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.25 }}
            className="text-primary-foreground/75 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed mb-10"
          >
            {hero.subheadline || "Premium mobile car wash & detailing at your doorstep — anywhere in Windhoek."}
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link to="/book"
              className="group flex items-center gap-2.5 bg-secondary text-secondary-foreground px-8 py-4 rounded-2xl text-base font-bold hover:scale-105 transition-transform shadow-2xl"
            >
              <Car className="w-5 h-5" />
              {hero.cta_primary || "Book a Wash"}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <button
              onClick={() => document.querySelector("#services")?.scrollIntoView({ behavior: "smooth" })}
              className="flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground border border-white/20 px-8 py-4 rounded-2xl text-base font-semibold hover:bg-white/5 transition"
            >
              {hero.cta_secondary || "Our Services"}
              <ChevronDown className="w-4 h-4" />
            </button>
          </motion.div>

          {/* Stats strip */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.7 }}
            className="mt-16 grid grid-cols-3 gap-6 max-w-xl mx-auto"
          >
            {[
              { value: about.vehicles_washed || "2,500+", label: "Vehicles Washed" },
              { value: about.happy_customers || "800+",   label: "Happy Clients" },
              { value: about.areas_served    || "15+",    label: "Areas Served" },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-2xl sm:text-3xl font-black text-white">{s.value}</p>
                <p className="text-xs text-primary-foreground/50 font-semibold uppercase tracking-wider mt-1">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <ChevronDown className="w-6 h-6 text-primary-foreground/40" />
        </motion.div>
      </section>

      {/* ══ HOW IT WORKS ═════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-24 bg-muted/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionHeading badge="Simple Process" title="Done in 3 Easy Steps" subtitle="Getting your car professionally detailed has never been easier." />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-16 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-secondary/30 via-secondary to-secondary/30" />

            {(howItWorks.steps || [
              { icon: "map-pin", title: "Book Online",    desc: "Choose your service, pick a date & time slot. Takes under 2 minutes." },
              { icon: "truck",   title: "We Come to You", desc: "Our trained team arrives with all equipment — home, office, anywhere." },
              { icon: "sparkles",title: "You Shine",      desc: "Sit back while we work our magic. Only leave when you're 100% happy." },
            ]).map((step: any, i: number) => {
              const icons: Record<string, React.ReactNode> = {
                "map-pin":  <MapPin className="w-7 h-7" />,
                "truck":    <Car className="w-7 h-7" />,
                "sparkles": <Sparkles className="w-7 h-7" />,
              };
              return (
                <FadeUp key={i} delay={i * 0.15}>
                  <div className="relative text-center">
                    <div className="w-20 h-20 rounded-2xl bg-secondary text-secondary-foreground flex items-center justify-center mx-auto mb-6 shadow-xl shadow-secondary/20 relative z-10">
                      {icons[step.icon] || <Sparkles className="w-7 h-7" />}
                      <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-black flex items-center justify-center border-2 border-card">
                        {i + 1}
                      </span>
                    </div>
                    <h3 className="font-display font-bold text-xl mb-3">{step.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
                  </div>
                </FadeUp>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ SERVICES ═════════════════════════════════════════════════════════ */}
      <section id="services" className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionHeading badge="What We Do" title="Services Tailored for Every Vehicle" subtitle="Professional-grade cleaning with attention to every detail — for all vehicle sizes." />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            {(mainServices.length > 0 ? mainServices : [
              { id: 1, name: "Basic Wash (Interior)", description: "Interior vacuum, wipe-down & window clean", price_small: 60, price_large: 80, price_xl: 100, price_truck: 180 },
              { id: 2, name: "Basic Wash (Exterior)", description: "Exterior hand wash, rinse & dry", price_small: 80, price_large: 100, price_xl: 130, price_truck: 250 },
              { id: 3, name: "Full Detailing",        description: "Interior + exterior full detail & polish", price_small: 150, price_large: 180, price_xl: 250, price_truck: 450 },
            ]).map((svc: any, i: number) => (
              <FadeUp key={svc.id} delay={i * 0.1}>
                <div className="group relative bg-card rounded-2xl overflow-hidden border border-border hover:border-secondary/50 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 flex flex-col">
                  {/* Visual top */}
                  <div className="h-40 bg-gradient-to-br from-primary via-primary/80 to-secondary/40 relative overflow-hidden flex items-center justify-center">
                    <div className="absolute inset-0 opacity-10" style={{
                      backgroundImage: "radial-gradient(circle at 70% 80%, #FF8C00 0%, transparent 60%)"
                    }} />
                    <Droplets className="w-16 h-16 text-white/20 absolute -right-4 -bottom-2" />
                    <div className="relative z-10 text-center px-6">
                      <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-2">
                        <Car className="w-7 h-7 text-secondary" />
                      </div>
                    </div>
                  </div>
                  {/* Content */}
                  <div className="p-6 flex-1 flex flex-col">
                    <h3 className="font-display font-bold text-lg mb-2">{svc.name}</h3>
                    <p className="text-sm text-muted-foreground mb-5 flex-1">{svc.description}</p>
                    {/* Pricing grid */}
                    <div className="grid grid-cols-2 gap-2 mb-5">
                      {[
                        { label: "Small",  val: svc.price_small },
                        { label: "Large",  val: svc.price_large },
                        { label: "XL",     val: svc.price_xl },
                        { label: "Truck",  val: svc.price_truck },
                      ].map(p => (
                        <div key={p.label} className="bg-muted/60 rounded-xl px-3 py-2 text-center">
                          <p className="text-[11px] text-muted-foreground font-medium">{p.label}</p>
                          <p className="text-sm font-bold text-foreground">N$ {p.val}</p>
                        </div>
                      ))}
                    </div>
                    <Link to="/book" className="block text-center bg-secondary/10 hover:bg-secondary/20 text-secondary py-2.5 rounded-xl text-sm font-bold transition">
                      Book This Service
                    </Link>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>

          {/* Add-ons */}
          {addons.length > 0 && (
            <FadeUp>
              <div className="bg-muted/30 rounded-2xl border border-border p-6">
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">Available Add-ons</p>
                <div className="flex flex-wrap gap-3">
                  {addons.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-2 bg-card px-4 py-2 rounded-xl border border-border text-sm">
                      <Sparkles className="w-3.5 h-3.5 text-secondary" />
                      <span className="font-semibold">{a.name}</span>
                      <span className="text-muted-foreground">from N$ {a.price_small}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeUp>
          )}
        </div>
      </section>

      {/* ══ WHY CHOOSE OASIS ═════════════════════════════════════════════════ */}
      <section className="py-24 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <SectionHeading badge="Our Advantage" title="Why Windhoek Chooses Oasis" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: <MapPin className="w-6 h-6" />,  title: "We Come to You",     desc: "No queues, no travel. Book from anywhere and we arrive fully equipped." },
              { icon: <Shield className="w-6 h-6" />,  title: "Vetted Professionals", desc: "Every detailer is trained, background-checked, and fully insured." },
              { icon: <Leaf className="w-6 h-6" />,    title: "Eco-Conscious",       desc: "Water-efficient methods and biodegradable products — clean car, clean planet." },
              { icon: <Clock className="w-6 h-6" />,   title: "On Time, Every Time", desc: "Real-time tracking and SMS alerts so you're never left waiting." },
            ].map((item, i) => (
              <FadeUp key={i} delay={i * 0.1}>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition">
                  <div className="w-12 h-12 rounded-xl bg-secondary/20 text-secondary flex items-center justify-center mb-4">
                    {item.icon}
                  </div>
                  <h3 className="font-bold text-white text-lg mb-2">{item.title}</h3>
                  <p className="text-primary-foreground/60 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PRICING / SUBSCRIPTIONS ══════════════════════════════════════════ */}
      <section id="pricing" className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionHeading badge="Subscription Plans" title="Unlimited Clean Rides" subtitle="Subscribe and save — the more you wash, the more you save." />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {(plans.length > 0 ? plans : [
              { plan_name: "Basic",     monthly_price: 250, allowed_bookings_per_month: 2, description: "2 standard washes/month" },
              { plan_name: "Standard",  monthly_price: 450, allowed_bookings_per_month: 4, description: "4 standard washes/month" },
              { plan_name: "Premium",   monthly_price: 650, allowed_bookings_per_month: 4, description: "4 washes + 1 full detail" },
              { plan_name: "Corporate", monthly_price: 0,   allowed_bookings_per_month: 99, description: "Fleet pricing — contact us" },
            ]).map((plan, i) => {
              const isPopular = i === 1;
              return (
                <FadeUp key={i} delay={i * 0.1}>
                  <div className={`relative rounded-2xl border p-7 flex flex-col ${
                    isPopular
                      ? "bg-secondary text-secondary-foreground border-secondary shadow-2xl shadow-secondary/30 scale-105"
                      : "bg-card border-border"
                  }`}>
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider px-4 py-1 rounded-full flex items-center gap-1">
                        <Crown className="w-3 h-3" /> Most Popular
                      </div>
                    )}
                    <h3 className={`font-display font-black text-xl mb-1 ${isPopular ? "" : ""}`}>{plan.plan_name}</h3>
                    <p className={`text-sm mb-5 ${isPopular ? "text-secondary-foreground/80" : "text-muted-foreground"}`}>
                      {plan.description}
                    </p>
                    <div className="mb-6">
                      {plan.monthly_price > 0 ? (
                        <>
                          <span className="text-4xl font-black">N$ {plan.monthly_price}</span>
                          <span className={`text-sm ml-1 ${isPopular ? "text-secondary-foreground/70" : "text-muted-foreground"}`}>/mo</span>
                        </>
                      ) : (
                        <span className="text-2xl font-black">Custom</span>
                      )}
                    </div>
                    <div className="flex-1 space-y-2.5 mb-6">
                      <div className="flex items-center gap-2 text-sm">
                        <Check className={`w-4 h-4 flex-shrink-0 ${isPopular ? "text-secondary-foreground" : "text-secondary"}`} />
                        <span>{plan.allowed_bookings_per_month < 50 ? `${plan.allowed_bookings_per_month} washes/month` : "Unlimited washes"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Check className={`w-4 h-4 flex-shrink-0 ${isPopular ? "text-secondary-foreground" : "text-secondary"}`} />
                        <span>Priority booking</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Check className={`w-4 h-4 flex-shrink-0 ${isPopular ? "text-secondary-foreground" : "text-secondary"}`} />
                        <span>Loyalty points earned</span>
                      </div>
                    </div>
                    <Link to="/dashboard"
                      className={`block text-center py-3 rounded-xl font-bold text-sm transition ${
                        isPopular
                          ? "bg-primary text-primary-foreground hover:opacity-90"
                          : "bg-secondary/10 text-secondary hover:bg-secondary/20"
                      }`}>
                      Get Started
                    </Link>
                  </div>
                </FadeUp>
              );
            })}
          </div>
          <FadeUp delay={0.3}>
            <p className="text-center text-sm text-muted-foreground mt-6">
              All plans include loyalty points. Cancel anytime. <Link to="/auth" className="text-secondary font-semibold hover:underline">Sign up free</Link> to manage your subscription.
            </p>
          </FadeUp>
        </div>
      </section>

      {/* ══ REVIEWS ══════════════════════════════════════════════════════════ */}
      {reviews.length > 0 && (
        <section className="py-24 bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <SectionHeading badge="Reviews" title="What Our Clients Say" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {reviews.map((rev, i) => (
                <FadeUp key={i} delay={i * 0.1}>
                  <div className="bg-card rounded-2xl border border-border p-6">
                    <Quote className="w-8 h-8 text-secondary/30 mb-3" />
                    <div className="flex gap-1 mb-3">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Star key={j} className={`w-4 h-4 ${j < rev.star_rating ? "fill-secondary text-secondary" : "text-border"}`} />
                      ))}
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                      {rev.review_comment || "Great service! Very happy with the results."}
                    </p>
                    <p className="text-xs text-muted-foreground/60">Verified Oasis Customer</p>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══ ABOUT ════════════════════════════════════════════════════════════ */}
      <section id="about" className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Text */}
            <div>
              <FadeUp>
                <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-secondary bg-secondary/10 px-4 py-1.5 rounded-full mb-6">
                  <Users className="w-3 h-3" /> Our Story
                </span>
              </FadeUp>
              <FadeUp delay={0.1}>
                <h2 className="font-display text-3xl sm:text-4xl font-black leading-tight mb-6">
                  {about.title || "About Oasis Pure Cleaning CC"}
                </h2>
              </FadeUp>
              <FadeUp delay={0.2}>
                <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                  {about.story || "Oasis Pure Cleaning CC was born from a simple belief: your vehicle deserves exceptional care — and you deserve convenience. We bring professional-grade car wash and detailing services directly to you, wherever you are in Windhoek."}
                </p>
              </FadeUp>
              <FadeUp delay={0.3}>
                <div className="bg-muted/50 border border-border rounded-2xl p-6 mb-8">
                  <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Our Mission</p>
                  <p className="text-foreground leading-relaxed">
                    {about.mission || "To deliver premium mobile car care that respects your time, protects your investment, and leaves every vehicle spotless."}
                  </p>
                </div>
              </FadeUp>
              <FadeUp delay={0.4}>
                <div className="grid grid-cols-2 gap-3">
                  {(about.values || ["Professional & reliable", "Eco-conscious cleaning", "On-time, every time", "Customer-first approach"])
                    .map((v: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <div className="w-5 h-5 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-secondary" />
                        </div>
                        <span className="font-medium">{v}</span>
                      </div>
                    ))}
                </div>
              </FadeUp>
            </div>

            {/* Visual */}
            <FadeUp delay={0.2}>
              <div className="relative">
                <div className="aspect-[4/3] rounded-3xl bg-gradient-to-br from-primary via-primary to-secondary/30 overflow-hidden flex items-center justify-center shadow-2xl">
                  <div className="absolute inset-0 opacity-20" style={{
                    backgroundImage: "radial-gradient(circle at 30% 40%, rgba(255,140,0,0.8) 0%, transparent 50%), radial-gradient(circle at 70% 70%, rgba(0,120,200,0.5) 0%, transparent 50%)"
                  }} />
                  <div className="relative z-10 text-center">
                    <img src={logoBrand} alt="Oasis" className="h-20 w-auto object-contain mx-auto mb-6 drop-shadow-2xl" />
                    <div className="grid grid-cols-3 gap-8">
                      {[
                        { val: about.founded_year || "2020", label: "Founded" },
                        { val: about.vehicles_washed || "2,500+", label: "Washed" },
                        { val: about.happy_customers || "800+", label: "Clients" },
                      ].map(s => (
                        <div key={s.label} className="text-center">
                          <p className="text-2xl font-black text-white">{s.val}</p>
                          <p className="text-xs text-white/60 uppercase tracking-wider mt-1">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Floating badges */}
                <motion.div
                  animate={{ y: [-5, 5, -5] }} transition={{ duration: 3, repeat: Infinity }}
                  className="absolute -top-4 -right-4 bg-secondary text-secondary-foreground text-xs font-bold px-4 py-2 rounded-full shadow-xl"
                >
                  <Award className="w-3 h-3 inline mr-1" /> Windhoek's Best
                </motion.div>
                <motion.div
                  animate={{ y: [5, -5, 5] }} transition={{ duration: 4, repeat: Infinity }}
                  className="absolute -bottom-4 -left-4 bg-card border border-border text-foreground text-xs font-bold px-4 py-2 rounded-full shadow-xl"
                >
                  <Zap className="w-3 h-3 inline mr-1 text-secondary" /> Book in 2 min
                </motion.div>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ══ CONTACT & BANKING ════════════════════════════════════════════════ */}
      <section id="contact" className="py-24 bg-muted/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionHeading badge="Get in Touch" title="Contact Us" subtitle="Ready to book or just have a question? We're always available." />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Contact details */}
            <FadeUp>
              <div className="bg-card rounded-2xl border border-border p-8 space-y-5">
                <h3 className="font-display font-bold text-xl mb-6">Reach Out</h3>
                {[
                  { icon: <Phone className="w-5 h-5" />,        label: "Phone",          val: contact.phone || "+264 81 278 1123" },
                  { icon: <MessageCircle className="w-5 h-5" />, label: "WhatsApp",       val: contact.whatsapp || "+264 81 278 1123" },
                  { icon: <Mail className="w-5 h-5" />,          label: "Email",          val: contact.email || "info@oasispurecleaning.com" },
                  { icon: <MapPin className="w-5 h-5" />,        label: "Location",       val: contact.address || "Windhoek, Namibia" },
                  { icon: <Clock className="w-5 h-5" />,         label: "Hours",          val: contact.operating_hours || "Mon–Sat: 07:00 – 19:00" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center flex-shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-0.5">{item.label}</p>
                      <p className="font-semibold">{item.val}</p>
                    </div>
                  </div>
                ))}
                <div className="pt-4 flex gap-3">
                  <a href={`tel:${(contact.phone || "").replace(/\s/g, "")}`}
                    className="flex-1 flex items-center justify-center gap-2 bg-secondary text-secondary-foreground py-3 rounded-xl font-bold text-sm hover:opacity-90 transition">
                    <Phone className="w-4 h-4" /> Call Us
                  </a>
                  <a href={`https://wa.me/${(contact.whatsapp || "264812781123").replace(/[^0-9]/g, "")}`}
                    target="_blank" rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl font-bold text-sm hover:opacity-90 transition">
                    <MessageCircle className="w-4 h-4" /> WhatsApp
                  </a>
                </div>
              </div>
            </FadeUp>

            {/* Banking details */}
            <FadeUp delay={0.15}>
              <div className="bg-card rounded-2xl border border-border p-8">
                <h3 className="font-display font-bold text-xl mb-6 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-secondary" /> EFT Payment Details
                </h3>
                <div className="space-y-4">
                  {[
                    { label: "Bank",           key: "eft_bank_name" },
                    { label: "Account Name",   key: "eft_account_name" },
                    { label: "Account Number", key: "eft_account_number" },
                    { label: "Branch Code",    key: "eft_branch_code" },
                    { label: "Reference",      key: "reference_format" },
                  ].map(item => (
                    <div key={item.key} className="flex items-center justify-between py-3 border-b border-border/60 last:border-0">
                      <span className="text-sm text-muted-foreground font-medium">{item.label}</span>
                      <span className="font-bold text-sm text-right">—</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 bg-secondary/5 border border-secondary/20 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">Important:</strong> After making payment, please upload your proof of payment in the booking confirmation. Admin will verify and confirm your booking.
                  </p>
                </div>
                <div className="mt-4">
                  <Link to="/auth" className="block text-center bg-primary text-primary-foreground py-3 rounded-xl font-bold text-sm hover:opacity-90 transition">
                    Sign in to View Full Banking Details
                  </Link>
                </div>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ══ CTA BAND ═════════════════════════════════════════════════════════ */}
      <section className="py-20 bg-secondary relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-10" style={{
          backgroundImage: "radial-gradient(circle at 20% 50%, white 0%, transparent 60%), radial-gradient(circle at 80% 50%, white 0%, transparent 60%)"
        }} />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <FadeUp>
            <h2 className="font-display text-3xl sm:text-5xl font-black text-secondary-foreground mb-4 leading-tight">
              Your car deserves better. Book today.
            </h2>
          </FadeUp>
          <FadeUp delay={0.1}>
            <p className="text-secondary-foreground/80 text-lg mb-8">Spots fill fast — especially on weekends. Reserve your time slot now.</p>
          </FadeUp>
          <FadeUp delay={0.2}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/book"
                className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-2xl font-black text-base hover:scale-105 transition-transform shadow-2xl">
                <Car className="w-5 h-5" /> Book a Wash Now
              </Link>
              <Link to="/auth"
                className="flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 text-secondary-foreground px-8 py-4 rounded-2xl font-bold text-base transition">
                Create Free Account
              </Link>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ══ FOOTER ═══════════════════════════════════════════════════════════ */}
      <footer className="bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div>
              <img src={logoBrand} alt="Oasis Pure Cleaning" className="h-10 w-auto object-contain mb-4" />
              <p className="text-primary-foreground/60 text-sm leading-relaxed mb-4">
                Premium mobile car wash & detailing in Windhoek, Namibia. We come to you.
              </p>
              <div className="flex gap-3">
                {contact.instagram && (
                  <a href={contact.instagram} target="_blank" rel="noreferrer"
                    className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition">
                    <Instagram className="w-4 h-4" />
                  </a>
                )}
                {contact.facebook && (
                  <a href={contact.facebook} target="_blank" rel="noreferrer"
                    className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition">
                    <Facebook className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            {/* Services */}
            <div>
              <h4 className="font-bold text-sm uppercase tracking-widest mb-4 text-primary-foreground/50">Services</h4>
              <ul className="space-y-2 text-sm text-primary-foreground/70">
                <li><Link to="/book" className="hover:text-secondary transition">Basic Interior Wash</Link></li>
                <li><Link to="/book" className="hover:text-secondary transition">Basic Exterior Wash</Link></li>
                <li><Link to="/book" className="hover:text-secondary transition">Full Detailing</Link></li>
                <li><Link to="/book" className="hover:text-secondary transition">Engine Bay Cleaning</Link></li>
              </ul>
            </div>

            {/* Quick links */}
            <div>
              <h4 className="font-bold text-sm uppercase tracking-widest mb-4 text-primary-foreground/50">Quick Links</h4>
              <ul className="space-y-2 text-sm text-primary-foreground/70">
                <li><Link to="/book" className="hover:text-secondary transition">Book a Wash</Link></li>
                <li><Link to="/auth" className="hover:text-secondary transition">Customer Portal</Link></li>
                <li><Link to="/admin" className="hover:text-secondary transition">Admin Login</Link></li>
                <li><a href="#about" onClick={e => { e.preventDefault(); document.querySelector("#about")?.scrollIntoView({ behavior: "smooth" }); }} className="hover:text-secondary transition">About Us</a></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-bold text-sm uppercase tracking-widest mb-4 text-primary-foreground/50">Contact</h4>
              <ul className="space-y-2.5 text-sm text-primary-foreground/70">
                <li className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-secondary" />{contact.phone || "+264 81 278 1123"}</li>
                <li className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-secondary" />{contact.email || "info@oasispurecleaning.com"}</li>
                <li className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-secondary" />{contact.address || "Windhoek, Namibia"}</li>
                <li className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-secondary" />Mon–Sat 07:00–19:00</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-primary-foreground/40">
            <p>© {new Date().getFullYear()} Oasis Pure Cleaning CC. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <span>Windhoek, Namibia</span>
              <span>·</span>
              <Link to="/book" className="hover:text-secondary transition">Book Now</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* ══ WINNY CHATBOT ════════════════════════════════════════════════════ */}
      <WinnyChatbot />
    </div>
  );
}
