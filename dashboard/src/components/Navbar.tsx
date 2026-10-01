import React from "react";
import {
  Activity,
  ShieldAlert,
  Clock,
  Server,
  BarChart3,
  Film,
  Wifi,
  WifiOff
} from "lucide-react";

export type TabKey =
  | "live-feed"
  | "approvals"
  | "servers-tools"
  | "security-events"
  | "analytics"
  | "session-replay";

interface NavbarProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  pendingApprovalsCount: number;
  securityAlertsCount: number;
  isLiveConnected: boolean;
  onRefresh: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  pendingApprovalsCount,
  securityAlertsCount,
  isLiveConnected,
  onRefresh
}) => {
  const tabs: Array<{
    key: TabKey;
    label: string;
    icon: React.ReactNode;
    badge?: number;
    badgeColor?: string;
  }> = [
    {
      key: "live-feed",
      label: "Live Feed",
      icon: <Activity className="w-4 h-4" />
    },
    {
      key: "approvals",
      label: "Approvals Queue",
      icon: <Clock className="w-4 h-4" />,
      badge: pendingApprovalsCount,
      badgeColor: "bg-amber-500/20 text-amber-300 border border-amber-500/30"
    },
    {
      key: "servers-tools",
      label: "Servers & Tools",
      icon: <Server className="w-4 h-4" />
    },
    {
      key: "security-events",
      label: "Security Events",
      icon: <ShieldAlert className="w-4 h-4" />,
      badge: securityAlertsCount > 0 ? securityAlertsCount : undefined,
      badgeColor: "bg-rose-500/20 text-rose-300 border border-rose-500/30"
    },
    {
      key: "analytics",
      label: "Analytics",
      icon: <BarChart3 className="w-4 h-4" />
    },
    {
      key: "session-replay",
      label: "Session Replay",
      icon: <Film className="w-4 h-4" />
    }
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-400/40">
              <span className="font-mono font-bold text-white text-lg">W</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white">WARDEN</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-mono">
                  MCP GATEWAY
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Policy Enforcement • Semantic Router • Security Scanner
              </p>
            </div>
          </div>

          {/* Status & Indicators */}
          <div className="flex items-center gap-4">
            <button
              onClick={onRefresh}
              title="Click to check live backend connection"
              className="flex items-center gap-2 px-2.5 py-1 rounded-full text-xs bg-slate-800/80 border border-slate-700 hover:border-slate-600 transition-colors"
            >
              {isLiveConnected ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 font-medium">Gateway Live</span>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400 ml-0.5" />
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-slate-300 font-medium">Mock Mode (Offline Fallback)</span>
                  <WifiOff className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
                </>
              )}
            </button>

            <div className="hidden md:flex items-center gap-3 pl-2 border-l border-slate-800 text-xs font-mono text-slate-400">
              <div>
                <span className="text-slate-500">Router P50: </span>
                <span className="text-cyan-400 font-semibold">0.34ms</span>
              </div>
              <div>
                <span className="text-slate-500">Token Red.: </span>
                <span className="text-emerald-400 font-semibold">96.6%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex space-x-1 sm:space-x-2 -mb-px overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onSelectTab(tab.key)}
                className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-all ${
                  isActive
                    ? "border-cyan-500 text-cyan-400 bg-cyan-950/20"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 text-[11px] font-mono rounded-full font-bold ${tab.badgeColor}`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
