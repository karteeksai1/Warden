export type PolicyDecision = "allow" | "deny" | "require_approval";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired" | "executed";
export type HashIntegrityStatus = "verified" | "mismatched" | "unapproved";
export type SecurityEventType = "prompt_injection" | "rug_pull" | "pii_redaction" | "poisoned_description" | "rate_limit_breach";
export type SeverityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface TraceRecord {
  id: string;
  sessionId: string;
  agentId: string;
  agentName: string;
  toolId?: string;
  toolName: string;
  arguments: Record<string, unknown>;
  result?: Record<string, unknown>;
  policyDecision: PolicyDecision;
  policyReason?: string;
  scannerVerdict?: {
    isClean: boolean;
    flags: string[];
    piiMatches?: string[];
    sanitizedArguments?: Record<string, unknown>;
    injectionScore?: number;
  };
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  createdAt: string;
}

export interface ApprovalRecord {
  id: string;
  traceId: string;
  sessionId: string;
  agentName: string;
  toolName: string;
  arguments: Record<string, unknown>;
  argumentsHash: string;
  status: ApprovalStatus;
  riskReason: string;
  policyRule: string;
  decidedBy?: string | null;
  decidedAt?: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface ServerRecord {
  id: string;
  name: string;
  transport: "http" | "stdio";
  endpoint: string;
  status: "healthy" | "unhealthy" | "disabled";
  toolCount: number;
  latencyMs: number;
  lastHealthCheckAt: string;
}

export interface ToolItem {
  id: string;
  serverId: string;
  serverName: string;
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
    }>;
    required?: string[];
  };
  schemaHash: string;
  approvedHash: string | null;
  hashStatus: HashIntegrityStatus;
  quarantined: boolean;
  isCore: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SecurityEvent {
  id: string;
  timestamp: string;
  type: SecurityEventType;
  severity: SeverityLevel;
  targetTool?: string;
  agentName: string;
  sessionId: string;
  summary: string;
  payloadSnippet: string;
  actionTaken: "blocked" | "redacted" | "quarantined" | "alerted";
  details: {
    matchedPatterns?: string[];
    redactedFields?: string[];
    originalHash?: string;
    mutatedHash?: string;
  };
}

export interface AnalyticsSummary {
  totalRequests: number;
  blockedAttacks: number;
  falsePositives: number;
  pendingApprovals: number;
  avgTokenReductionPercent: number;
  p50RouterLatencyMs: number;
  p95RouterLatencyMs: number;
  tokenReductionBySize: Array<{
    corpusSize: number;
    baselineTokens: number;
    routedTokens: number;
    reductionPercent: number;
  }>;
  routerLatencyBySize: Array<{
    corpusSize: number;
    p50Ms: number;
    p95Ms: number;
    meanMs: number;
  }>;
  policyDecisionsBreakdown: {
    allow: number;
    require_approval: number;
    deny: number;
  };
  topTools: Array<{
    name: string;
    calls: number;
    avgLatencyMs: number;
  }>;
}

export interface ReplayStep {
  stepNumber: number;
  timestamp: string;
  title: string;
  stage: "user_query" | "semantic_routing" | "policy_check" | "security_scan" | "downstream_execution" | "sanitization" | "response";
  details: string;
  meta: Record<string, unknown>;
  latencyMs: number;
  status: "success" | "warning" | "error" | "pending";
}

export interface SessionReplayData {
  sessionId: string;
  agentName: string;
  startedAt: string;
  totalDurationMs: number;
  customerPrompt: string;
  status: "completed" | "paused_for_approval" | "blocked";
  steps: ReplayStep[];
}
