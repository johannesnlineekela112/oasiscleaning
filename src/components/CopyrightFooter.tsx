import { Shield } from "lucide-react";

/**
 * CopyrightFooter — always visible, never overlaps popups.
 *
 * position: static (Tailwind default, no explicit position class)
 * ─ A static element creates NO stacking context and participates in
 *   normal document flow only. Fixed overlays (z-[100]…z-[700]) always
 *   paint above it regardless of DOM order. No hacks needed.
 *
 * background: solid hsl(--background) so it is visible over page gradients.
 */
export function CopyrightFooter() {
  return (
    <footer
      className="w-full py-2.5 px-4 border-t border-border/40"
      style={{ background: "hsl(var(--background))" }}
    >
      <p className="text-center text-[10px] text-foreground/50 font-medium flex items-center justify-center gap-1.5 flex-wrap leading-relaxed select-none">
        <Shield className="w-2.5 h-2.5 shrink-0 opacity-50" />
        Copyright © Designed by Oasis Pure Cleaning CC
        <span className="opacity-30 mx-0.5">|</span>
        All Rights Reserved
      </p>
    </footer>
  );
}
