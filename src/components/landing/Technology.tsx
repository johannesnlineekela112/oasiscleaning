/**
 * Technology.tsx — Oasis technology positioning section
 * Communicates the platform's digital infrastructure as a benefit,
 * not as a technical spec. Feels like SaaS product marketing.
 */
import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  CalendarCheck, Smartphone, ShieldCheck, Star,
  Layers, Users, ArrowRight, Zap,
} from "lucide-react";
import { stagger, fadeUp, scaleIn, viewport } from "./motionVariants";

const FEATURES = [
  {
    icon:  <CalendarCheck className="w-5 h-5" />,
    title: "Instant Online Booking",
    body:  "Book a wash in under two minutes. Choose service, time, and location — all from your phone.",
    highlight: false,
  },
  {
    icon:  <Smartphone className="w-5 h-5" />,
    title: "Customer Portal",
    body:  "Manage all your bookings, view history, track loyalty points, and handle subscriptions in one place.",
    highlight: false,
  },
  {
    icon:  <ShieldCheck className="w-5 h-5" />,
    title: "Job Documentation",
    body:  "Before-and-after photos captured by your detailer and stored in your account for every service.",
    highlight: true,
  },
  {
    icon:  <Star className="w-5 h-5" />,
    title: "Loyalty Programme",
    body:  "Earn points on every booking. Four tiers — Bronze to Platinum. 100 points redeems a free wash.",
    highlight: false,
  },
  {
    icon:  <Layers className="w-5 h-5" />,
    title: "Subscription Plans",
    body:  "Set a recurring schedule. Your vehicle stays clean without you having to remember to book.",
    highlight: false,
  },
  {
    icon:  <Users className="w-5 h-5" />,
    title: "Fleet Dashboard",
    body:  "Manage multiple vehicles under one account. Custom scheduling and centralised billing for businesses.",
    highlight: false,
  },
];

export function Technology() {
  return (
    <section className="py-16 sm:py-28 bg-background relative overflow-hidden" id="technology">
      <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{ backgroundImage: "radial-gradient(hsl(var(--secondary)) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_480px] gap-12 lg:gap-20 items-start">

          {/* Left — heading + CTA */}
          <div className="lg:sticky lg:top-24">
            <motion.span variants={fadeUp} initial="hidden" whileInView="visible" viewport={viewport}
              className="inline-flex items-center gap-1.5 bg-secondary/10 text-secondary border border-secondary/20 font-bold uppercase px-3 py-1 rounded-full text-[10px] tracking-widest mb-4">
              <Zap className="w-2.5 h-2.5" /> Platform
            </motion.span>

            <motion.h2 variants={fadeUp} initial="hidden" whileInView="visible" viewport={viewport}
              transition={{ delay: 0.08 } as any}
              className="font-display font-black text-foreground leading-[1.1] tracking-tight mb-4"
              style={{ fontSize: "clamp(1.75rem, 4.5vw, 3.25rem)" }}>
              More Than a Car Wash.<br />
              <span className="text-secondary">A Cleaning Platform.</span>
            </motion.h2>

            <motion.p variants={fadeUp} initial="hidden" whileInView="visible" viewport={viewport}
              transition={{ delay: 0.16 } as any}
              className="text-muted-foreground leading-relaxed mb-8"
              style={{ fontSize: "clamp(0.9rem, 1.8vw, 1.05rem)" }}>
              Oasis is built on technology that makes vehicle care effortless. Book, track, document, and manage
              everything — from a single app, at any time.
            </motion.p>

            {/* Stats */}
            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={viewport}
              transition={{ delay: 0.22 } as any}
              className="grid grid-cols-3 gap-3 mb-8">
              {[
                { val: "2 min", label: "To book" },
                { val: "0",     label: "Travel needed" },
                { val: "100%",  label: "Documented" },
              ].map(s => (
                <div key={s.label} className="bg-muted/50 rounded-xl p-3 text-center border border-border">
                  <p className="font-black text-foreground" style={{ fontSize: "clamp(1.2rem, 3vw, 1.75rem)" }}>{s.val}</p>
                  <p className="text-muted-foreground text-xs mt-0.5 font-medium">{s.label}</p>
                </div>
              ))}
            </motion.div>

            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={viewport}
              transition={{ delay: 0.28 } as any}
              className="flex flex-wrap gap-3">
              <motion.div whileTap={{ scale: 0.97 }}>
                <Link to="/book"
                  className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground font-bold rounded-xl hover:bg-secondary/90 transition-colors shadow-lg shadow-secondary/20"
                  style={{ padding: "0.75rem 1.5rem", fontSize: "clamp(0.875rem,1.8vw,1rem)" }}>
                  Book a Wash <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
              <motion.div whileTap={{ scale: 0.97 }}>
                <Link to="/auth"
                  className="inline-flex items-center gap-2 bg-muted text-foreground font-semibold rounded-xl hover:bg-muted/80 transition-colors border border-border"
                  style={{ padding: "0.75rem 1.5rem", fontSize: "clamp(0.875rem,1.8vw,1rem)" }}>
                  Create Account
                </Link>
              </motion.div>
            </motion.div>
          </div>

          {/* Right — feature cards */}
          <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={viewport}
            className="space-y-3">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} variants={fadeUp}
                className={`rounded-2xl border p-4 sm:p-5 flex items-start gap-4 transition-colors group
                  ${f.highlight
                    ? "bg-secondary/8 border-secondary/30 hover:bg-secondary/12"
                    : "bg-card border-border hover:border-secondary/30 hover:bg-card/80"
                  }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors
                  ${f.highlight ? "bg-secondary/20 text-secondary" : "bg-muted text-muted-foreground group-hover:bg-secondary/15 group-hover:text-secondary"}`}>
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm sm:text-base mb-1">{f.title}</h3>
                  <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">{f.body}</p>
                </div>
                {f.highlight && (
                  <span className="ml-auto text-[10px] font-bold text-secondary uppercase tracking-widest flex-shrink-0 mt-0.5">New</span>
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
