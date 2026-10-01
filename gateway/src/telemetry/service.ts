import crypto from "node:crypto";
import {
  TraceRecord,
  NewTraceInput,
  ApprovalRecord,
  NewApprovalInput,
  TraceFilter,
  ApprovalFilter,
  AnalyticsSummary,
  TraceSubscriber
} from "./types.js";
import { estimateTokens } from "./estimator.js";
import {
  TelemetryDatabase,
  InMemoryTelemetryDatabase,
  DrizzleTelemetryDatabase,
  computeArgumentsHash
} from "./database.js";
import { DatabaseClient } from "@warden/shared";

export class TelemetryService {
  private readonly db: TelemetryDatabase;
  private readonly subscribers: Set<TraceSubscriber> = new Set();

  constructor(databaseInput?: TelemetryDatabase | DatabaseClient) {
    if (!databaseInput) {
      this.db = new InMemoryTelemetryDatabase();
    } else if ("insertTrace" in databaseInput && typeof databaseInput.insertTrace === "function") {
      this.db = databaseInput as TelemetryDatabase;
    } else {
      this.db = new DrizzleTelemetryDatabase(databaseInput as DatabaseClient);
    }
  }

  recordTraceAsync(input: NewTraceInput): void {
    const traceId = input.id ?? crypto.randomUUID();
    const tokensIn = input.tokensIn ?? estimateTokens(input.arguments);
    const tokensOut = input.tokensOut ?? estimateTokens(input.result);

    const record: TraceRecord = {
      id: traceId,
      sessionId: input.sessionId,
      agentId: input.agentId,
      toolId: input.toolId,
      toolName: input.toolName,
      arguments: input.arguments,
      result: input.result,
      policyDecision: input.policyDecision,
      scannerVerdict: input.scannerVerdict,
      latencyMs: input.latencyMs,
      tokensIn,
      tokensOut,
      createdAt: input.createdAt ?? new Date()
    };

    setImmediate(() => {
      this.executeAsyncWrite(record);
    });
  }

  private async executeAsyncWrite(record: TraceRecord): Promise<void> {
    try {
      await this.db.insertTrace(record);
      this.notifySubscribers(record);
    } catch (err) {
      process.stderr.write(
        `Failed to record telemetry trace asynchronously: ${err instanceof Error ? err.message : String(err)}\n`
      );
    }
  }

  subscribeToTraces(listener: TraceSubscriber): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notifySubscribers(trace: TraceRecord): void {
    for (const listener of this.subscribers) {
      try {
        listener(trace);
      } catch (err) {
        process.stderr.write(
          `Error in trace subscriber notification: ${err instanceof Error ? err.message : String(err)}\n`
        );
      }
    }
  }

  async listTraces(filter?: TraceFilter): Promise<TraceRecord[]> {
    return this.db.listTraces(filter);
  }

  async getTraceById(id: string): Promise<TraceRecord | null> {
    return this.db.findTraceById(id);
  }

  async getAnalytics(): Promise<AnalyticsSummary> {
    return this.db.getAnalyticsSummary();
  }

  async createApproval(input: NewApprovalInput): Promise<ApprovalRecord> {
    const id = input.id ?? crypto.randomUUID();
    const argumentsHash = input.argumentsHash ?? computeArgumentsHash(input.arguments);
    const hours = input.expiresInHours ?? 24;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    const approval: ApprovalRecord = {
      id,
      traceId: input.traceId,
      toolName: input.toolName,
      arguments: input.arguments,
      argumentsHash,
      status: input.status ?? "pending",
      expiresAt,
      createdAt: new Date()
    };

    return this.db.insertApproval(approval);
  }

  async listApprovals(filter?: ApprovalFilter): Promise<ApprovalRecord[]> {
    return this.db.listApprovals(filter);
  }

  async getApprovalById(id: string): Promise<ApprovalRecord | null> {
    return this.db.findApprovalById(id);
  }

  async approve(id: string, decidedBy?: string): Promise<ApprovalRecord | null> {
    return this.db.updateApprovalStatus(id, "approved", decidedBy);
  }

  async deny(id: string, decidedBy?: string): Promise<ApprovalRecord | null> {
    return this.db.updateApprovalStatus(id, "rejected", decidedBy);
  }

  async flush(): Promise<void> {
    await new Promise((resolve) => setImmediate(resolve));
  }
}
