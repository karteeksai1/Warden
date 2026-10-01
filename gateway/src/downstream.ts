import crypto from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { CallToolResult, Tool as McpTool } from "@modelcontextprotocol/sdk/types.js";
import { DownstreamServerConfig } from "./types.js";

export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalizeJson).join(",") + "]";
  }
  const record = value as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const pairs = sortedKeys.map((key) => `${JSON.stringify(key)}:${canonicalizeJson(record[key])}`);
  return "{" + pairs.join(",") + "}";
}

export function computeSchemaHash(schema: unknown): string {
  const canonical = canonicalizeJson(schema);
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

export interface NamespacedTool {
  namespacedName: string;
  serverName: string;
  originalName: string;
  description: string;
  inputSchema: McpTool["inputSchema"];
  schemaHash: string;
}

export interface ServerConnectionState {
  config: DownstreamServerConfig;
  client: Client;
  transport?: Transport;
  status: "healthy" | "unhealthy" | "connecting";
  tools: Map<string, NamespacedTool>;
  lastHealthCheckAt?: string;
  latencyMs?: number;
}

export class DownstreamManager {
  private readonly servers: Map<string, ServerConnectionState> = new Map();
  private readonly toolRegistry: Map<string, NamespacedTool> = new Map();

  registerServer(config: DownstreamServerConfig, existingClient?: Client): void {
    const client = existingClient ?? new Client({ name: `gateway-to-${config.name}`, version: "0.1.0" });
    this.servers.set(config.name, {
      config,
      client,
      status: "connecting",
      tools: new Map()
    });
  }

  async connectServer(name: string, customTransport?: Transport): Promise<void> {
    const serverState = this.servers.get(name);
    if (!serverState) {
      throw new Error(`Server ${name} not found in registry`);
    }

    try {
      let transport: Transport;
      if (customTransport) {
        transport = customTransport;
      } else if (serverState.config.transport === "http") {
        transport = new SSEClientTransport(new URL(serverState.config.endpoint));
      } else if (serverState.config.transport === "stdio") {
        if (!serverState.config.command) {
          throw new Error(`Stdio transport for ${name} requires 'command' configuration`);
        }
        transport = new StdioClientTransport({
          command: serverState.config.command,
          args: serverState.config.args ?? []
        });
      } else {
        throw new Error(`Unsupported transport for ${name}`);
      }

      await serverState.client.connect(transport);
      serverState.transport = transport;
      serverState.status = "healthy";
      serverState.lastHealthCheckAt = new Date().toISOString();

      await this.refreshServerTools(name);
    } catch (error) {
      serverState.status = "unhealthy";
      throw error;
    }
  }

  async refreshServerTools(serverName: string): Promise<NamespacedTool[]> {
    const serverState = this.servers.get(serverName);
    if (!serverState || serverState.status !== "healthy") {
      return [];
    }

    const response = await serverState.client.listTools();
    const namespacedList: NamespacedTool[] = [];

    for (const tool of response.tools) {
      const namespacedName = `${serverName}.${tool.name}`;
      const schemaHash = computeSchemaHash({
        name: tool.name,
        description: tool.description ?? "",
        inputSchema: tool.inputSchema
      });

      const namespacedTool: NamespacedTool = {
        namespacedName,
        serverName,
        originalName: tool.name,
        description: tool.description ?? "",
        inputSchema: tool.inputSchema,
        schemaHash
      };

      serverState.tools.set(namespacedName, namespacedTool);
      this.toolRegistry.set(namespacedName, namespacedTool);
      namespacedList.push(namespacedTool);
    }

    return namespacedList;
  }

  async reconnectServer(name: string): Promise<void> {
    const serverState = this.servers.get(name);
    if (!serverState) {
      throw new Error(`Server ${name} not registered`);
    }

    try {
      if (serverState.transport) {
        await serverState.transport.close().catch(() => {});
      }
    } catch {
    }

    await this.connectServer(name);
  }

  getServers(): Array<{ name: string; transport: string; endpoint: string; status: string; toolsCount: number }> {
    return Array.from(this.servers.values()).map((s) => ({
      name: s.config.name,
      transport: s.config.transport,
      endpoint: s.config.endpoint,
      status: s.status,
      toolsCount: s.tools.size
    }));
  }

  getAllTools(): NamespacedTool[] {
    return Array.from(this.toolRegistry.values());
  }

  getTool(namespacedName: string): NamespacedTool | undefined {
    return this.toolRegistry.get(namespacedName);
  }

  async callTool(namespacedName: string, args: Record<string, unknown>): Promise<CallToolResult> {
    const namespacedTool = this.toolRegistry.get(namespacedName);

    if (!namespacedTool) {
      throw new Error(`Unknown tool: ${namespacedName}`);
    }

    const serverState = this.servers.get(namespacedTool.serverName);
    if (!serverState) {
      throw new Error(`Server ${namespacedTool.serverName} unavailable`);
    }

    try {
      const result = await serverState.client.callTool({
        name: namespacedTool.originalName,
        arguments: args
      });
      return result as CallToolResult;
    } catch (error) {
      serverState.status = "unhealthy";
      throw error;
    }
  }

  async checkHealth(): Promise<Record<string, { status: string; latencyMs: number }>> {
    const report: Record<string, { status: string; latencyMs: number }> = {};

    for (const [name, state] of this.servers.entries()) {
      const startTime = Date.now();
      try {
        if (state.config.transport === "http") {
          const healthUrl = new URL("/health", state.config.endpoint);
          const response = await fetch(healthUrl.toString(), { signal: AbortSignal.timeout(3000) });
          const latency = Date.now() - startTime;
          state.status = response.ok ? "healthy" : "unhealthy";
          state.latencyMs = latency;
          report[name] = { status: state.status, latencyMs: latency };
        } else {
          await state.client.listTools();
          const latency = Date.now() - startTime;
          state.status = "healthy";
          state.latencyMs = latency;
          report[name] = { status: "healthy", latencyMs: latency };
        }
      } catch {
        const latency = Date.now() - startTime;
        state.status = "unhealthy";
        state.latencyMs = latency;
        report[name] = { status: "unhealthy", latencyMs: latency };
      }
    }

    return report;
  }

  async disconnectAll(): Promise<void> {
    for (const state of this.servers.values()) {
      try {
        await state.client.close().catch(() => {});
        if (state.transport) {
          await state.transport.close().catch(() => {});
        }
      } catch {
      }
    }
    this.toolRegistry.clear();
  }
}
