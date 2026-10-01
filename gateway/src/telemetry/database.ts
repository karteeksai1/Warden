import crypto from "node:crypto";
import { desc, eq, and } from "drizzle-orm";
import { DatabaseClient, traces as tracesTable, approvals as approvalsTable } from "@warden/shared";
import {
  TraceRecord,
  TraceFilter,
  ApprovalRecord,
  ApprovalFilter,
  ApprovalStatus,
  AnalyticsSummary
} from "./types.js";

export interface TelemetryDatabase {
  insertTrace(trace: TraceRecord): Promise<TraceRecord>;
  findTraceById(id: string): Promise<TraceRecord | null>;
  listTraces(filter?: TraceFilter): Promise<TraceRecord[]>;
  getAnalyticsSummary(): Promise<AnalyticsSummary>;
  insertApproval(approval: ApprovalRecord): Promise<ApprovalRecord>;
  findApprovalById(id: string): Promise<ApprovalRecord | null>;
  listApprovals(filter?: ApprovalFilter): Promise<ApprovalRecord[]>;
  updateApprovalStatus(id: string, status: ApprovalStatus, decidedBy?: string): Promise<ApprovalRecord | null>;
}

export function computeArgumentsHash(args: unknown): string {
  const normalized = typeof args === "object" && args !== null ? JSON.stringify(args) : String(args ?? "");
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))] ?? 0;
}

export class InMemoryTelemetryDatabase implements TelemetryDatabase {
  private readonly traces: Map<string, TraceRecord> = new Map();
  private readonly approvals: Map<string, ApprovalRecord> = new Map();

  async insertTrace(trace: TraceRecord): Promise<TraceRecord> {
    this.traces.set(trace.id, { ...trace });
    return trace;
  }

  async findTraceById(id: string): Promise<TraceRecord | null> {
    const item = this.traces.get(id);
    return item ? { ...item } : null;
  }

