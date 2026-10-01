import {
  MOCK_ANALYTICS,
  MOCK_APPROVALS,
  MOCK_SECURITY_EVENTS,
  MOCK_SERVERS,
  MOCK_SESSION_REPLAYS,
  MOCK_TOOLS,
  MOCK_TRACES
} from "./mockData.js";
import type {
  AnalyticsSummary,
  ApprovalRecord,
  SecurityEvent,
  ServerRecord,
  SessionReplayData,
  ToolItem,
  TraceRecord
} from "../types.js";

// In-memory mutable state initialized from mock data
let localTraces: TraceRecord[] = [...MOCK_TRACES];
let localApprovals: ApprovalRecord[] = [...MOCK_APPROVALS];
let localServers: ServerRecord[] = [...MOCK_SERVERS];
let localTools: ToolItem[] = [...MOCK_TOOLS];
let localSecurityEvents: SecurityEvent[] = [...MOCK_SECURITY_EVENTS];
const localAnalytics: AnalyticsSummary = { ...MOCK_ANALYTICS };
const localSessions: Record<string, SessionReplayData> = { ...MOCK_SESSION_REPLAYS };

export const api = {
  // Check if live backend gateway is online
  async checkGatewayHealth(): Promise<{ online: boolean; version?: string; toolsCount?: number }> {
    try {
      const res = await fetch("/health", { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        const data = await res.json();
        return { online: true, version: data.version, toolsCount: data.tools_count };
      }
    } catch {
      // Fallback
    }
    return { online: false };
  },

  // Traces / Live Feed
  async getTraces(): Promise<TraceRecord[]> {
    try {
      const res = await fetch("/api/traces", { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return [...localTraces];
  },

  // Add new synthetic trace (for live feed testing/simulation)
  async pushSimulatedTrace(trace: TraceRecord): Promise<void> {
    localTraces = [trace, ...localTraces];
  },

  // Approvals Queue
  async getApprovals(): Promise<ApprovalRecord[]> {
    try {
      const res = await fetch("/api/approvals", { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return [...localApprovals];
  },

  async decideApproval(
    approvalId: string,
    decision: "approved" | "rejected",
    decidedBy: string = "admin@warden.dev"
  ): Promise<ApprovalRecord> {
    try {
      const res = await fetch(`/api/approvals/${approvalId}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, decidedBy })
      });
      if (res.ok) {
        const updated = await res.json();
        localApprovals = localApprovals.map((a) => (a.id === approvalId ? updated : a));
        return updated;
      }
    } catch {
      // Fallback
    }

    // Local mutation
    let updated: ApprovalRecord | undefined;
    localApprovals = localApprovals.map((item) => {
      if (item.id === approvalId) {
        updated = {
          ...item,
          status: decision,
          decidedBy,
          decidedAt: new Date().toISOString()
        };
        return updated;
      }
      return item;
    });

    if (!updated) {
      throw new Error(`Approval ${approvalId} not found`);
    }

    // If approved, simulate downstream execution trace
    if (decision === "approved") {
      const executedTrace: TraceRecord = {
        id: `trc-exec-${Date.now()}`,
        sessionId: updated.sessionId,
        agentId: "agent-gateway-exec",
        agentName: "Warden-Approval-Executor",
        toolName: updated.toolName,
        arguments: updated.arguments,
        result: {
          status: "executed",
          payout_status: "settled",
          executed_at: new Date().toISOString()
        },
        policyDecision: "allow",
        policyReason: `Approved by human administrator (${decidedBy})`,
        scannerVerdict: { isClean: true, flags: [] },
        latencyMs: 24,
        tokensIn: 110,
        tokensOut: 75,
        createdAt: new Date().toISOString()
      };
      localTraces = [executedTrace, ...localTraces];
    }

    return updated;
  },

  // Servers
  async getServers(): Promise<ServerRecord[]> {
    try {
      const res = await fetch("/api/servers", { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return [...localServers];
  },

  // Tools
  async getTools(): Promise<ToolItem[]> {
    try {
      const res = await fetch("/api/tools", { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return [...localTools];
  },

  async toggleQuarantine(toolId: string, quarantined: boolean): Promise<ToolItem> {
    try {
      const res = await fetch(`/api/tools/${toolId}/quarantine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quarantined })
      });
      if (res.ok) {
        const updated = await res.json();
        localTools = localTools.map((t) => (t.id === toolId ? updated : t));
        return updated;
      }
    } catch {
      // Fallback
    }

    // Local mutation
    let updated: ToolItem | undefined;
    localTools = localTools.map((t) => {
      if (t.id === toolId) {
        updated = { ...t, quarantined, updatedAt: new Date().toISOString() };
        return updated;
      }
      return t;
    });

    if (!updated) {
      throw new Error(`Tool ${toolId} not found`);
    }

    // Record audit event
    const event: SecurityEvent = {
      id: `sec-q-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: "rug_pull",
      severity: quarantined ? "HIGH" : "LOW",
      targetTool: updated.name,
      agentName: "AdminConsole",
      sessionId: "admin-session",
      summary: quarantined
        ? `Tool '${updated.name}' manually placed in quarantine`
        : `Tool '${updated.name}' released from quarantine`,
      payloadSnippet: `Admin updated quarantine state to ${quarantined}`,
      actionTaken: quarantined ? "quarantined" : "alerted",
      details: {}
    };
    localSecurityEvents = [event, ...localSecurityEvents];

    return updated;
  },

  async approveToolSchemaHash(toolId: string): Promise<ToolItem> {
    try {
      const res = await fetch(`/api/tools/${toolId}/approve-hash`, {
        method: "POST"
      });
      if (res.ok) {
        const updated = await res.json();
        localTools = localTools.map((t) => (t.id === toolId ? updated : t));
        return updated;
      }
    } catch {
      // Fallback
    }

    // Local mutation
    let updated: ToolItem | undefined;
    localTools = localTools.map((t) => {
      if (t.id === toolId) {
        updated = {
          ...t,
          approvedHash: t.schemaHash,
          hashStatus: "verified",
          quarantined: false,
          updatedAt: new Date().toISOString()
        };
        return updated;
      }
      return t;
    });

    if (!updated) {
      throw new Error(`Tool ${toolId} not found`);
    }
    return updated;
  },

  // Security Events
  async getSecurityEvents(): Promise<SecurityEvent[]> {
    try {
      const res = await fetch("/api/security-events", { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return [...localSecurityEvents];
  },

  // Analytics
  async getAnalytics(): Promise<AnalyticsSummary> {
    try {
      const res = await fetch("/api/analytics", { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return {
      ...localAnalytics,
      pendingApprovals: localApprovals.filter((a) => a.status === "pending").length
    };
  },

  // Session Replay
  async getSessionReplay(sessionId: string): Promise<SessionReplayData | null> {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return localSessions[sessionId] ?? null;
  },

  async getSessionIds(): Promise<string[]> {
    return Object.keys(localSessions);
  }
};
