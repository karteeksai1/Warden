export type PolicyDecision = "allow" | "deny" | "require_approval";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired" | "executed";

export interface TraceRecord {
  id: string;
  sessionId: string;
  agentId?: string;
  toolId?: string;
  toolName: string;
  arguments?: unknown;
  result?: unknown;
  policyDecision: PolicyDecision;
  scannerVerdict?: unknown;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  createdAt: Date;
}

export interface NewTraceInput {
  id?: string;
  sessionId: string;
  agentId?: string;
  toolId?: string;
  toolName: string;
  arguments?: unknown;
  result?: unknown;
  policyDecision: PolicyDecision;
  scannerVerdict?: unknown;
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
  createdAt?: Date;
}

export interface ApprovalRecord {
  id: string;
  traceId?: string;
  toolName: string;
  arguments: Record<string, unknown>;
  argumentsHash: string;
  status: ApprovalStatus;
  decidedBy?: string;
  decidedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
}

export interface NewApprovalInput {
  id?: string;
  traceId?: string;
  toolName: string;
  arguments: Record<string, unknown>;
  argumentsHash?: string;
  status?: ApprovalStatus;
  expiresInHours?: number;
}

export interface TraceFilter {
  limit?: number;
  offset?: number;
  sessionId?: string;
  agentId?: string;
  toolName?: string;
  policyDecision?: PolicyDecision;
}

export interface ApprovalFilter {
  status?: ApprovalStatus;
  toolName?: string;
  limit?: number;
  offset?: number;
}

export interface AnalyticsSummary {
  totalCalls: number;
  totalErrors: number;
  errorRate: number;
  latency: {
    min: number;
    max: number;
    mean: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  tokens: {
    totalIn: number;
    totalOut: number;
    total: number;
    avgPerCall: number;
  };
  policyDecisions: {
    allow: number;
    deny: number;
    require_approval: number;
  };
  topTools: Array<{
    toolName: string;
    calls: number;
    avgLatencyMs: number;
    tokens: number;
  }>;
  quarantinedToolsCount?: number;
}

export type TraceSubscriber = (trace: TraceRecord) => void;
