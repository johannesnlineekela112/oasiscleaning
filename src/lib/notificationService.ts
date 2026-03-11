/**
 * notificationService.ts
 *
 * Provides:
 *   unlockAudio()                   — call once on first user gesture to unlock AudioContext
 *   playAlert(type)                 — synthesised Web Audio API tone (no external URL)
 *   requestNotificationPermission() — asks for browser Notification permission
 *   showBrowserNotification(...)    — fires a native OS notification (unique tag per event)
 */

// ─── Audio ────────────────────────────────────────────────────────────────────

export type AlertType = "new_booking" | "booking_updated" | "job_assigned" | "job_updated";

// Shared AudioContext — created once, reused for all alerts.
// Browsers require a user gesture before audio can play; unlockAudio() resumes it.
let _ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!_ctx) {
      _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return _ctx;
  } catch {
    return null;
  }
}

/**
 * Call this once from a click/touch handler to unlock the AudioContext.
 * Safe to call multiple times — idempotent.
 */
export function unlockAudio(): void {
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

// Attach unlock to the first user interaction automatically
if (typeof window !== "undefined") {
  const unlock = () => {
    unlockAudio();
    window.removeEventListener("click",     unlock);
    window.removeEventListener("touchstart", unlock);
    window.removeEventListener("keydown",    unlock);
  };
  window.addEventListener("click",      unlock, { once: true, passive: true });
  window.addEventListener("touchstart", unlock, { once: true, passive: true });
  window.addEventListener("keydown",    unlock, { once: true, passive: true });
}

/**
 * Play a short synthesised tone.
 *
 * new_booking / job_assigned  → two rising notes (ding-dong)
 * booking_updated / job_updated → single soft ping
 */
export function playAlert(type: AlertType): void {
  const ctx = getCtx();
  if (!ctx) return;

  // Resume if still suspended (e.g. autoplay policy)
  const run = () => {
    const notes: { freq: number; start: number; duration: number }[] =
      type === "new_booking" || type === "job_assigned"
        ? [
            { freq: 880,  start: 0,   duration: 0.18 },
            { freq: 1100, start: 0.2, duration: 0.22 },
          ]
        : [{ freq: 660, start: 0, duration: 0.18 }];

    for (const note of notes) {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = note.freq;
      const t0 = ctx.currentTime + note.start;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.35, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + note.duration);
      osc.start(t0);
      osc.stop(t0 + note.duration + 0.05);
    }
  };

  try {
    if (ctx.state === "suspended") {
      ctx.resume().then(run).catch(() => {});
    } else {
      run();
    }
  } catch {
    // Silent fallback — never crash the UI
  }
}

// ─── Browser Notifications ────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function showBrowserNotification(title: string, body: string): void {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      icon:  "/favicon.ico",
      badge: "/favicon.ico",
      // FIX: unique tag per notification so rapid events don't replace each other
      tag:      `oasis-${Date.now()}`,
      renotify: false,
    });
  } catch { /* Firefox private mode etc. */ }
}

// ─── Toast queue types ────────────────────────────────────────────────────────

export interface ToastNotification {
  id:        string;
  type:      AlertType;
  title:     string;
  body:      string;
  createdAt: number;
}

let _toastId = 0;
export function makeToast(type: AlertType, title: string, body: string): ToastNotification {
  return { id: String(++_toastId), type, title, body, createdAt: Date.now() };
}

// ─── Icon/colour map for toast UI ─────────────────────────────────────────────

export const ALERT_CONFIG: Record<AlertType, { label: string; bg: string; border: string; icon: string }> = {
  new_booking:     { label: "New Booking",     bg: "bg-orange-50 dark:bg-orange-950/40",  border: "border-orange-400", icon: "🔔" },
  booking_updated: { label: "Booking Updated", bg: "bg-blue-50 dark:bg-blue-950/40",      border: "border-blue-400",   icon: "📋" },
  job_assigned:    { label: "New Job Assigned", bg: "bg-green-50 dark:bg-green-950/40",   border: "border-green-500",  icon: "🚗" },
  job_updated:     { label: "Job Updated",      bg: "bg-amber-50 dark:bg-amber-950/40",   border: "border-amber-400",  icon: "🔄" },
};
