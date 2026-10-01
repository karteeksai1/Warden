import React, { useState, useEffect } from "react";
import { Navbar, type TabKey } from "./components/Navbar.js";
import { LiveFeed } from "./components/LiveFeed.js";
import { ApprovalsQueue } from "./components/ApprovalsQueue.js";
import { ServersTools } from "./components/ServersTools.js";
import { SecurityEvents } from "./components/SecurityEvents.js";
import { Analytics } from "./components/Analytics.js";
import { SessionReplay } from "./components/SessionReplay.js";
import { api } from "./services/api.js";

const VALID_TABS: TabKey[] = [
  "live-feed",
  "approvals",
  "servers-tools",
  "security-events",
  "analytics",
  "session-replay"
];

function getInitialTab(): TabKey {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab") as TabKey;
    if (tabParam && VALID_TABS.includes(tabParam)) {
      return tabParam;
    }
    const hash = window.location.hash.replace("#", "") as TabKey;
    if (hash && VALID_TABS.includes(hash)) {
      return hash;
    }
  }
  return "live-feed";
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>(getInitialTab);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(2);
  const [securityAlertsCount, setSecurityAlertsCount] = useState(3);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  const handleSelectTab = (tab: TabKey) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.pushState({}, "", url.toString());
    }
  };

  const checkStatus = async () => {
    const health = await api.checkGatewayHealth();
    setIsLiveConnected(health.online);

    const [approvals, events] = await Promise.all([
      api.getApprovals(),
      api.getSecurityEvents()
    ]);
    setPendingApprovalsCount(approvals.filter((a) => a.status === "pending").length);
    setSecurityAlertsCount(events.filter((e) => e.severity === "CRITICAL" || e.severity === "HIGH").length);
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000);

    const onPopState = () => {
      setActiveTab(getInitialTab());
    };
    window.addEventListener("popstate", onPopState);

    return () => {
      clearInterval(interval);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        pendingApprovalsCount={pendingApprovalsCount}
        securityAlertsCount={securityAlertsCount}
        isLiveConnected={isLiveConnected}
        onRefresh={checkStatus}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === "live-feed" && <LiveFeed />}
        {activeTab === "approvals" && <ApprovalsQueue />}
        {activeTab === "servers-tools" && <ServersTools />}
        {activeTab === "security-events" && <SecurityEvents />}
        {activeTab === "analytics" && <Analytics />}
        {activeTab === "session-replay" && <SessionReplay />}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Warden MCP Gateway v0.1.0 • Enterprise Agent Governance & Security</span>
          <span>
            Mode:{" "}
            <span className={isLiveConnected ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
              {isLiveConnected ? "Live Connected" : "Local Mock Fallback"}
            </span>
          </span>
        </div>
      </footer>
    </div>
  );
};

export default App;