  async listTraces(filter: TraceFilter = {}): Promise<TraceRecord[]> {
    let result = Array.from(this.traces.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    if (filter.sessionId) {
      result = result.filter((t) => t.sessionId === filter.sessionId);
    }
    if (filter.agentId) {
      result = result.filter((t) => t.agentId === filter.agentId);
    }
    if (filter.toolName) {
      result = result.filter((t) => t.toolName === filter.toolName);
    }
    if (filter.policyDecision) {
      result = result.filter((t) => t.policyDecision === filter.policyDecision);
    }

    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 50;
    return result.slice(offset, offset + limit);
  }

  async getAnalyticsSummary(): Promise<AnalyticsSummary> {
    const all = Array.from(this.traces.values());
    const totalCalls = all.length;

    let totalErrors = 0;
    let totalIn = 0;
    let totalOut = 0;
    const policyCounts = { allow: 0, deny: 0, require_approval: 0 };
    const toolAgg: Map<string, { calls: number; totalLatency: number; totalTokens: number }> = new Map();

    const latencies: number[] = [];

    for (const trace of all) {
      latencies.push(trace.latencyMs);
      totalIn += trace.tokensIn;
      totalOut += trace.tokensOut;

      if (trace.policyDecision === "deny" || (trace.result as { isError?: boolean })?.isError) {
        totalErrors++;
      }

      if (trace.policyDecision in policyCounts) {
        policyCounts[trace.policyDecision]++;
      }

      const existing = toolAgg.get(trace.toolName) ?? { calls: 0, totalLatency: 0, totalTokens: 0 };
      existing.calls++;
      existing.totalLatency += trace.latencyMs;
      existing.totalTokens += trace.tokensIn + trace.tokensOut;
      toolAgg.set(trace.toolName, existing);
    }

    latencies.sort((a, b) => a - b);
    const sumLatency = latencies.reduce((sum, val) => sum + val, 0);

    const topTools = Array.from(toolAgg.entries())
      .map(([name, stat]) => ({
        toolName: name,
        calls: stat.calls,
        avgLatencyMs: Math.round(stat.totalLatency / stat.calls),
        tokens: stat.totalTokens
      }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 10);

    return {
      totalCalls,
      totalErrors,
      errorRate: totalCalls > 0 ? Number((totalErrors / totalCalls).toFixed(4)) : 0,
      latency: {
        min: latencies[0] ?? 0,
        max: latencies[latencies.length - 1] ?? 0,
        mean: totalCalls > 0 ? Math.round(sumLatency / totalCalls) : 0,
        p50: calculatePercentile(latencies, 50),
        p90: calculatePercentile(latencies, 90),
        p95: calculatePercentile(latencies, 95),
        p99: calculatePercentile(latencies, 99)
      },
      tokens: {
        totalIn,
        totalOut,
        total: totalIn + totalOut,
        avgPerCall: totalCalls > 0 ? Math.round((totalIn + totalOut) / totalCalls) : 0
      },
      policyDecisions: policyCounts,
      topTools
    };
  }

  async insertApproval(approval: ApprovalRecord): Promise<ApprovalRecord> {
    this.approvals.set(approval.id, { ...approval });
    return approval;
  }

  async findApprovalById(id: string): Promise<ApprovalRecord | null> {
    const item = this.approvals.get(id);
    return item ? { ...item } : null;
  }

  async listApprovals(filter: ApprovalFilter = {}): Promise<ApprovalRecord[]> {
    let result = Array.from(this.approvals.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    if (filter.status) {
      result = result.filter((a) => a.status === filter.status);
    }
    if (filter.toolName) {
      result = result.filter((a) => a.toolName === filter.toolName);
    }

    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 50;
    return result.slice(offset, offset + limit);
  }

  async updateApprovalStatus(
    id: string,
    status: ApprovalStatus,
    decidedBy?: string
  ): Promise<ApprovalRecord | null> {
    const existing = this.approvals.get(id);
    if (!existing) {
      return null;
    }

    const updated: ApprovalRecord = {
      ...existing,
      status,
      decidedBy: decidedBy ?? existing.decidedBy,
      decidedAt: new Date()
    };
    this.approvals.set(id, updated);
    return updated;
  }
}

export class DrizzleTelemetryDatabase implements TelemetryDatabase {
  constructor(private readonly db: DatabaseClient) {}

  async insertTrace(trace: TraceRecord): Promise<TraceRecord> {
    await this.db.insert(tracesTable).values({
      id: trace.id,
      sessionId: trace.sessionId,
      agentId: trace.agentId ?? "00000000-0000-0000-0000-000000000000",
      toolId: trace.toolId,
      toolName: trace.toolName,
      arguments: trace.arguments as Record<string, unknown>,
      result: trace.result as Record<string, unknown>,
      policyDecision: trace.policyDecision,
      scannerVerdict: trace.scannerVerdict as Record<string, unknown>,
      latencyMs: trace.latencyMs,
      tokensIn: trace.tokensIn,
      tokensOut: trace.tokensOut,
      createdAt: trace.createdAt
    });
    return trace;
  }

  async findTraceById(id: string): Promise<TraceRecord | null> {
    const rows = await this.db.select().from(tracesTable).where(eq(tracesTable.id, id));
    const r = rows[0];
    if (!r) {
      return null;
    }
    return {
      id: r.id,
      sessionId: r.sessionId,
      agentId: r.agentId,
      toolId: r.toolId ?? undefined,
      toolName: r.toolName,
      arguments: r.arguments,
      result: r.result,
      policyDecision: r.policyDecision,
      scannerVerdict: r.scannerVerdict,
      latencyMs: r.latencyMs,
      tokensIn: r.tokensIn,
      tokensOut: r.tokensOut,
      createdAt: r.createdAt
    };
  }

  async listTraces(filter: TraceFilter = {}): Promise<TraceRecord[]> {
    const conditions = [];
    if (filter.sessionId) {
      conditions.push(eq(tracesTable.sessionId, filter.sessionId));
    }
    if (filter.agentId) {
      conditions.push(eq(tracesTable.agentId, filter.agentId));
    }
    if (filter.toolName) {
      conditions.push(eq(tracesTable.toolName, filter.toolName));
    }
    if (filter.policyDecision) {
      conditions.push(eq(tracesTable.policyDecision, filter.policyDecision));
    }

    const query = this.db
      .select()
      .from(tracesTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(tracesTable.createdAt))
      .limit(filter.limit ?? 50)
      .offset(filter.offset ?? 0);

    const rows = await query;
    return rows.map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      agentId: r.agentId,
      toolId: r.toolId ?? undefined,
      toolName: r.toolName,
      arguments: r.arguments,
      result: r.result,
      policyDecision: r.policyDecision,
      scannerVerdict: r.scannerVerdict,
      latencyMs: r.latencyMs,
      tokensIn: r.tokensIn,
      tokensOut: r.tokensOut,
      createdAt: r.createdAt
    }));
  }

