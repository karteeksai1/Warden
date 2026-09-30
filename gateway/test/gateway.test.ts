import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server as HttpServer } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createOrdersMcpServer } from "../../servers/orders/src/server.js";
import { createRefundsMcpServer } from "../../servers/refunds/src/server.js";
import { createKbMcpServer } from "../../servers/kb/src/server.js";
import { AuthService, hashApiKey } from "../src/auth.js";
import { DownstreamManager } from "../src/downstream.js";
import { createGatewayMcpServer } from "../src/proxy.js";
import { createGatewayApp } from "../src/app.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

function getFirstTextContent(result: unknown): string {
  if (typeof result === "object" && result !== null && "content" in result) {
    const content = (result as { content: unknown[] }).content;
    const firstItem = content[0] as { type: string; text: string } | undefined;
    if (firstItem && typeof firstItem.text === "string") {
      return firstItem.text;
    }
  }
  throw new Error("Expected text content in result");
}

function getFirstContentType(result: unknown): string {
  if (typeof result === "object" && result !== null && "content" in result) {
    const content = (result as { content: unknown[] }).content;
    const firstItem = content[0] as { type: string } | undefined;
    if (firstItem && typeof firstItem.type === "string") {
      return firstItem.type;
    }
  }
  throw new Error("Expected content type in result");
}

describe("Gateway End-to-End MCP Proxy & Namespacing", () => {
  let gatewayClient: Client;
  let gatewayClientTransport: InMemoryTransport;
  let gatewayServerTransport: InMemoryTransport;
  let downstreamManager: DownstreamManager;

  beforeAll(async () => {
    downstreamManager = new DownstreamManager();

    const [ordersClientTransport, ordersServerTransport] = InMemoryTransport.createLinkedPair();
    const ordersServer = createOrdersMcpServer();
    await ordersServer.connect(ordersServerTransport);
    downstreamManager.registerServer({ name: "orders", transport: "http", endpoint: "http://localhost:4001/sse" });
    await downstreamManager.connectServer("orders", ordersClientTransport);

    const [refundsClientTransport, refundsServerTransport] = InMemoryTransport.createLinkedPair();
    const refundsServer = createRefundsMcpServer();
    await refundsServer.connect(refundsServerTransport);
    downstreamManager.registerServer({ name: "refunds", transport: "http", endpoint: "http://localhost:4002/sse" });
    await downstreamManager.connectServer("refunds", refundsClientTransport);

    const [kbClientTransport, kbServerTransport] = InMemoryTransport.createLinkedPair();
    const kbServer = createKbMcpServer();
    await kbServer.connect(kbServerTransport);
    downstreamManager.registerServer({ name: "kb", transport: "http", endpoint: "http://localhost:4003/sse" });
    await downstreamManager.connectServer("kb", kbClientTransport);

    const emailStdioScript = path.resolve(currentDirectory, "../../servers/email/src/stdio.ts");
    downstreamManager.registerServer({
      name: "email",
      transport: "stdio",
      endpoint: "stdio://email",
      command: "npx",
      args: ["tsx", emailStdioScript]
    });
    await downstreamManager.connectServer("email");

    [gatewayClientTransport, gatewayServerTransport] = InMemoryTransport.createLinkedPair();
    const gatewayServer = createGatewayMcpServer(downstreamManager);
    await gatewayServer.connect(gatewayServerTransport);

    gatewayClient = new Client({ name: "agent-client", version: "0.1.0" });
    await gatewayClient.connect(gatewayClientTransport);
  });

  afterAll(async () => {
    await gatewayClient.close();
    await downstreamManager.disconnectAll();
  });

  it("should aggregate and namespace all downstream tools as server.tool", async () => {
    const response = await gatewayClient.listTools();
    const toolNames = response.tools.map((t) => t.name);

    expect(toolNames).toContain("orders.get_order");
    expect(toolNames).toContain("orders.list_orders");
    expect(toolNames).toContain("orders.get_tracking");
    expect(toolNames).toContain("refunds.issue_refund");
    expect(toolNames).toContain("refunds.get_refund_status");
    expect(toolNames).toContain("kb.search_policy");
    expect(toolNames).toContain("email.send_confirmation");
  });

  it("should proxy orders.get_order call end-to-end to downstream orders server", async () => {
    const result = await gatewayClient.callTool({
      name: "orders.get_order",
      arguments: { order_id: "4821" }
    });

    expect(result.isError).toBeFalsy();
    expect(getFirstContentType(result)).toBe("text");

    const order = JSON.parse(getFirstTextContent(result));
    expect(order.order_id).toBe("4821");
    expect(order.customer_id).toBe("cust_101");
    expect(order.customer_name).toBe("Alice Smith");
    expect(order.total_amount).toBe(89.99);
  });

  it("should proxy kb.search_policy call end-to-end to downstream kb server", async () => {
    const result = await gatewayClient.callTool({
      name: "kb.search_policy",
      arguments: { query: "damaged item refund" }
    });

    expect(result.isError).toBeFalsy();
    const content = getFirstTextContent(result);
    expect(content).toContain("Damaged or Defective Items Policy");
    expect(content).toContain("pol_damaged_goods");
  });

  it("should proxy refunds.issue_refund call end-to-end to downstream refunds server", async () => {
    const result = await gatewayClient.callTool({
      name: "refunds.issue_refund",
      arguments: {
        order_id: "4821",
        amount: 45.00,
        destination_account: "acc_alice_101",
        reason: "Customer requested partial refund"
      }
    });

    expect(result.isError).toBeFalsy();
    const refund = JSON.parse(getFirstTextContent(result));
    expect(refund.refund_id).toMatch(/^ref_/);
    expect(refund.order_id).toBe("4821");
    expect(refund.amount).toBe(45.00);
    expect(refund.status).toBe("issued");
  });

  it("should proxy email.send_confirmation call end-to-end over stdio transport path", async () => {
    const result = await gatewayClient.callTool({
      name: "email.send_confirmation",
      arguments: {
        to: "alice.smith@example.com",
        subject: "Refund Update",
        body: "Your refund of $45.00 has been issued.",
        order_id: "4821"
      }
    });

    expect(result.isError).toBeFalsy();
    const email = JSON.parse(getFirstTextContent(result));
    expect(email.id).toMatch(/^eml_/);
    expect(email.to).toBe("alice.smith@example.com");
    expect(email.status).toBe("logged");
  });

  it("should return structured error for unknown namespaced tool", async () => {
    const result = await gatewayClient.callTool({
      name: "unknown_server.fake_tool",
      arguments: {}
    });

    expect(result.isError).toBe(true);
    expect(getFirstTextContent(result)).toContain("Gateway error calling tool unknown_server.fake_tool");
  });
});

