import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Server as HttpServer } from "node:http";
import { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createOrdersMcpServer } from "../../servers/orders/src/server.js";
import { AuthService } from "../src/auth.js";
import { DownstreamManager } from "../src/downstream.js";
import { createGatewayMcpServer } from "../src/proxy.js";
import { createGatewayApp } from "../src/app.js";
import {
  TelemetryService,
  InMemoryTelemetryDatabase,
  estimateTokens,
  computeArgumentsHash
} from "../src/telemetry/index.js";

describe("Gateway Telemetry & Trace System", () => {
  it("should estimate tokens accurately for strings and JSON objects", () => {
    expect(estimateTokens(null)).toBe(0);
    expect(estimateTokens(undefined)).toBe(0);
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("test query")).toBeGreaterThanOrEqual(2);

    const smallObj = { order_id: "4821" };
    expect(estimateTokens(smallObj)).toBeGreaterThanOrEqual(4);

    const largeObj = {
      order_id: "ORD-9999",
      customer: { name: "Alice", email: "alice@test.com" },
      items: [{ sku: "SKU-1", qty: 2 }]
    };
    expect(estimateTokens(largeObj)).toBeGreaterThan(estimateTokens(smallObj));
  });

  it("should compute deterministic SHA-256 arguments hashes", () => {
    const hash1 = computeArgumentsHash({ order_id: "4821", amount: 100 });
    const hash2 = computeArgumentsHash({ order_id: "4821", amount: 100 });
    const hash3 = computeArgumentsHash({ order_id: "4821", amount: 200 });

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1).toHaveLength(64);
  });

  it("should record traces asynchronously off the request hot path", async () => {
    const database = new InMemoryTelemetryDatabase();
    const telemetry = new TelemetryService(database);

    const receivedTraces: string[] = [];
    const unsubscribe = telemetry.subscribeToTraces((trace) => {
      receivedTraces.push(trace.id);
    });

    telemetry.recordTraceAsync({
      sessionId: "sess_001",
      agentId: "ag_001",
      toolName: "orders.get_order",
      arguments: { order_id: "4821" },
      result: { status: "delivered" },
      policyDecision: "allow",
      latencyMs: 14
    });

    const immediateList = await telemetry.listTraces();
    expect(immediateList.length).toBe(0);

    await telemetry.flush();

    const flushedList = await telemetry.listTraces();
    expect(flushedList.length).toBe(1);
    expect(flushedList[0]?.toolName).toBe("orders.get_order");
    expect(flushedList[0]?.tokensIn).toBeGreaterThan(0);
    expect(flushedList[0]?.tokensOut).toBeGreaterThan(0);
    expect(receivedTraces).toHaveLength(1);

    unsubscribe();
  });

  it("should manage approvals lifecycle from creation to decision", async () => {
    const database = new InMemoryTelemetryDatabase();
    const telemetry = new TelemetryService(database);

    const approval = await telemetry.createApproval({
      toolName: "refunds.issue_refund",
      arguments: { order_id: "4821", amount: 750 }
    });

    expect(approval.status).toBe("pending");
    expect(approval.argumentsHash).toBeDefined();

    const fetched = await telemetry.getApprovalById(approval.id);
    expect(fetched?.id).toBe(approval.id);

    const approved = await telemetry.approve(approval.id, "security_officer_1");
    expect(approved?.status).toBe("approved");
    expect(approved?.decidedBy).toBe("security_officer_1");
    expect(approved?.decidedAt).toBeDefined();
  });

  it("should compute accurate analytics summary across aggregated traces", async () => {
    const database = new InMemoryTelemetryDatabase();
    const telemetry = new TelemetryService(database);

    telemetry.recordTraceAsync({
      sessionId: "s1",
      toolName: "orders.get_order",
      arguments: { id: "1" },
      result: { ok: true },
      policyDecision: "allow",
      latencyMs: 10
    });
    telemetry.recordTraceAsync({
      sessionId: "s1",
      toolName: "orders.get_order",
      arguments: { id: "2" },
      result: { ok: true },
      policyDecision: "allow",
      latencyMs: 20
    });
    telemetry.recordTraceAsync({
      sessionId: "s1",
      toolName: "refunds.issue_refund",
      arguments: { id: "3" },
      result: { error: "Rejected by rule" },
      policyDecision: "deny",
      latencyMs: 30
    });

    await telemetry.flush();

    const analytics = await telemetry.getAnalytics();
    expect(analytics.totalCalls).toBe(3);
    expect(analytics.totalErrors).toBe(1);
    expect(analytics.errorRate).toBeCloseTo(0.3333, 2);
    expect(analytics.latency.min).toBe(10);
    expect(analytics.latency.max).toBe(30);
    expect(analytics.latency.mean).toBe(20);
    expect(analytics.policyDecisions.allow).toBe(2);
    expect(analytics.policyDecisions.deny).toBe(1);
    expect(analytics.topTools.length).toBe(2);
    expect(analytics.topTools[0]?.toolName).toBe("orders.get_order");
    expect(analytics.topTools[0]?.calls).toBe(2);
  });
});

