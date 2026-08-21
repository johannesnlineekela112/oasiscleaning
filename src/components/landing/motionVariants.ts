/**
 * motionVariants.ts — Oasis motion design system
 * Single source of truth for all Framer Motion variants.
 * Every animation on the landing page derives from these.
 */
import type { Variants } from "framer-motion";

export const ease = {
  out:   [0.22, 1, 0.36, 1] as const,
  inOut: [0.45, 0, 0.55, 1] as const,
};

export const fadeUp: Variants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0,  transition: { duration: 0.6, ease: ease.out } },
};
export const fadeIn: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1,        transition: { duration: 0.5, ease: ease.out } },
};
export const scaleIn: Variants = {
  hidden:  { opacity: 0, scale: 0.94 },
  visible: { opacity: 1, scale: 1,    transition: { duration: 0.55, ease: ease.out } },
};
export const slideInLeft: Variants = {
  hidden:  { opacity: 0, x: -32 },
  visible: { opacity: 1, x: 0,  transition: { duration: 0.6, ease: ease.out } },
};
export const slideInRight: Variants = {
  hidden:  { opacity: 0, x: 32 },
  visible: { opacity: 1, x: 0,  transition: { duration: 0.6, ease: ease.out } },
};
export const stagger: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.11, delayChildren: 0.05 } },
};
export const staggerFast: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.07 } },
};

/** Viewport config — use with whileInView */
export const viewport = { once: true, margin: "-60px" };

/** Button tap feedback */
export const tap = { scale: 0.97 };
