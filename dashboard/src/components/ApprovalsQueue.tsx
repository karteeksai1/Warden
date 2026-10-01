import React, { useState, useEffect } from "react";
import {
  Check,
  X,
  AlertTriangle,
  Clock,
  User,
  CheckCircle,
  XCircle,
  RefreshCw
} from "lucide-react";
import type { ApprovalRecord, ApprovalStatus } from "../types.js";
import { api } from "../services/api.js";

export const ApprovalsQueue: React.FC = () => {
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [activeTab, setActiveTab] = useState<ApprovalStatus | "all">("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchApprovals = async () => {
    setIsLoading(true);
    const data = await api.getApprovals();
    setApprovals(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  const handleDecision = async (id: string, decision: "approved" | "rejected") => {
    try {
      setProcessingId(id);
      await api.decideApproval(id, decision);
      setActionMessage(
        decision === "approved"
          ? `Approval request ${id} approved. Gateway executed downstream call with verified SHA-256 hash.`
          : `Approval request ${id} rejected.`
      );
      await fetchApprovals();
      setTimeout(() => setActionMessage(null), 5000);
    } catch (error) {
      setActionMessage(`Failed to process decision: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredApprovals = approvals.filter((appr) => {
    if (activeTab === "all") return true;
    return appr.status === activeTab;
  });

  const pendingCount = approvals.filter((a) => a.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Header & Status Notification */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            Human-in-the-Loop Governance & Approvals
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic policies require human sign-off on sensitive financial and operational tool calls.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            {(["pending", "approved", "rejected", "all"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-md font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab} {tab === "pending" && pendingCount > 0 && `(${pendingCount})`}
              </button>
            ))}
          </div>

          <button
            onClick={fetchApprovals}
            disabled={isLoading}
            className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white"
            title="Refresh approvals"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 text-xs flex items-center justify-between animate-fadeIn">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-cyan-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Approvals Cards Grid */}
      <div className="grid grid-cols-1 gap-4">
        {filteredApprovals.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-12 text-center text-slate-500 text-sm">
            No approval requests found for category: <span className="font-semibold text-slate-300">{activeTab}</span>.
          </div>
        ) : (
          filteredApprovals.map((appr) => {
            const isPending = appr.status === "pending";
            const isProcessing = processingId === appr.id;

            return (
              <div
                key={appr.id}
                className={`rounded-xl border p-5 transition-all shadow-lg ${
                  isPending
                    ? "bg-slate-900/80 border-amber-500/40 hover:border-amber-500/70"
                    : "bg-slate-900/40 border-slate-800"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg mt-0.5 ${
                        appr.status === "approved"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : appr.status === "rejected"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {appr.status === "approved" ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : appr.status === "rejected" ? (
                        <XCircle className="w-5 h-5" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 animate-pulse" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-base">
                          {appr.toolName}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-mono font-semibold uppercase ${
                            appr.status === "approved"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : appr.status === "rejected"
                              ? "bg-rose-500/20 text-rose-300"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          {appr.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-400 font-mono">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          {appr.agentName}
                        </span>
                        <span>•</span>
                        <span>Session: {appr.sessionId}</span>
                        <span>•</span>
                        <span>ID: {appr.id}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right side actions */}
                  {isPending ? (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleDecision(appr.id, "rejected")}
                        disabled={isProcessing}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/40 hover:bg-rose-500/20 font-medium text-xs transition-colors disabled:opacity-50"
                      >
                        <X className="w-4 h-4" /> Reject
                      </button>
                      <button
                        onClick={() => handleDecision(appr.id, "approved")}
                        disabled={isProcessing}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-lg shadow-emerald-600/30 transition-colors disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" /> Approve & Execute
                      </button>
                    </div>
                  ) : (
                    <div className="text-right text-xs font-mono text-slate-400">
                      <div>Decided by: <span className="text-slate-200">{appr.decidedBy ?? "Admin"}</span></div>
                      <div>At: {appr.decidedAt ? new Date(appr.decidedAt).toLocaleString() : "N/A"}</div>
                    </div>
                  )}
                </div>

                {/* Reason & Trigger Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-xs">
                  <div className="rounded-lg bg-slate-950/70 p-3 border border-slate-800">
                    <span className="text-slate-500 font-mono uppercase text-[10px] block mb-1">
                      Policy Rule Violation / Trigger Reason
                    </span>
                    <p className="text-amber-300 font-medium">{appr.riskReason}</p>
                    <p className="text-slate-400 font-mono text-[11px] mt-1">{appr.policyRule}</p>
                  </div>

                  <div className="rounded-lg bg-slate-950/70 p-3 border border-slate-800">
                    <span className="text-slate-500 font-mono uppercase text-[10px] block mb-1 flex items-center justify-between">
                      <span>Argument SHA-256 Hash Integrity</span>
                      <span className="text-emerald-400">Deterministic Guard</span>
                    </span>
                    <p className="font-mono text-slate-300 text-[11px] truncate" title={appr.argumentsHash}>
                      {appr.argumentsHash}
                    </p>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>Expires: {new Date(appr.expiresAt).toLocaleTimeString()} (24h TTL)</span>
                    </div>
                  </div>
                </div>

                {/* Arguments Payload Inspector */}
                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  <span className="text-[11px] font-mono text-slate-400 block mb-1">
                    Canonical Arguments Payload
                  </span>
                  <pre className="p-3 rounded-lg bg-slate-950 font-mono text-xs text-slate-200 border border-slate-800/80 overflow-x-auto">
                    {JSON.stringify(appr.arguments, null, 2)}
                  </pre>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