describe("Gateway REST & SSE Endpoints Integration", () => {
  let server: HttpServer;
  let baseUrl: string;
  let telemetry: TelemetryService;
  let downstreamManager: DownstreamManager;

  beforeAll(async () => {
    const authService = new AuthService();
    downstreamManager = new DownstreamManager();

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const ordersServer = createOrdersMcpServer();
    await ordersServer.connect(serverTransport);
    downstreamManager.registerServer({ name: "orders", transport: "http", endpoint: "http://localhost:4001/sse" });
    await downstreamManager.connectServer("orders", clientTransport);

    telemetry = new TelemetryService(new InMemoryTelemetryDatabase());
    const app = createGatewayApp(authService, downstreamManager, undefined, undefined, telemetry);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await downstreamManager.disconnectAll();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("should serve GET /servers with status and tool counts", async () => {
    const response = await fetch(`${baseUrl}/servers`);
    expect(response.status).toBe(200);

    const body = (await response.json()) as { servers: Array<{ name: string; tools_count: number }>; total_servers: number };
    expect(body.total_servers).toBeGreaterThanOrEqual(1);
    const orders = body.servers.find((s) => s.name === "orders");
    expect(orders).toBeDefined();
    expect(orders?.tools_count).toBeGreaterThan(0);
  });

  it("should record traces through proxy and serve them via GET /traces and GET /traces/:id", async () => {
    const mcpServer = createGatewayMcpServer(
      downstreamManager,
      undefined,
      undefined,
      telemetry,
      { sessionId: "test_http_sess_1", agentId: "ag_test" }
    );
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    await mcpServer.connect(serverTransport);
    await client.connect(clientTransport);

    await client.callTool({
      name: "orders.get_order",
      arguments: { order_id: "4821" }
    });

    await telemetry.flush();

    const listRes = await fetch(`${baseUrl}/traces?sessionId=test_http_sess_1`);
    expect(listRes.status).toBe(200);
    const traces = (await listRes.json()) as Array<{ id: string; toolName: string; sessionId: string }>;
    expect(traces.length).toBeGreaterThanOrEqual(1);
    const createdTrace = traces[0];
    expect(createdTrace?.toolName).toBe("orders.get_order");
    expect(createdTrace?.sessionId).toBe("test_http_sess_1");

    const singleRes = await fetch(`${baseUrl}/traces/${createdTrace?.id}`);
    expect(singleRes.status).toBe(200);
    const singleTrace = (await singleRes.json()) as { id: string; latencyMs: number };
    expect(singleTrace.id).toBe(createdTrace?.id);
    expect(singleTrace.latencyMs).toBeGreaterThanOrEqual(0);

    const missingRes = await fetch(`${baseUrl}/traces/00000000-0000-0000-0000-000000000000`);
    expect(missingRes.status).toBe(404);
  });

  it("should serve GET /analytics metrics endpoint", async () => {
    const response = await fetch(`${baseUrl}/analytics`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { totalCalls: number; latency: { p50: number }; tokens: { total: number } };
    expect(body.totalCalls).toBeGreaterThanOrEqual(1);
    expect(body.tokens.total).toBeGreaterThan(0);
  });

  it("should manage approvals via GET /approvals, POST /approve, and POST /deny", async () => {
    const approval = await telemetry.createApproval({
      toolName: "refunds.issue_refund",
      arguments: { order_id: "4821", amount: 800 }
    });

    const listRes = await fetch(`${baseUrl}/approvals?status=pending`);
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as Array<{ id: string }>;
    expect(list.some((a) => a.id === approval.id)).toBe(true);

    const approveRes = await fetch(`${baseUrl}/approvals/${approval.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decided_by: "supervisor_alice" })
    });
    expect(approveRes.status).toBe(200);
    const approved = (await approveRes.json()) as { status: string; decidedBy: string };
    expect(approved.status).toBe("approved");
    expect(approved.decidedBy).toBe("supervisor_alice");

    const secondApproval = await telemetry.createApproval({
      toolName: "refunds.issue_refund",
      arguments: { order_id: "9999", amount: 1500 }
    });

    const denyRes = await fetch(`${baseUrl}/approvals/${secondApproval.id}/deny`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decided_by: "supervisor_bob" })
    });
    expect(denyRes.status).toBe(200);
    const denied = (await denyRes.json()) as { status: string; decidedBy: string };
    expect(denied.status).toBe("rejected");
    expect(denied.decidedBy).toBe("supervisor_bob");
  });

  it("should stream live traces via GET /traces/stream SSE endpoint", async () => {
    const controller = new AbortController();
    const streamRes = await fetch(`${baseUrl}/traces/stream`, {
      signal: controller.signal
    });

    expect(streamRes.status).toBe(200);
    expect(streamRes.headers.get("content-type")).toContain("text/event-stream");

    const reader = streamRes.body?.getReader();
    expect(reader).toBeDefined();

    if (reader) {
      const initialChunk = await reader.read();
      const initialText = new TextDecoder().decode(initialChunk.value);
      expect(initialText).toContain(": stream_open");

      telemetry.recordTraceAsync({
        sessionId: "sess_stream_test",
        toolName: "orders.get_tracking",
        arguments: { tracking_number: "TRK-100" },
        result: { status: "shipped" },
        policyDecision: "allow",
        latencyMs: 12
      });

      const traceChunk = await reader.read();
      const traceText = new TextDecoder().decode(traceChunk.value);
      expect(traceText).toContain("event: trace");
      expect(traceText).toContain("orders.get_tracking");

      controller.abort();
    }
  });
});