describe("Gateway Agent Authentication & Express Endpoints", () => {
  let server: HttpServer;
  let baseUrl: string;
  let authService: AuthService;
  const testApiKey = "warden-agent-key-secret-999";

  beforeAll(async () => {
    authService = new AuthService();
    await authService.registerAgent("SupportAgent", testApiKey);

    const downstreamManager = new DownstreamManager();
    const app = createGatewayApp(authService, downstreamManager);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (typeof address === "object" && address !== null) {
          baseUrl = `http://localhost:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("should return gateway health info on GET /health without auth", async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);

    const body = (await response.json()) as { status: string; gateway: string; version: string };
    expect(body.status).toBe("healthy");
    expect(body.gateway).toBe("warden");
    expect(body.version).toBe("0.1.0");
  });

  it("should reject unauthenticated request to /sse with 401 Unauthorized", async () => {
    const response = await fetch(`${baseUrl}/sse`);
    expect(response.status).toBe(401);

    const body = (await response.json()) as { error: string; message: string };
    expect(body.error).toBe("Unauthorized");
    expect(body.message).toContain("Missing API key");
  });

  it("should reject invalid API key with 401 Unauthorized", async () => {
    const response = await fetch(`${baseUrl}/sse`, {
      headers: { "x-api-key": "invalid-secret-key-123" }
    });
    expect(response.status).toBe(401);

    const body = (await response.json()) as { error: string; message: string };
    expect(body.error).toBe("Unauthorized");
    expect(body.message).toContain("Invalid API key");
  });

  it("should hash API keys consistently with SHA-256", () => {
    const hashOne = hashApiKey("my-test-key");
    const hashTwo = hashApiKey("my-test-key");
    expect(hashOne).toBe(hashTwo);
    expect(hashOne).toHaveLength(64);
  });
});
