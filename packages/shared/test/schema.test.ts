import { describe, it, expect } from "vitest";
import {
  agents,
  servers,
  tools,
  traces,
  approvals,
  serverTransportEnum,
  serverStatusEnum,
  policyDecisionEnum,
  approvalStatusEnum
} from "../src/db/schema.js";

describe("Database Schema Definitions", () => {
  it("should define agents table with expected columns", () => {
    expect(agents.id).toBeDefined();
    expect(agents.name).toBeDefined();
    expect(agents.apiKeyHash).toBeDefined();
    expect(agents.createdAt).toBeDefined();
  });

  it("should define servers table with expected columns", () => {
    expect(servers.id).toBeDefined();
    expect(servers.name).toBeDefined();
    expect(servers.transport).toBeDefined();
    expect(servers.endpoint).toBeDefined();
    expect(servers.status).toBeDefined();
    expect(servers.lastHealthCheckAt).toBeDefined();
    expect(servers.createdAt).toBeDefined();
  });

  it("should define tools table with expected columns", () => {
    expect(tools.id).toBeDefined();
    expect(tools.serverId).toBeDefined();
    expect(tools.name).toBeDefined();
    expect(tools.description).toBeDefined();
    expect(tools.inputSchema).toBeDefined();
    expect(tools.schemaHash).toBeDefined();
    expect(tools.approvedHash).toBeDefined();
    expect(tools.quarantined).toBeDefined();
    expect(tools.isCore).toBeDefined();
    expect(tools.createdAt).toBeDefined();
    expect(tools.updatedAt).toBeDefined();
  });

  it("should define traces table with expected columns", () => {
    expect(traces.id).toBeDefined();
    expect(traces.sessionId).toBeDefined();
    expect(traces.agentId).toBeDefined();
    expect(traces.toolId).toBeDefined();
    expect(traces.toolName).toBeDefined();
    expect(traces.arguments).toBeDefined();
    expect(traces.result).toBeDefined();
    expect(traces.policyDecision).toBeDefined();
    expect(traces.scannerVerdict).toBeDefined();
    expect(traces.latencyMs).toBeDefined();
    expect(traces.tokensIn).toBeDefined();
    expect(traces.tokensOut).toBeDefined();
    expect(traces.createdAt).toBeDefined();
  });

  it("should define approvals table with expected columns", () => {
    expect(approvals.id).toBeDefined();
    expect(approvals.traceId).toBeDefined();
    expect(approvals.toolName).toBeDefined();
    expect(approvals.arguments).toBeDefined();
    expect(approvals.argumentsHash).toBeDefined();
    expect(approvals.status).toBeDefined();
    expect(approvals.decidedBy).toBeDefined();
    expect(approvals.decidedAt).toBeDefined();
    expect(approvals.expiresAt).toBeDefined();
    expect(approvals.createdAt).toBeDefined();
  });

  it("should define valid enum values", () => {
    expect(serverTransportEnum.enumValues).toEqual(["http", "stdio"]);
    expect(serverStatusEnum.enumValues).toEqual(["healthy", "unhealthy", "disabled"]);
    expect(policyDecisionEnum.enumValues).toEqual(["allow", "deny", "require_approval"]);
    expect(approvalStatusEnum.enumValues).toEqual(["pending", "approved", "rejected", "expired", "executed"]);
  });
});
