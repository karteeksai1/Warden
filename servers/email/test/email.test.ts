import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createEmailMcpServer } from "../src/server.js";
import { EmailService } from "../src/service.js";
import { createEmailApp } from "../src/app.js";
import { Server } from "node:http";

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

describe("Email MCP Server Tools", () => {
  let client: Client;
  let clientTransport: InMemoryTransport;
  let serverTransport: InMemoryTransport;
  let emailService: EmailService;

  beforeAll(async () => {
    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    emailService = new EmailService();
    const server = createEmailMcpServer(emailService);
    await server.connect(serverTransport);

    client = new Client({ name: "test-client", version: "0.1.0" });
    await client.connect(clientTransport);
  });

  afterAll(async () => {
    await client.close();
  });

  it("should list send_confirmation tool with accurate description and schema", async () => {
    const response = await client.listTools();
    const toolNames = response.tools.map((tool) => tool.name);

    expect(toolNames).toContain("send_confirmation");

    const emailTool = response.tools.find((tool) => tool.name === "send_confirmation");
    expect(emailTool?.description).toContain("Send a transactional order status or refund confirmation");
    expect(emailTool?.inputSchema.properties).toHaveProperty("to");
    expect(emailTool?.inputSchema.properties).toHaveProperty("subject");
    expect(emailTool?.inputSchema.properties).toHaveProperty("body");
    expect(emailTool?.inputSchema.properties).toHaveProperty("order_id");
  });

  it("should send confirmation email and store record in audit log", async () => {
    const result = await client.callTool({
      name: "send_confirmation",
      arguments: {
        to: "alice.smith@example.com",
        subject: "Refund Processed for Order #4821",
        body: "Your refund of $89.99 for order #4821 has been issued to your account.",
        order_id: "4821"
      }
    });

    expect(result.isError).toBeFalsy();
    expect(getFirstContentType(result)).toBe("text");

    const emailRecord = JSON.parse(getFirstTextContent(result));
    expect(emailRecord.id).toMatch(/^eml_/);
    expect(emailRecord.to).toBe("alice.smith@example.com");
    expect(emailRecord.subject).toBe("Refund Processed for Order #4821");
    expect(emailRecord.order_id).toBe("4821");
    expect(emailRecord.status).toBe("logged");

    const auditLog = emailService.getAuditLog();
    expect(auditLog.length).toBeGreaterThanOrEqual(1);
    expect(auditLog.some((item) => item.id === emailRecord.id)).toBe(true);
  });

  it("should reject send_confirmation with invalid email format", async () => {
    const result = await client.callTool({
      name: "send_confirmation",
      arguments: {
        to: "not-a-valid-email-address",
        subject: "Status Update",
        body: "Test body"
      }
    });

    expect(result.isError).toBe(true);
  });

  it("should reject send_confirmation with empty subject", async () => {
    const result = await client.callTool({
      name: "send_confirmation",
      arguments: {
        to: "alice@example.com",
        subject: "",
        body: "Test body"
      }
    });

    expect(result.isError).toBe(true);
  });

  it("should reject send_confirmation with empty body", async () => {
    const result = await client.callTool({
      name: "send_confirmation",
      arguments: {
        to: "alice@example.com",
        subject: "Status Update",
        body: ""
      }
    });

    expect(result.isError).toBe(true);
  });
});

describe("Email Stdio Integration Test", () => {
  it("should connect to email stdio server process and invoke send_confirmation tool", async () => {
    const stdioScriptPath = path.resolve(currentDirectory, "../src/stdio.ts");
    const stdioTransport = new StdioClientTransport({
      command: "npx",
      args: ["tsx", stdioScriptPath]
    });

    const stdioClient = new Client({ name: "stdio-test-client", version: "0.1.0" });
    await stdioClient.connect(stdioTransport);

    const toolsResponse = await stdioClient.listTools();
    expect(toolsResponse.tools.map((tool) => tool.name)).toContain("send_confirmation");

    const callResult = await stdioClient.callTool({
      name: "send_confirmation",
      arguments: {
        to: "manager@company.com",
        subject: "Manager Approval Notification",
        body: "A refund exceeding $50 requires your approval.",
        order_id: "4821"
      }
    });

    expect(callResult.isError).toBeFalsy();
    const parsedResult = JSON.parse(getFirstTextContent(callResult));
    expect(parsedResult.id).toMatch(/^eml_/);
    expect(parsedResult.to).toBe("manager@company.com");
    expect(parsedResult.status).toBe("logged");

    await stdioClient.close();
  });
});

describe("Email Express App Endpoints", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createEmailApp(new EmailService());
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
    expect(body.server).toBe("email");
    expect(body.tools).toEqual(["send_confirmation"]);
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
    const response = await fetch(`${baseUrl}/message?sessionId=unknown_email_session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("Session not found");
  });
});
