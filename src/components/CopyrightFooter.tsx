import { useState } from "react";
import { Shield, Cookie } from "lucide-react";
import CookieBanner from "./CookieBanner";

/**
 * CopyrightFooter — always visible at bottom of every page.
 * Also hosts the "Manage Cookies" trigger so it doesn't overlap the booking total bar.
 */
export function CopyrightFooter() {
  const [showManage, setShowManage] = useState(false);

  return (
    <>
      <footer
        className="w-full py-2.5 px-4 border-t border-border/40"
        style={{ background: "hsl(var(--background))" }}
      >
        <p className="text-center text-[10px] text-foreground/50 font-medium flex items-center justify-center gap-1.5 flex-wrap leading-relaxed select-none">
          <Shield className="w-2.5 h-2.5 shrink-0 opacity-50" />
          Copyright © Designed by Oasis Pure Cleaning CC
          <span className="opacity-30 mx-0.5">|</span>
          All Rights Reserved
          <span className="opacity-30 mx-0.5">|</span>
          <button
            onClick={() => setShowManage(true)}
            className="inline-flex items-center gap-1 hover:text-foreground/80 transition underline underline-offset-2"
          >
            <Cookie className="w-2.5 h-2.5" /> Cookies
          </button>
        </p>
      </footer>
      {showManage && <CookieBanner forceShowManage onClose={() => setShowManage(false)} />}
    </>
  );
}
