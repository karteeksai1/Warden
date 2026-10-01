import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  RefreshCw,
  Play,
  Pause,
  Clock,
  Coins,
  ShieldCheck,
  ShieldAlert
} from "lucide-react";
import type { PolicyDecision, TraceRecord } from "../types.js";
import { api } from "../services/api.js";

export const LiveFeed: React.FC = () => {
  const [traces, setTraces] = useState<TraceRecord[]>([]);
  const [filterDecision, setFilterDecision] = useState<"all" | PolicyDecision>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLiveActive, setIsLiveActive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTraces = async () => {
    setIsLoading(true);
    const data = await api.getTraces();
    setTraces(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTraces();
  }, []);

  // Periodic simulation or poll when live toggle is on
  useEffect(() => {
    if (!isLiveActive) return;

    const interval = setInterval(() => {
      fetchTraces();
    }, 4000);

    return () => clearInterval(interval);
  }, [isLiveActive]);

  const filteredTraces = traces.filter((trace) => {
    if (filterDecision !== "all" && trace.policyDecision !== filterDecision) {
      return false;
    }
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const matchName = trace.toolName.toLowerCase().includes(q);
      const matchSession = trace.sessionId.toLowerCase().includes(q);
      const matchAgent = trace.agentName.toLowerCase().includes(q);
      return matchName || matchSession || matchAgent;
    }
    return true;
  });

  const getDecisionBadge = (decision: PolicyDecision) => {
    switch (decision) {
      case "allow":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            ALLOW
          </span>
        );
      case "require_approval":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            REQUIRE APPROVAL
          </span>
        );
      case "deny":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5" />
            DENY
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Action & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search tool, session ID, or agent..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700/80 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-700/80 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Policy:</span>
            <select
              value={filterDecision}
              onChange={(e) => setFilterDecision(e.target.value as any)}
              className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">All Decisions</option>
              <option value="allow" className="bg-slate-900">Allowed Only</option>
              <option value="require_approval" className="bg-slate-900">Pending Approvals</option>
              <option value="deny" className="bg-slate-900">Denied Only</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLiveActive(!isLiveActive)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isLiveActive
                ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/40 hover:bg-cyan-500/20"
                : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
            }`}
          >
            {isLiveActive ? (
              <>
                <Pause className="w-3.5 h-3.5" /> Pause Feed
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" /> Resume Feed
              </>
            )}
          </button>

          <button
            onClick={fetchTraces}
            disabled={isLoading}
            className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Refresh traces"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Stream Table */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-semibold text-slate-200">Live Proxy Ingress & Governance Stream</span>
            <span>({filteredTraces.length} events logged)</span>
          </div>
          <span className="font-mono text-slate-500">Auto-refresh: 4s</span>
        </div>

        <div className="divide-y divide-slate-800">
          {filteredTraces.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No matching tool calls found for current filter.
            </div>
          ) : (
            filteredTraces.map((trace) => {
              const isExpanded = expandedId === trace.id;
              const hasPii = (trace.scannerVerdict?.piiMatches?.length ?? 0) > 0;
              const isInjection = !(trace.scannerVerdict?.isClean ?? true);

              return (
                <div key={trace.id} className="transition-colors hover:bg-slate-850/50">
                  {/* Summary Row */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : trace.id)}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none"
                  >
                    <div className="flex items-start md:items-center gap-3">
                      <div className="mt-0.5 md:mt-0">
                        {getDecisionBadge(trace.policyDecision)}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-white text-sm">
                            {trace.toolName}
                          </span>
                          {hasPii && (
                            <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              PII MASKED
                            </span>
                          )}
                          {isInjection && (
                            <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              INJECTION FLAGGED
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-3 mt-1 font-mono">
                          <span>Session: {trace.sessionId}</span>
                          <span>•</span>
                          <span>Agent: {trace.agentName}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono text-slate-400 self-end md:self-auto">
                      <div className="flex items-center gap-1" title="Proxy & Downstream Latency">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span className={trace.latencyMs > 50 ? "text-amber-400" : "text-slate-300"}>
                          {trace.latencyMs}ms
                        </span>
                      </div>

                      <div className="flex items-center gap-1" title="Prompt Tokens In / Out">
                        <Coins className="w-3.5 h-3.5 text-slate-500" />
                        <span>{trace.tokensIn} in / {trace.tokensOut} out</span>
                      </div>

                      <span className="text-slate-500">
                        {new Date(trace.createdAt).toLocaleTimeString()}
                      </span>

                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 bg-slate-950/60 border-t border-slate-800/80">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
                        {/* Arguments Inspector */}
                        <div className="rounded-lg bg-slate-900 border border-slate-800 p-3">
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs text-slate-400 font-mono">
                            <span className="font-semibold text-slate-200">Input Arguments (Raw)</span>
                            <span>SHA-256 Validated</span>
                          </div>
                          <pre className="text-xs font-mono text-slate-300 overflow-x-auto max-h-48 p-2 rounded bg-slate-950">
                            {JSON.stringify(trace.arguments, null, 2)}
                          </pre>
                        </div>

                        {/* Result / Policy Decision Details */}
                        <div className="rounded-lg bg-slate-900 border border-slate-800 p-3">
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs text-slate-400 font-mono">
                            <span className="font-semibold text-slate-200">
                              {trace.policyDecision === "deny" ? "Error Payload" : "Downstream Response"}
                            </span>
                            <span>Status: {trace.policyDecision.toUpperCase()}</span>
                          </div>
                          <pre className="text-xs font-mono text-slate-300 overflow-x-auto max-h-48 p-2 rounded bg-slate-950">
                            {JSON.stringify(trace.result ?? { status: "denied" }, null, 2)}
                          </pre>
                        </div>
                      </div>

                      {/* Scanner & Policy Inspection Footer */}
                      <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-medium">Policy Reason:</span>
                          <span className="text-slate-200 font-mono">
                            {trace.policyReason || "Deterministic Rule Evaluation"}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          {trace.scannerVerdict?.isClean ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-mono">
                              <ShieldCheck className="w-3.5 h-3.5" /> Scanner Clean
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-400 font-mono">
                              <ShieldAlert className="w-3.5 h-3.5" /> Flags: {trace.scannerVerdict?.flags?.join(", ")}
                            </span>
                          )}

                          {hasPii && (
                            <span className="text-purple-300 font-mono">
                              Redactions: {trace.scannerVerdict?.piiMatches?.join("; ")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
