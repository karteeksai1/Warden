import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createKbMcpServer } from "../src/server.js";
import { PolicyService } from "../src/service.js";
import { createKbApp } from "../src/app.js";
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

describe("KB MCP Server Tools", () => {
  let client: Client;
  let clientTransport: InMemoryTransport;
  let serverTransport: InMemoryTransport;

  beforeAll(async () => {
    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createKbMcpServer(new PolicyService());
    await server.connect(serverTransport);

    client = new Client({ name: "test-client", version: "0.1.0" });
    await client.connect(clientTransport);
  });

  afterAll(async () => {
    await client.close();
  });

  it("should list search_policy tool with accurate description and schema", async () => {
    const response = await client.listTools();
    const toolNames = response.tools.map((tool) => tool.name);

    expect(toolNames).toContain("search_policy");

    const searchTool = response.tools.find((tool) => tool.name === "search_policy");
    expect(searchTool?.description).toContain("Search e-commerce store policies");
    expect(searchTool?.inputSchema.properties).toHaveProperty("query");
  });

  it("should return damaged goods policy for damaged items query", async () => {
    const result = await client.callTool({
      name: "search_policy",
      arguments: {
        query: "Order arrived damaged and defective"
      }
    });

    expect(result.isError).toBeFalsy();
    expect(getFirstContentType(result)).toBe("text");

    const content = getFirstTextContent(result);
    expect(content).toContain("Damaged or Defective Items Policy");
    expect(content).toContain("pol_damaged_goods");
    expect(content).toContain("auto-approved");
  });

  it("should return manager approval policy for threshold queries", async () => {
    const result = await client.callTool({
      name: "search_policy",
      arguments: {
        query: "manager approval over 50 threshold"
      }
    });

    expect(result.isError).toBeFalsy();
    const content = getFirstTextContent(result);
    expect(content).toContain("Refund Amount Limits and Manager Approval Policy");
    expect(content).toContain("pol_refund_thresholds");
    expect(content).toContain("$50.00");
    expect(content).toContain("$1,000.00");
  });

  it("should return electronics restocking policy for electronics return queries", async () => {
    const result = await client.callTool({
      name: "search_policy",
      arguments: {
        query: "electronics restocking fee headphones"
      }
    });

    expect(result.isError).toBeFalsy();
    const content = getFirstTextContent(result);
    expect(content).toContain("Consumer Electronics and Open-Box Restocking Fee Policy");
    expect(content).toContain("pol_electronics_restocking");
    expect(content).toContain("15%");
  });

  it("should return carrier dispute policy for lost in transit queries", async () => {
    const result = await client.callTool({
      name: "search_policy",
      arguments: {
        query: "carrier tracking dispute lost in transit"
      }
    });

    expect(result.isError).toBeFalsy();
    const content = getFirstTextContent(result);
    expect(content).toContain("Carrier Tracking and Lost in Transit Policy");
    expect(content).toContain("pol_carrier_disputes");
  });

  it("should return informative message when no policies match", async () => {
    const result = await client.callTool({
      name: "search_policy",
      arguments: {
        query: "quantum computing astrophysics teleportation"
      }
    });

    expect(result.isError).toBeFalsy();
    const content = getFirstTextContent(result);
    expect(content).toContain("No policies matched query");
  });

  it("should reject search_policy with empty query", async () => {
    const result = await client.callTool({
      name: "search_policy",
      arguments: {
        query: ""
      }
    });

    expect(result.isError).toBe(true);
  });
});

describe("KB Express App Endpoints", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createKbApp(new PolicyService());
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
    expect(body.server).toBe("kb");
    expect(body.tools).toEqual(["search_policy"]);
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
    const response = await fetch(`${baseUrl}/message?sessionId=unknown_kb_session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("Session not found");
  });
});
