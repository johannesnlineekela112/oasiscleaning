/**
 * BeforeAfter.tsx — Interactive drag-reveal comparison
 * Framer Motion drag constraint along X axis.
 * Communicates service quality visually — no text needed.
 */
import React, { useRef, useState } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { fadeUp, viewport } from "./motionVariants";

const SLIDER_W = 4;

export function BeforeAfter() {
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const [dragging, setDragging] = useState(false);

  // Convert x drag into a clip width percentage
  const clipPercent = useTransform(x, (val) => {
    if (!containerRef.current) return 50;
    const w = containerRef.current.offsetWidth;
    const center = w / 2;
    return Math.min(95, Math.max(5, ((center + val) / w) * 100));
  });

  const clipStyle = useTransform(clipPercent, v => `inset(0 ${100 - v}% 0 0)`);

  return (
    <section className="py-16 sm:py-28 bg-muted/30 relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Heading */}
        <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={viewport}
          className="text-center mb-10 sm:mb-16">
          <span className="inline-flex items-center gap-1.5 bg-secondary/10 text-secondary border border-secondary/20 font-bold uppercase px-3 py-1 rounded-full text-[10px] tracking-widest mb-3">
            ✦ Results
          </span>
          <h2 className="font-display font-black tracking-tight text-foreground mb-3"
            style={{ fontSize: "clamp(1.75rem, 4.5vw, 3.25rem)" }}>
            See the Difference
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto" style={{ fontSize: "clamp(0.875rem, 2vw, 1.05rem)" }}>
            Drag the slider to reveal what an Oasis detail does for your vehicle.
          </p>
        </motion.div>

        {/* Slider */}
        <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={viewport} transition={{ delay: 0.15 } as any}>
          <div ref={containerRef}
            className="relative mx-auto rounded-2xl sm:rounded-3xl overflow-hidden select-none"
            style={{ maxWidth: 760, aspectRatio: "16/9", cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}>

            {/* AFTER — full width base layer */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/80 to-secondary/30 flex items-center justify-center">
              {/* After car — clean, gleaming */}
              <svg viewBox="0 0 760 427" xmlns="http://www.w3.org/2000/svg" className="w-full h-full absolute inset-0">
                {/* Sheen effect */}
                <defs>
                  <radialGradient id="sheen" cx="40%" cy="35%" r="55%">
                    <stop offset="0%"   stopColor="rgba(255,255,255,0.18)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                  </radialGradient>
                  <radialGradient id="floor-r" cx="50%" cy="50%" r="50%">
                    <stop offset="0%"   stopColor="rgba(255,140,0,0.12)" />
                    <stop offset="100%" stopColor="rgba(255,140,0,0)" />
                  </radialGradient>
                </defs>
                {/* Floor reflection */}
                <ellipse cx="380" cy="380" rx="260" ry="28" fill="rgba(255,255,255,0.04)" />
                {/* Car body */}
                <path d="M140 290 L140 240 L210 175 L370 158 L530 175 L600 235 L620 290 Z"
                  fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
                {/* Cabin */}
                <path d="M220 238 L248 185 L430 172 L510 238" fill="rgba(255,255,255,0.09)" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
                {/* Windows */}
                <path d="M232 232 L256 192 L360 181 L360 232 Z" fill="rgba(96,190,255,0.25)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
                <path d="M368 181 L500 184 L500 232 L368 232 Z" fill="rgba(96,190,255,0.25)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
                {/* Wheels */}
                <circle cx="225" cy="300" r="44" fill="rgba(15,25,40,0.7)" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                <circle cx="225" cy="300" r="28" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
                <circle cx="225" cy="300" r="12" fill="rgba(255,140,0,0.6)" />
                <circle cx="535" cy="300" r="44" fill="rgba(15,25,40,0.7)" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                <circle cx="535" cy="300" r="28" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
                <circle cx="535" cy="300" r="12" fill="rgba(255,140,0,0.6)" />
                {/* Headlight */}
                <path d="M600 235 L620 245 L618 260 L598 258 Z" fill="rgba(255,220,100,0.5)" />
                {/* Sheen overlay */}
                <rect x="0" y="0" width="760" height="427" fill="url(#sheen)" />
              </svg>
              {/* AFTER label */}
              <div className="absolute bottom-4 right-4 bg-secondary text-secondary-foreground font-black text-xs px-3 py-1.5 rounded-lg z-10 shadow-lg">
                AFTER — Oasis Detail
              </div>
            </div>

            {/* BEFORE — clipped overlay */}
            <motion.div className="absolute inset-0" style={{ clipPath: clipStyle }}>
              <div className="absolute inset-0 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 flex items-center justify-center">
                <svg viewBox="0 0 760 427" xmlns="http://www.w3.org/2000/svg" className="w-full h-full absolute inset-0">
                  <defs>
                    <filter id="dirty">
                      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
                      <feColorMatrix type="saturate" values="0" />
                      <feBlend in="SourceGraphic" mode="multiply" />
                    </filter>
                  </defs>
                  <ellipse cx="380" cy="380" rx="240" ry="22" fill="rgba(0,0,0,0.3)" />
                  {/* Dull car body */}
                  <path d="M140 290 L140 240 L210 175 L370 158 L530 175 L600 235 L620 290 Z"
                    fill="rgba(80,80,80,0.5)" stroke="rgba(100,100,100,0.4)" strokeWidth="1.5" />
                  <path d="M220 238 L248 185 L430 172 L510 238" fill="rgba(60,60,60,0.4)" stroke="rgba(90,90,90,0.4)" strokeWidth="1" />
                  {/* Dirty windows */}
                  <path d="M232 232 L256 192 L360 181 L360 232 Z" fill="rgba(80,90,80,0.3)" />
                  <path d="M368 181 L500 184 L500 232 L368 232 Z" fill="rgba(80,90,80,0.3)" />
                  {/* Wheels */}
                  <circle cx="225" cy="300" r="44" fill="rgba(10,10,10,0.8)" stroke="rgba(60,60,60,0.3)" strokeWidth="1" />
                  <circle cx="225" cy="300" r="28" fill="rgba(40,40,40,0.6)" />
                  <circle cx="535" cy="300" r="44" fill="rgba(10,10,10,0.8)" stroke="rgba(60,60,60,0.3)" strokeWidth="1" />
                  <circle cx="535" cy="300" r="28" fill="rgba(40,40,40,0.6)" />
                  {/* Dirt marks */}
                  <path d="M160 270 Q200 260 230 275 Q260 285 290 270" stroke="rgba(100,80,60,0.4)" strokeWidth="2" fill="none" />
                  <path d="M350 200 Q400 195 450 205" stroke="rgba(90,70,50,0.3)" strokeWidth="1.5" fill="none" />
                  <path d="M480 260 Q510 255 540 265 Q570 272 600 258" stroke="rgba(100,80,60,0.35)" strokeWidth="2" fill="none" />
                  {/* Noise overlay */}
                  <rect x="0" y="0" width="760" height="427" fill="rgba(50,40,30,0.15)" filter="url(#dirty)" opacity="0.3" />
                </svg>
                {/* BEFORE label */}
                <div className="absolute bottom-4 left-4 bg-slate-700 text-white/80 font-black text-xs px-3 py-1.5 rounded-lg z-10 shadow-lg border border-white/10">
                  BEFORE
                </div>
              </div>
            </motion.div>

            {/* Drag handle */}
            <motion.div
              className="absolute top-0 bottom-0 z-20 flex items-center justify-center"
              style={{ x, left: "calc(50% - 2px)", width: SLIDER_W }}
              drag="x"
              dragElastic={0}
              dragMomentum={false}
              dragConstraints={containerRef}
              onDragStart={() => setDragging(true)}
              onDragEnd={() => setDragging(false)}>
              {/* Line */}
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
              {/* Handle knob */}
              <div className={`w-10 h-10 rounded-full bg-white shadow-xl flex items-center justify-center border-2 border-secondary z-20 relative transition-transform ${dragging ? "scale-110" : "scale-100"}`}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M6 4L2 9L6 14" stroke="#0d2744" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 4L16 9L12 14" stroke="#0d2744" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </motion.div>

            {/* Drag hint */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/40 text-white text-xs font-semibold px-3 py-1 rounded-full pointer-events-none backdrop-blur-sm border border-white/10">
              ← Drag to compare →
            </div>
          </div>
        </motion.div>

        {/* Caption */}
        <motion.p variants={fadeUp} initial="hidden" whileInView="visible" viewport={viewport}
          transition={{ delay: 0.3 } as any}
          className="text-center text-muted-foreground text-sm mt-6 max-w-md mx-auto">
          Professional before-and-after documentation is included with every Oasis service.
        </motion.p>
      </div>
    </section>
  );
}
