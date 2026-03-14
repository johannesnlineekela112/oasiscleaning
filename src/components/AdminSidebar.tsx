/**
 * AdminSidebar.tsx
 *
 * Vertical navigation sidebar for the Admin Dashboard.
 * Collapsible on mobile, always-visible on large screens.
 * Passes all tab switching through the existing Tab state — no logic changes.
 */

import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart2, ClipboardList, History, CreditCard, Zap, Award,
  Users, Settings, ReceiptText, BookOpen, Megaphone, ShieldCheck,
  FileText, X, Calendar, Clock, DollarSign, CheckCircle, LayoutDashboard,
} from "lucide-react";

type Tab =
  | "overview" | "analytics" | "bookings" | "history" | "payments"
  | "subscriptions" | "loyalty" | "employees" | "settings"
  | "payouts" | "about" | "ads" | "security" | "audit";

interface SidebarStats {
  total:     number;
  pending:   number;
  confirmed: number;
  revenue:   number;
}

interface AdminSidebarProps {
  tab:      Tab;
  setTab:   (t: Tab) => void;
  stats:    SidebarStats;
  isOpen:   boolean;
  onToggle: () => void;
}

const NAV_ITEMS: { key: Tab; label: string; icon: any; group?: string }[] = [
  // ── Overview
  { key: "overview",      label: "Overview",      icon: LayoutDashboard, group: "Overview" },
  { key: "analytics",     label: "Analytics",     icon: BarChart2,     group: "Overview" },
  // ── Operations
  { key: "bookings",      label: "Bookings",       icon: ClipboardList, group: "Operations" },
  { key: "history",       label: "History",        icon: History,       group: "Operations" },
  { key: "payments",      label: "Payments",       icon: CreditCard,    group: "Operations" },
  { key: "subscriptions", label: "Subscriptions",  icon: Zap,           group: "Operations" },
  // ── People
  { key: "loyalty",       label: "Loyalty",        icon: Award,         group: "People" },
  { key: "employees",     label: "Staff",          icon: Users,         group: "People" },
  // ── Finance
  { key: "payouts",       label: "Payouts",        icon: ReceiptText,   group: "Finance" },
  // ── Platform
  { key: "settings",      label: "Services",       icon: Settings,      group: "Platform" },
  { key: "ads",           label: "Marketing",      icon: Megaphone,     group: "Platform" },
  { key: "about",         label: "About & Legal",  icon: BookOpen,      group: "Platform" },
  // ── System
  { key: "security",      label: "Security",       icon: ShieldCheck,   group: "System" },
  { key: "audit",         label: "Audit Log",      icon: FileText,      group: "System" },
];

// Group headers shown in sidebar
const GROUPS = ["Overview", "Operations", "People", "Finance", "Platform", "System"];

export default function AdminSidebar({ tab, setTab, stats, isOpen, onToggle }: AdminSidebarProps) {
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* ── Stats mini-strip ──────────────────────────────────────── */}
      <div className="px-3 py-3 border-b border-border/60 space-y-1.5 shrink-0">
        {[
          { label: "Bookings",  value: stats.total,     icon: Calendar,    color: "text-primary" },
          { label: "Pending",   value: stats.pending,   icon: Clock,       color: "text-orange-500" },
          { label: "Active",    value: stats.confirmed, icon: CheckCircle, color: "text-blue-500" },
          { label: "Revenue",   value: `N$${stats.revenue}`, icon: DollarSign,  color: "text-green-600" },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-2 px-1.5 py-1.5 rounded-lg bg-muted/50">
            <s.icon className={`w-3.5 h-3.5 shrink-0 ${s.color}`} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none">{s.label}</p>
              <p className="text-sm font-display font-bold leading-tight text-foreground">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Navigation ────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {GROUPS.map(group => {
          const items = NAV_ITEMS.filter(i => i.group === group);
          return (
            <div key={group} className="mb-1">
              <p className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 select-none">
                {group}
              </p>
              {items.map(item => (
                <button
                  key={item.key}
                  onClick={() => { setTab(item.key); onToggle(); /* close mobile */ }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all mb-0.5 ${
                    tab === item.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* ── Desktop sidebar (always visible on lg+) ───────────────── */}
      <aside className="hidden lg:flex w-52 xl:w-56 shrink-0 flex-col bg-card border-r border-border overflow-hidden">
        <SidebarContent />
      </aside>

      {/* ── Mobile drawer (overlay) ───────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={onToggle}
              className="lg:hidden fixed inset-0 z-40 bg-black/50"
            />
            {/* Drawer */}
            <motion.aside
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border shadow-2xl flex flex-col"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <p className="font-display font-bold text-sm">Navigation</p>
                <button
                  onClick={onToggle}
                  className="p-1.5 rounded-lg hover:bg-muted transition text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <SidebarContent />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