  async getAnalyticsSummary(): Promise<AnalyticsSummary> {
    const inMemFallback = new InMemoryTelemetryDatabase();
    const rows = await this.db.select().from(tracesTable).orderBy(desc(tracesTable.createdAt)).limit(1000);
    for (const r of rows) {
      await inMemFallback.insertTrace({
        id: r.id,
        sessionId: r.sessionId,
        agentId: r.agentId,
        toolId: r.toolId ?? undefined,
        toolName: r.toolName,
        arguments: r.arguments,
        result: r.result,
        policyDecision: r.policyDecision,
        scannerVerdict: r.scannerVerdict,
        latencyMs: r.latencyMs,
        tokensIn: r.tokensIn,
        tokensOut: r.tokensOut,
        createdAt: r.createdAt
      });
    }
    return inMemFallback.getAnalyticsSummary();
  }

  async insertApproval(approval: ApprovalRecord): Promise<ApprovalRecord> {
    await this.db.insert(approvalsTable).values({
      id: approval.id,
      traceId: approval.traceId ?? "00000000-0000-0000-0000-000000000000",
      toolName: approval.toolName,
      arguments: approval.arguments,
      argumentsHash: approval.argumentsHash,
      status: approval.status,
      decidedBy: approval.decidedBy,
      decidedAt: approval.decidedAt,
      expiresAt: approval.expiresAt,
      createdAt: approval.createdAt
    });
    return approval;
  }

  async findApprovalById(id: string): Promise<ApprovalRecord | null> {
    const rows = await this.db.select().from(approvalsTable).where(eq(approvalsTable.id, id));
    const r = rows[0];
    if (!r) {
      return null;
    }
    return {
      id: r.id,
      traceId: r.traceId,
      toolName: r.toolName,
      arguments: r.arguments as Record<string, unknown>,
      argumentsHash: r.argumentsHash,
      status: r.status,
      decidedBy: r.decidedBy ?? undefined,
      decidedAt: r.decidedAt ?? undefined,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt
    };
  }

  async listApprovals(filter: ApprovalFilter = {}): Promise<ApprovalRecord[]> {
    const conditions = [];
    if (filter.status) {
      conditions.push(eq(approvalsTable.status, filter.status));
    }
    if (filter.toolName) {
      conditions.push(eq(approvalsTable.toolName, filter.toolName));
    }

    const rows = await this.db
      .select()
      .from(approvalsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(approvalsTable.createdAt))
      .limit(filter.limit ?? 50)
      .offset(filter.offset ?? 0);

    return rows.map((r) => ({
      id: r.id,
      traceId: r.traceId,
      toolName: r.toolName,
      arguments: r.arguments as Record<string, unknown>,
      argumentsHash: r.argumentsHash,
      status: r.status,
      decidedBy: r.decidedBy ?? undefined,
      decidedAt: r.decidedAt ?? undefined,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt
    }));
  }

  async updateApprovalStatus(
    id: string,
    status: ApprovalStatus,
    decidedBy?: string
  ): Promise<ApprovalRecord | null> {
    const now = new Date();
    const rows = await this.db
      .update(approvalsTable)
      .set({
        status,
        decidedBy: decidedBy ?? null,
        decidedAt: now
      })
      .where(eq(approvalsTable.id, id))
      .returning();

    const r = rows[0];
    if (!r) {
      return null;
    }
    return {
      id: r.id,
      traceId: r.traceId,
      toolName: r.toolName,
      arguments: r.arguments as Record<string, unknown>,
      argumentsHash: r.argumentsHash,
      status: r.status,
      decidedBy: r.decidedBy ?? undefined,
      decidedAt: r.decidedAt ?? undefined,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt
    };
  }
}
