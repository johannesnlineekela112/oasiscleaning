/**
 * AdminAnalytics.tsx
 *
 * Analytics section container for the Admin Dashboard.
 * Renders as a full-page section with its own three-tab nav:
 *   Overview | Team Performance | Demand Map
 *
 * This component is rendered by AdminDashboard when tab === "analytics".
 * It is self-contained: data loading, error handling, and tab state
 * all live inside here so AdminDashboard stays lean.
 */

import { useState } from "react";
import { BarChart2, Users, Map } from "lucide-react";
import { AnalyticsOverview } from "./analytics/AnalyticsOverview";
import { TeamPerformance }   from "./analytics/TeamPerformance";
import { DemandMap }         from "./analytics/DemandMap";

type AnalyticsTab = "overview" | "team" | "map";

const TABS: { key: AnalyticsTab; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview",         icon: BarChart2 },
  { key: "team",     label: "Team Performance", icon: Users     },
  { key: "map",      label: "Demand Map",        icon: Map       },
];

export function AdminAnalytics() {
  const [active, setActive] = useState<AnalyticsTab>("overview");

  return (
    <div className="space-y-4">
      {/* Sub-nav */}
      <div className="flex items-center gap-1 bg-muted/60 rounded-xl p-1 w-fit">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition
                ${active === t.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab panels */}
      {active === "overview" && <AnalyticsOverview />}
      {active === "team"     && <TeamPerformance />}
      {active === "map"      && <DemandMap />}
    </div>
  );
}
