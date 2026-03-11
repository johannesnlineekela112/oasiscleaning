import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, ChevronRight, Megaphone } from "lucide-react";
import type { MarketingAd, AdPlacement } from "@/lib/adService";

// ─── Shared dismiss hook ──────────────────────────────────────────────────────
// Dismissed IDs are in-memory only — cleared on every page refresh so ads
// always reappear when the user reloads.
function useDismissed() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const dismiss = (id: string) =>
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

  return { dismissed, dismiss };
}

// ─── Single ad button ─────────────────────────────────────────────────────────
function AdButton({
  text,
  link,
  variant = "solid",
}: {
  text: string;
  link: string;
  variant?: "solid" | "outline";
}) {
  const isExternal = link.startsWith("http");
  const shared = "inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95";
  return (
    <a
      href={link}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className={
        variant === "solid"
          ? `${shared} text-white hover:opacity-90`
          : `${shared} border-2 border-current hover:bg-white/10`
      }
      style={variant === "solid" ? { background: "#FF8C00" } : { color: "#FF8C00" }}
    >
      {text}
      {isExternal ? <ExternalLink className="w-3.5 h-3.5" /> : <ChevronRight className="w-4 h-4" />}
    </a>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BANNER TOP — full-width strip; title is fixed, message text slides in a loop
// ═══════════════════════════════════════════════════════════════════════════════

/** Sliding message ticker — loops forever, pauses on hover */
function MessageTicker({ messages }: { messages: string[] }) {
  const [idx, setIdx]     = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (messages.length <= 1) return; // nothing to cycle
    // Every 4 s: fade-slide out, swap text, fade-slide in
    const cycle = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % messages.length);
        setVisible(true);
      }, 420); // matches exit duration below
    }, 4000);
    return () => clearInterval(cycle);
  }, [messages.length]);

  return (
    <div className="relative overflow-hidden h-5 flex items-center" style={{ minWidth: 0 }}>
      <AnimatePresence mode="wait" initial={false}>
        {visible && (
          <motion.span
            key={idx}
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0,  opacity: 1 }}
            exit={{   y: -14, opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="absolute whitespace-nowrap text-sm text-white/90 leading-5"
          >
            {messages[idx]}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

export function BannerAds({ ads }: { ads: MarketingAd[] }) {
  const { dismissed, dismiss } = useDismissed();
  const visible = ads.filter(a => !dismissed.has(a.id));
  if (!visible.length) return null;

  return (
    <div className="w-full space-y-0">
      <AnimatePresence initial={false}>
        {visible.map(ad => {
          // Collect all messages for this ad (title stays fixed, messages cycle)
          // If the admin stored multiple pipe-separated messages use them; otherwise loop the single one.
          const messages = ad.message
            .split("||")
            .map(m => m.trim())
            .filter(Boolean);
          // Ensure at least 1 entry
          if (!messages.length) messages.push(ad.message);

          return (
            <motion.div
              key={ad.id}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div
                className="relative w-full flex items-center gap-3 px-4 py-2.5 text-white"
                style={{
                  background: ad.image_url
                    ? `linear-gradient(rgba(10,22,40,0.80), rgba(10,22,40,0.80)), url(${ad.image_url}) center/cover no-repeat`
                    : "linear-gradient(135deg, #0a1628 0%, #1a2d4a 100%)",
                }}
              >
                {/* Icon */}
                <Megaphone className="w-4 h-4 shrink-0 text-orange-400" />

                {/* Fixed title — hidden on mobile to give message room */}
                {ad.title && (
                  <span
                    className="hidden sm:inline shrink-0 font-bold text-sm whitespace-nowrap"
                    style={{ color: "#FF8C00" }}
                  >
                    {ad.title}
                  </span>
                )}

                {/* Divider — hidden on mobile */}
                {ad.title && (
                  <span className="hidden sm:inline shrink-0 text-white/30 select-none">|</span>
                )}

                {/* Sliding message — takes remaining space */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <MessageTicker messages={messages} />
                </div>

                {/* CTA — hidden on mobile */}
                {ad.button_text && ad.button_link && (
                  <a
                    href={ad.button_link}
                    target={ad.button_link.startsWith("http") ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="hidden sm:inline-flex shrink-0 px-3 py-1 rounded-lg text-xs font-bold border border-orange-400 text-orange-300 hover:bg-orange-400/20 transition whitespace-nowrap"
                  >
                    {ad.button_text}
                  </a>
                )}

                {/* Dismiss */}
                <button
                  onClick={() => dismiss(ad.id)}
                  className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20 transition text-white/60 hover:text-white"
                  aria-label="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INLINE CARD — rendered between content sections
// ═══════════════════════════════════════════════════════════════════════════════
export function InlineAds({ ads }: { ads: MarketingAd[] }) {
  const { dismissed, dismiss } = useDismissed();
  const visible = ads.filter(a => !dismissed.has(a.id));
  if (!visible.length) return null;

  return (
    <div className="space-y-3">
      {visible.map(ad => (
        <motion.div
          key={ad.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="relative bg-gradient-to-br from-primary/5 to-secondary/10 border border-secondary/20 rounded-2xl overflow-hidden shadow-card"
        >
          {/* Optional hero image */}
          {ad.image_url && (
            <div className="w-full h-36 overflow-hidden">
              <img
                src={ad.image_url}
                alt={ad.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          )}

          <div className="p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,140,0,0.12)", color: "#FF8C00" }}
                >
                  Promotion
                </span>
              </div>
              <button
                onClick={() => dismiss(ad.id)}
                className="text-muted-foreground hover:text-foreground transition shrink-0"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h4 className="font-display font-bold text-base mb-1">{ad.title}</h4>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{ad.message}</p>

            {ad.button_text && ad.button_link && (
              <AdButton text={ad.button_text} link={ad.button_link} />
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// POPUP — modal shown once per session (highest-priority ad only)
// ═══════════════════════════════════════════════════════════════════════════════
export function PopupAd({ ads }: { ads: MarketingAd[] }) {
  const { dismissed, dismiss } = useDismissed();
  const [shown, setShown] = useState(false);

  // Show the highest-priority non-dismissed ad after a 1.5 s delay
  const ad = ads.find(a => !dismissed.has(a.id));

  useEffect(() => {
    if (!ad) return;
    const t = setTimeout(() => setShown(true), 1500);
    return () => clearTimeout(t);
  }, [ad?.id]);

  if (!ad || !shown) return null;

  const handleClose = () => {
    dismiss(ad.id);
    setShown(false);
  };

  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => e.target === e.currentTarget && handleClose()}
        >
          <motion.div
            initial={{ scale: 0.88, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="relative bg-card rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden"
          >
            {/* Hero image */}
            {ad.image_url ? (
              <div className="relative h-48 overflow-hidden">
                <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover" />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
                {/* Close over image */}
                <button
                  onClick={handleClose}
                  className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              /* Accent strip when no image */
              <div className="h-2 w-full" style={{ background: "linear-gradient(90deg, #FF8C00, #ffb347)" }} />
            )}

            {/* Close when no image */}
            {!ad.image_url && (
              <button
                onClick={handleClose}
                className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <div className="p-6">
              {/* Badge */}
              <span
                className="inline-block text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full mb-3"
                style={{ background: "rgba(255,140,0,0.12)", color: "#FF8C00" }}
              >
                Special Offer
              </span>
              <h3 className="font-display font-bold text-xl mb-2">{ad.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-5">{ad.message}</p>

              <div className="flex gap-3">
                {ad.button_text && ad.button_link && (
                  <AdButton text={ad.button_text} link={ad.button_link} />
                )}
                <button
                  onClick={handleClose}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition"
                >
                  No thanks
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIDEBAR — floating panel (bottom-right), highest-priority ad only
// ═══════════════════════════════════════════════════════════════════════════════
export function SidebarAd({ ads }: { ads: MarketingAd[] }) {
  const { dismissed, dismiss } = useDismissed();
  const [open, setOpen] = useState(true);
  const ad = ads.find(a => !dismissed.has(a.id));

  if (!ad || !open) return null;

  return (
    <AnimatePresence>
      {/* ── Mobile: compact message strip at bottom-right ── */}
      <motion.div
        key="sidebar-mobile"
        initial={{ x: 120, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 120, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="sm:hidden fixed bottom-24 right-3 z-[150] max-w-[200px] flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 shadow-lg overflow-hidden"
      >
        <div className="h-full w-0.5 rounded-full shrink-0 self-stretch" style={{ background: "#FF8C00" }} />
        <p className="text-xs text-foreground leading-snug flex-1 min-w-0 line-clamp-2">{ad.message}</p>
        <button
          onClick={() => { dismiss(ad.id); setOpen(false); }}
          className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition"
        >
          <X className="w-3 h-3" />
        </button>
      </motion.div>

      {/* ── Desktop: full card ── */}
      <motion.div
        key="sidebar-desktop"
        initial={{ x: 120, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 120, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="hidden sm:block fixed bottom-24 right-4 z-[150] w-64 bg-card rounded-2xl shadow-2xl border border-border overflow-hidden"
      >
        {/* Accent bar */}
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #FF8C00, #ffb347)" }} />

        {ad.image_url && (
          <img
            src={ad.image_url}
            alt={ad.title}
            className="w-full h-28 object-cover"
            loading="lazy"
          />
        )}

        <div className="p-4 relative">
          <button
            onClick={() => { dismiss(ad.id); setOpen(false); }}
            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#FF8C00" }}>
            {ad.title}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">{ad.message}</p>

          {ad.button_text && ad.button_link && (
            <AdButton text={ad.button_text} link={ad.button_link} variant="solid" />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMBINED LOADER — single component that fetches all placements
// Import this into BookingPage for a single clean integration point
// ═══════════════════════════════════════════════════════════════════════════════
import { fetchActiveAds } from "@/lib/adService";

export function AdsProvider({ children }: { children: React.ReactNode }) {
  // This component is purely a convenience note — the actual ads are loaded
  // directly in BookingPage via individual placement hooks. See BookingPage.tsx.
  return <>{children}</>;
}

// Named exports for each placement used in BookingPage:
// import { BannerAds, InlineAds, PopupAd, SidebarAd } from "@/components/AdsDisplay";
export type { AdPlacement };
