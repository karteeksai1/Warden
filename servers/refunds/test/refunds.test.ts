import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createRefundsMcpServer } from "../src/server.js";
import { RefundService } from "../src/service.js";
import { createRefundsApp } from "../src/app.js";
import { Server } from "node:http";

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

describe("Refunds MCP Server Tools", () => {
  let client: Client;
  let clientTransport: InMemoryTransport;
  let serverTransport: InMemoryTransport;
  let refundService: RefundService;

  beforeAll(async () => {
    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    refundService = new RefundService();
    const server = createRefundsMcpServer(refundService);
    await server.connect(serverTransport);

    client = new Client({ name: "test-client", version: "0.1.0" });
    await client.connect(clientTransport);
  });

  afterAll(async () => {
    await client.close();
  });

  it("should list all registered refund tools with accurate descriptions", async () => {
    const response = await client.listTools();
    const toolNames = response.tools.map((tool) => tool.name);

    expect(toolNames).toContain("issue_refund");
    expect(toolNames).toContain("get_refund_status");

    const issueTool = response.tools.find((tool) => tool.name === "issue_refund");
    expect(issueTool?.description).toContain("Issue a customer refund");
    expect(issueTool?.inputSchema.properties).toHaveProperty("order_id");
    expect(issueTool?.inputSchema.properties).toHaveProperty("amount");
    expect(issueTool?.inputSchema.properties).toHaveProperty("destination_account");

    const statusTool = response.tools.find((tool) => tool.name === "get_refund_status");
    expect(statusTool?.description).toContain("Retrieve the current processing and settlement status");
    expect(statusTool?.inputSchema.properties).toHaveProperty("refund_id");
  });

  it("should issue a valid refund and return issued record", async () => {
    const result = await client.callTool({
      name: "issue_refund",
      arguments: {
        order_id: "4821",
        amount: 45.00,
        destination_account: "acc_alice_101",
        reason: "Damaged item on delivery"
      }
    });

    expect(result.isError).toBeFalsy();
    expect(getFirstContentType(result)).toBe("text");

    const refund = JSON.parse(getFirstTextContent(result));
    expect(refund.refund_id).toMatch(/^ref_/);
    expect(refund.order_id).toBe("4821");
    expect(refund.amount).toBe(45.00);
    expect(refund.currency).toBe("USD");
    expect(refund.destination_account).toBe("acc_alice_101");
    expect(refund.status).toBe("issued");
    expect(refund.reason).toBe("Damaged item on delivery");
  });

  it("should retrieve status of an existing refund", async () => {
    const issueResult = await client.callTool({
      name: "issue_refund",
      arguments: {
        order_id: "4822",
        amount: 34.50,
        destination_account: "acc_alice_101"
      }
    });

    const issuedRefund = JSON.parse(getFirstTextContent(issueResult));
    const statusResult = await client.callTool({
      name: "get_refund_status",
      arguments: {
        refund_id: issuedRefund.refund_id
      }
    });

    expect(statusResult.isError).toBeFalsy();
    const retrieved = JSON.parse(getFirstTextContent(statusResult));
    expect(retrieved.refund_id).toBe(issuedRefund.refund_id);
    expect(retrieved.order_id).toBe("4822");
    expect(retrieved.amount).toBe(34.50);
    expect(retrieved.status).toBe("issued");
  });

  it("should return error for non-existent refund_id", async () => {
    const result = await client.callTool({
      name: "get_refund_status",
      arguments: {
        refund_id: "ref_nonexistent_9999"
      }
    });

    expect(result.isError).toBe(true);
    expect(getFirstTextContent(result)).toContain("Refund record not found with ID: ref_nonexistent_9999");
  });

  it("should reject issue_refund with negative amount", async () => {
    const result = await client.callTool({
      name: "issue_refund",
      arguments: {
        order_id: "4821",
        amount: -25.00,
        destination_account: "acc_alice_101"
      }
    });

    expect(result.isError).toBe(true);
  });

  it("should reject issue_refund with zero amount", async () => {
    const result = await client.callTool({
      name: "issue_refund",
      arguments: {
        order_id: "4821",
        amount: 0,
        destination_account: "acc_alice_101"
      }
    });

    expect(result.isError).toBe(true);
  });

  it("should reject issue_refund with empty order_id", async () => {
    const result = await client.callTool({
      name: "issue_refund",
      arguments: {
        order_id: "",
        amount: 50.00,
        destination_account: "acc_alice_101"
      }
    });

    expect(result.isError).toBe(true);
  });

  it("should reject issue_refund with empty destination_account", async () => {
    const result = await client.callTool({
      name: "issue_refund",
      arguments: {
        order_id: "4821",
        amount: 50.00,
        destination_account: ""
      }
    });

    expect(result.isError).toBe(true);
  });

  it("should reject issue_refund with excessive amount exceeding single limit", async () => {
    const result = await client.callTool({
      name: "issue_refund",
      arguments: {
        order_id: "4821",
        amount: 50000.00,
        destination_account: "acc_alice_101"
      }
    });

    expect(result.isError).toBe(true);
  });

  it("should reject get_refund_status with empty refund_id", async () => {
    const result = await client.callTool({
      name: "get_refund_status",
      arguments: {
        refund_id: ""
      }
    });

    expect(result.isError).toBe(true);
  });
});

describe("Refunds Express App Endpoints", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createRefundsApp(new RefundService());
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

  it("should return healthy status and tool list on GET /health", async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);

    const body = (await response.json()) as { status: string; server: string; tools: string[] };
    expect(body.status).toBe("healthy");
    expect(body.server).toBe("refunds");
    expect(body.tools).toEqual(["issue_refund", "get_refund_status"]);
  });

  it("should return 400 on POST /message when sessionId is missing", async () => {
    const response = await fetch(`${baseUrl}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("Missing sessionId");
  });

  it("should return 404 on POST /message when sessionId is not found", async () => {
    const response = await fetch(`${baseUrl}/message?sessionId=unknown_refund_session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("Session not found");
  });
});
