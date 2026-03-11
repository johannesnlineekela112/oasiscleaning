/**
 * NotificationToast.tsx
 *
 * Stacking toast queue for booking alerts.
 * Used by both AdminDashboard and EmployeeDashboard.
 *
 * Usage:
 *   const { toasts, pushToast, dismissToast } = useToastQueue();
 *   <NotificationToastStack toasts={toasts} onDismiss={dismissToast} />
 */

import { useEffect, useRef } from "react";
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, Car, RefreshCw, ClipboardList } from "lucide-react";
import {
  ToastNotification, AlertType, ALERT_CONFIG,
  playAlert, showBrowserNotification, makeToast,
  requestNotificationPermission,
} from "@/lib/notificationService";

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToastQueue() {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const permAsked = useRef(false);

  // Ask for browser notification permission once on mount
  useEffect(() => {
    if (permAsked.current) return;
    permAsked.current = true;
    requestNotificationPermission().catch(() => {});
  }, []);

  const pushToast = useCallback((type: AlertType, title: string, body: string) => {
    const toast = makeToast(type, title, body);
    setToasts(prev => [toast, ...prev].slice(0, 5)); // keep at most 5
    playAlert(type);
    showBrowserNotification(title, body);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Auto-dismiss after 7 s
  useEffect(() => {
    if (!toasts.length) return;
    const oldest = toasts[toasts.length - 1];
    const age    = Date.now() - oldest.createdAt;
    const delay  = Math.max(0, 7000 - age);
    const t = setTimeout(() => dismissToast(oldest.id), delay);
    return () => clearTimeout(t);
  }, [toasts, dismissToast]);

  return { toasts, pushToast, dismissToast };
}

// ─── Icon map ─────────────────────────────────────────────────────────────────
function ToastIcon({ type }: { type: AlertType }) {
  const cls = "w-5 h-5 shrink-0";
  if (type === "new_booking")     return <Bell className={cls} />;
  if (type === "job_assigned")    return <Car  className={cls} />;
  if (type === "booking_updated") return <ClipboardList className={cls} />;
  return <RefreshCw className={cls} />;
}

// ─── Stack component ──────────────────────────────────────────────────────────
export function NotificationToastStack({
  toasts,
  onDismiss,
}: {
  toasts:    ToastNotification[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 360 }}>
      <AnimatePresence initial={false}>
        {toasts.map(toast => {
          const cfg = ALERT_CONFIG[toast.type];
          return (
            <motion.div
              key={toast.id}
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0,   opacity: 1 }}
              exit={{   x: 100,  opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className={`pointer-events-auto w-full rounded-xl border-l-4 shadow-lg px-4 py-3 flex items-start gap-3 ${cfg.bg} ${cfg.border}`}
            >
              {/* Icon */}
              <span className="text-xl leading-none mt-0.5">{cfg.icon}</span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground leading-tight">{toast.title}</p>
                <p className="text-xs text-foreground/70 font-medium mt-0.5 leading-snug">{toast.body}</p>
              </div>

              {/* Dismiss */}
              <button
                onClick={() => onDismiss(toast.id)}
                className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full hover:bg-black/10 transition text-foreground/50 hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
