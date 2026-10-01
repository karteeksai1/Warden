import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  Eye,
  Filter,
  Search,
  RefreshCw,
  X
} from "lucide-react";
import type { SecurityEvent, SeverityLevel } from "../types.js";
import { api } from "../services/api.js";

export const SecurityEvents: React.FC = () => {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [selectedSeverity, setSelectedSeverity] = useState<"all" | SeverityLevel>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [inspectEvent, setInspectEvent] = useState<SecurityEvent | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchEvents = async () => {
    setIsLoading(true);
    const data = await api.getSecurityEvents();
    setEvents(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const getSeverityBadge = (severity: SeverityLevel) => {
    switch (severity) {
      case "CRITICAL":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
            CRITICAL
          </span>
        );
      case "HIGH":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-orange-500/20 text-orange-300 border border-orange-500/40">
            HIGH
          </span>
        );
      case "MEDIUM":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            MEDIUM
          </span>
        );
      case "LOW":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
            LOW
          </span>
        );
    }
  };

  const getActionBadge = (action: SecurityEvent["actionTaken"]) => {
    switch (action) {
      case "blocked":
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            BLOCKED
          </span>
        );
      case "redacted":
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30">
            REDACTED
          </span>
        );
      case "quarantined":
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
            QUARANTINED
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-slate-800 text-slate-400">
            ALERTED
          </span>
        );
    }
  };

  const filteredEvents = events.filter((ev) => {
    if (selectedSeverity !== "all" && ev.severity !== selectedSeverity) return false;
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      return (
        ev.summary.toLowerCase().includes(q) ||
        ev.payloadSnippet.toLowerCase().includes(q) ||
        (ev.targetTool?.toLowerCase().includes(q) ?? false) ||
        ev.agentName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            Security Scanner Audit Trail & Defenses
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time interception of prompt injection, description poisoning, PII leakage, and schema mutations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search incidents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-44"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Severity:</span>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value as any)}
              className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">All Levels</option>
              <option value="CRITICAL" className="bg-slate-900">Critical Only</option>
              <option value="HIGH" className="bg-slate-900">High Only</option>
              <option value="MEDIUM" className="bg-slate-900">Medium Only</option>
              <option value="LOW" className="bg-slate-900">Low Only</option>
            </select>
          </div>

          <button
            onClick={fetchEvents}
            disabled={isLoading}
            className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white"
            title="Refresh events"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Events List */}
      <div className="grid grid-cols-1 gap-3">
        {filteredEvents.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-12 text-center text-slate-500 text-sm">
            No security events found matching current criteria.
          </div>
        ) : (
          filteredEvents.map((ev) => (
            <div
              key={ev.id}
              className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3 flex-1">
                <div className="mt-1">
                  {getSeverityBadge(ev.severity)}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-white">
                      {ev.summary}
                    </span>
                    {getActionBadge(ev.actionTaken)}
                  </div>

                  <p className="text-xs font-mono text-slate-300 mt-1 bg-slate-950/80 p-2 rounded border border-slate-800/80">
                    {ev.payloadSnippet}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-400 font-mono">
                    <span>Tool: <strong className="text-slate-200">{ev.targetTool ?? "N/A"}</strong></span>
                    <span>•</span>
                    <span>Agent: {ev.agentName}</span>
                    <span>•</span>
                    <span>Session: {ev.sessionId}</span>
                    <span>•</span>
                    <span>{new Date(ev.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>

              <div className="self-end md:self-center">
                <button
                  onClick={() => setInspectEvent(ev)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" /> Details
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Security Event Detail Modal */}
      {inspectEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setInspectEvent(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <ShieldAlert className="w-6 h-6 text-rose-400" />
              <div>
                <h3 className="text-base font-bold text-white">{inspectEvent.summary}</h3>
                <span className="text-xs font-mono text-slate-400">ID: {inspectEvent.id}</span>
              </div>
            </div>

            <div className="space-y-4 my-4 text-xs font-sans">
              <div className="grid grid-cols-2 gap-3 font-mono">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block mb-0.5">Severity</span>
                  {getSeverityBadge(inspectEvent.severity)}
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block mb-0.5">Action Taken</span>
                  {getActionBadge(inspectEvent.actionTaken)}
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-mono block mb-1">Payload Snippet / Trigger</span>
                <pre className="p-3 bg-slate-950 rounded-lg text-rose-300 font-mono text-xs border border-slate-800 overflow-x-auto">
                  {inspectEvent.payloadSnippet}
                </pre>
              </div>

              {inspectEvent.details?.matchedPatterns && (
                <div>
                  <span className="text-slate-400 font-mono block mb-1">Matched Rule Signatures</span>
                  <ul className="list-disc pl-5 text-slate-300 space-y-1">
                    {inspectEvent.details.matchedPatterns.map((pat, idx) => (
                      <li key={idx} className="font-mono">{pat}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setInspectEvent(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
