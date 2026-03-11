import {
  BarChart2, ClipboardList, History, CreditCard, Zap, Award,
  Users, Settings, ReceiptText, BookOpen, Megaphone, ShieldCheck,
  Calendar, Clock, CheckCircle, DollarSign, X,
} from "lucide-react";

export type AdminTab =
  | "bookings" | "history" | "employees" | "settings" | "payouts"
  | "about" | "ads" | "loyalty" | "security" | "audit"
  | "analytics" | "payments" | "subscriptions";

interface Props {
  tab: AdminTab;
  setTab: (t: AdminTab) => void;
  stats: { total: number; pending: number; confirmed: number; revenue: number };
  isOpen: boolean;
  onToggle: () => void;
}

const GROUPS: { label: string; items: { key: AdminTab; label: string; icon: any }[] }[] = [
  {
    label: "Operations",
    items: [
      { key: "bookings",  label: "Bookings",  icon: ClipboardList },
      { key: "history",   label: "History",   icon: History },
      { key: "payments",  label: "Payments",  icon: CreditCard },
    ],
  },
  {
    label: "Revenue",
    items: [
      { key: "analytics",     label: "Analytics",     icon: BarChart2 },
      { key: "subscriptions", label: "Subscriptions", icon: Zap },
      { key: "loyalty",       label: "Loyalty",       icon: Award },
      { key: "payouts",       label: "Payouts",       icon: ReceiptText },
    ],
  },
  {
    label: "Team",
    items: [
      { key: "employees", label: "Staff",    icon: Users },
      { key: "settings",  label: "Settings", icon: Settings },
    ],
  },
  {
    label: "Content",
    items: [
      { key: "about", label: "About & Legal", icon: BookOpen },
      { key: "ads",   label: "Marketing",     icon: Megaphone },
    ],
  },
  {
    label: "System",
    items: [
      { key: "security", label: "Security",  icon: ShieldCheck },
      { key: "audit",    label: "Audit Log", icon: ClipboardList },
    ],
  },
];

export default function AdminSidebar({ tab, setTab, stats, isOpen, onToggle }: Props) {
  const handleNavClick = (key: AdminTab) => {
    setTab(key);
    // Close sidebar on mobile after selection
    if (window.innerWidth < 1024) onToggle();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed top-[52px] left-0 z-50
          lg:static lg:top-auto lg:z-auto
          w-[240px] shrink-0
          h-[calc(100vh-52px)] lg:h-full
          bg-primary text-primary-foreground
          border-r border-white/10
          flex flex-col
          transition-transform duration-300 ease-out
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* ── Compact KPI strip ─────────────────────────────────── */}
        <div className="shrink-0 px-3 py-3 border-b border-white/10 grid grid-cols-2 gap-2">
          {[
            { label: "Total",   value: stats.total,              icon: Calendar,     color: "text-blue-300" },
            { label: "Pending", value: stats.pending,            icon: Clock,        color: "text-amber-400" },
            { label: "Active",  value: stats.confirmed,          icon: CheckCircle,  color: "text-emerald-400" },
            { label: "Revenue", value: `N$${stats.revenue}`,     icon: DollarSign,   color: "text-secondary" },
          ].map(s => (
            <div key={s.label} className="bg-white/5 rounded-lg px-2.5 py-2 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <s.icon className={`w-3 h-3 ${s.color} shrink-0`} />
                <span className="text-[9px] font-bold text-white/40 uppercase tracking-wide truncate">{s.label}</span>
              </div>
              <p className={`text-sm font-bold truncate ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Navigation groups ─────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 scrollbar-none">
          {GROUPS.map((group) => (
            <div key={group.label} className="mb-1">
              <p className="text-[9px] font-bold text-white/25 uppercase tracking-widest px-3 py-2">
                {group.label}
              </p>
              {group.items.map(item => {
                const active = tab === item.key;
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => handleNavClick(item.key)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5
                      text-sm font-semibold transition-all text-left
                      ${active
                        ? "bg-secondary text-white shadow-sm"
                        : "text-white/55 hover:text-white/90 hover:bg-white/8"
                      }
                    `}
                  >
                    <Icon className="w-[15px] h-[15px] shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {active && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/70 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* ── Mobile close button ───────────────────────────────── */}
        <button
          onClick={onToggle}
          className="lg:hidden shrink-0 flex items-center gap-2 px-4 py-3 text-xs text-white/40 hover:text-white/70 border-t border-white/10 transition"
        >
          <X className="w-3.5 h-3.5" /> Close menu
        </button>
      </aside>
    </>
  );
}
