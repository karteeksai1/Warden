import crypto from "node:crypto";
import { eq, inArray } from "@warden/shared";
import { tools as toolsTable } from "@warden/shared";
import type { DatabaseClient } from "@warden/shared";
import { computeSchemaHash } from "./downstream.js";

export interface PineconeIndexOperations {
  upsertRecords(options: { records: Array<Record<string, unknown>> }): Promise<void>;
  searchRecords(options: { query: { topK: number; inputs?: { text: string } } }): Promise<{
    result?: {
      hits?: Array<{ _id: string; _score?: number; fields?: Record<string, unknown> }>;
    };
  }>;
}

export interface PineconeClientLike {
  createIndexForModel?(options: {
    name: string;
    cloud: string;
    region: string;
    embed: {
      model: string;
      fieldMap: Record<string, string>;
      metric?: string;
    };
    suppressConflicts?: boolean;
    waitUntilReady?: boolean;
  }): Promise<unknown>;
  index(name: string): PineconeIndexOperations;
}

export interface BackoffOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
  maxDelayMs?: number;
  jitter?: boolean;
}

export interface ToolRecord {
  id: string;
  serverId: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  schemaHash: string;
  approvedHash: string | null;
  quarantined: boolean;
  isCore: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ToolRegistrationInput {
  id?: string;
  serverId: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  approvedHash?: string | null;
  autoApprove?: boolean;
  quarantined?: boolean;
  isCore?: boolean;
}

export interface ToolSearchResult {
  query: string;
  tools: ToolRecord[];
  coreTools: ToolRecord[];
  droppedCount: number;
}

export interface RouterDatabase {
  findToolById(id: string): Promise<ToolRecord | null>;
  findToolsByIds(ids: string[]): Promise<ToolRecord[]>;
  findCoreTools(): Promise<ToolRecord[]>;
  saveTool(tool: ToolRecord): Promise<ToolRecord>;
}

export function isRateLimitError(error: unknown): boolean {
  if (typeof error === "object" && error !== null) {
    const candidate = error as {
      status?: number;
      statusCode?: number;
      name?: string;
      message?: string;
      response?: { status?: number };
    };

    if (candidate.status === 429 || candidate.statusCode === 429 || candidate.response?.status === 429) {
      return true;
    }
    if (candidate.name === "PineconeRateLimitError" || candidate.name === "RateLimitError") {
      return true;
    }
    if (typeof candidate.message === "string") {
      const lower = candidate.message.toLowerCase();
      if (lower.includes("429") || lower.includes("rate limit") || lower.includes("resource_exhausted")) {
        return true;
      }
    }
  }
  return false;
}

export async function withExponentialBackoff<T>(
  operation: () => Promise<T>,
  options: BackoffOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 100;
  const backoffFactor = options.backoffFactor ?? 2;
  const maxDelayMs = options.maxDelayMs ?? 3000;
  const jitter = options.jitter ?? true;

  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      attempt++;
      const isRetryable = isRateLimitError(error);
      if (!isRetryable || attempt > maxRetries) {
        throw error;
      }
      const exponentialDelay = initialDelayMs * Math.pow(backoffFactor, attempt - 1);
      const delay = Math.min(maxDelayMs, exponentialDelay) + (jitter ? Math.random() * 20 : 0);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export function extractArgumentNames(inputSchema: unknown): string[] {
  if (typeof inputSchema === "object" && inputSchema !== null && "properties" in inputSchema) {
    const properties = (inputSchema as { properties?: Record<string, unknown> }).properties;
    if (typeof properties === "object" && properties !== null) {
      return Object.keys(properties);
    }
  }
  return [];
}

export function buildToolEmbeddingText(
  name: string,
  description: string,
  argumentNames: string[]
): string {
  const argumentSuffix = argumentNames.length > 0 ? ` Arguments: ${argumentNames.join(", ")}` : " Arguments: none";
  return `${name}: ${description}.${argumentSuffix}`;
}

export function computeCanonicalSchemaHash(schema: unknown): string {
  return computeSchemaHash(schema);
}

export class DrizzleRouterDatabase implements RouterDatabase {
  constructor(private readonly db: DatabaseClient) {}

  async findToolById(id: string): Promise<ToolRecord | null> {
    const rows = await this.db.select().from(toolsTable).where(eq(toolsTable.id, id));
    const row = rows[0];
    if (!row) {
      return null;
    }
    return this.mapRow(row);
  }

  async findToolsByIds(ids: string[]): Promise<ToolRecord[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.db.select().from(toolsTable).where(inArray(toolsTable.id, ids));
    return rows.map((row) => this.mapRow(row));
  }

  async findCoreTools(): Promise<ToolRecord[]> {
    const rows = await this.db.select().from(toolsTable).where(eq(toolsTable.isCore, true));
    return rows.map((row) => this.mapRow(row));
  }

  async saveTool(tool: ToolRecord): Promise<ToolRecord> {
    const existing = await this.findToolById(tool.id);
    if (existing) {
      const updatedRows = await this.db
        .update(toolsTable)
        .set({
          serverId: tool.serverId,
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          schemaHash: tool.schemaHash,
          approvedHash: tool.approvedHash,
          quarantined: tool.quarantined,
          isCore: tool.isCore,
          updatedAt: new Date()
        })
        .where(eq(toolsTable.id, tool.id))
        .returning();
      const updatedRow = updatedRows[0];
      if (!updatedRow) {
        throw new Error(`Failed to update tool: ${tool.id}`);
      }
      return this.mapRow(updatedRow);
    }

    const insertedRows = await this.db
      .insert(toolsTable)
      .values({
        id: tool.id,
        serverId: tool.serverId,
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        schemaHash: tool.schemaHash,
        approvedHash: tool.approvedHash,
        quarantined: tool.quarantined,
        isCore: tool.isCore
      })
      .returning();

    const insertedRow = insertedRows[0];
    if (!insertedRow) {
      throw new Error(`Failed to insert tool: ${tool.id}`);
    }
    return this.mapRow(insertedRow);
  }

  private mapRow(row: typeof toolsTable.$inferSelect): ToolRecord {
    return {
      id: row.id,
      serverId: row.serverId,
      name: row.name,
      description: row.description,
      inputSchema: row.inputSchema as Record<string, unknown>,
      schemaHash: row.schemaHash,
      approvedHash: row.approvedHash,
      quarantined: row.quarantined,
      isCore: row.isCore,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }
}

export class InMemoryRouterDatabase implements RouterDatabase {
  private readonly store: Map<string, ToolRecord> = new Map();

  async findToolById(id: string): Promise<ToolRecord | null> {
    return this.store.get(id) ?? null;
  }

  async findToolsByIds(ids: string[]): Promise<ToolRecord[]> {
    const results: ToolRecord[] = [];
    for (const id of ids) {
      const item = this.store.get(id);
      if (item) {
        results.push(item);
      }
    }
    return results;
  }

  async findCoreTools(): Promise<ToolRecord[]> {
    const coreList: ToolRecord[] = [];
    for (const item of this.store.values()) {
      if (item.isCore) {
        coreList.push(item);
      }
    }
    return coreList;
  }

  async saveTool(tool: ToolRecord): Promise<ToolRecord> {
    this.store.set(tool.id, { ...tool });
    return tool;
  }
}

export const SEARCH_TOOLS_NAME = "search_tools";

export const SEARCH_TOOLS_INPUT_SCHEMA = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "Description of desired functionality or intent"
    },
    top_k: {
      type: "number",
      description: "Maximum number of tools to retrieve (default: 5)"
    }
  },
  required: ["query"]
};

export const SEARCH_TOOLS_DEFINITION = {
  name: SEARCH_TOOLS_NAME,
  description: "Search for available tools matching a task description or query. Activates matches and refreshes tool list.",
  inputSchema: SEARCH_TOOLS_INPUT_SCHEMA
};

export interface RouterOptions {
  backoffOptions?: BackoffOptions;
  onToolListChanged?: () => Promise<void> | void;
}

export async function ensurePineconeIntegratedIndex(
  pinecone: PineconeClientLike,
  indexName: string,
  options: { cloud?: string; region?: string; waitUntilReady?: boolean } = {}
): Promise<void> {
  if (typeof pinecone.createIndexForModel === "function") {
    try {
      await pinecone.createIndexForModel({
        name: indexName,
        cloud: options.cloud ?? "aws",
        region: options.region ?? "us-east-1",
        embed: {
          model: "llama-text-embed-v2",
          fieldMap: { text: "text" },
          metric: "cosine"
        },
        suppressConflicts: true,
        waitUntilReady: options.waitUntilReady ?? false
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("ALREADY_EXISTS") && !message.includes("already exists")) {
        throw error;
      }
    }
  }
}

export class SemanticToolRouter {
  private readonly database: RouterDatabase;
  private readonly pineconeIndex: PineconeIndexOperations;
  private readonly backoffOptions: BackoffOptions;
  private onToolListChangedCallback?: () => Promise<void> | void;
  private activeDiscoveredTools: Map<string, ToolRecord> = new Map();

  constructor(
    pineconeIndex: PineconeIndexOperations,
    database: RouterDatabase | DatabaseClient,
    options: RouterOptions = {}
  ) {
    this.pineconeIndex = pineconeIndex;
    if ("findToolById" in database) {
      this.database = database;
    } else {
      this.database = new DrizzleRouterDatabase(database);
    }
    this.backoffOptions = options.backoffOptions ?? {};
    this.onToolListChangedCallback = options.onToolListChanged;
  }

  setNotificationHandler(callback: () => Promise<void> | void): void {
    this.onToolListChangedCallback = callback;
  }

  async registerTool(input: ToolRegistrationInput): Promise<ToolRecord> {
    const id = input.id ?? crypto.randomUUID();
    const argumentNames = extractArgumentNames(input.inputSchema);
    const schemaHash = computeCanonicalSchemaHash({
      name: input.name,
      description: input.description,
      inputSchema: input.inputSchema
    });

    let approvedHash = input.approvedHash ?? null;
    if (approvedHash === null && input.autoApprove === true) {
      approvedHash = schemaHash;
    }

    const toolRecord: ToolRecord = {
      id,
      serverId: input.serverId,
      name: input.name,
      description: input.description,
      inputSchema: input.inputSchema,
      schemaHash,
      approvedHash,
      quarantined: input.quarantined ?? false,
      isCore: input.isCore ?? false
    };

    const saved = await this.database.saveTool(toolRecord);

    const embeddingText = buildToolEmbeddingText(saved.name, saved.description, argumentNames);

    await withExponentialBackoff(
      () =>
        this.pineconeIndex.upsertRecords({
          records: [
            {
              _id: saved.id,
              text: embeddingText,
              name: saved.name,
              description: saved.description,
              argument_names: argumentNames,
              server_id: saved.serverId
            }
          ]
        }),
      this.backoffOptions
    );

    return saved;
  }

  async searchTools(query: string, topK: number = 5): Promise<ToolSearchResult> {
    const pineconeResponse = await withExponentialBackoff(
      () =>
        this.pineconeIndex.searchRecords({
          query: {
            topK,
            inputs: { text: query }
          }
        }),
      this.backoffOptions
    );

    const hits = pineconeResponse.result?.hits ?? [];
    const hitIds = hits.map((hit) => hit._id);

    const candidateTools = await this.database.findToolsByIds(hitIds);
    const coreCandidateTools = await this.database.findCoreTools();

    const toolIdToCandidate = new Map<string, ToolRecord>();
    for (const tool of candidateTools) {
      toolIdToCandidate.set(tool.id, tool);
    }

    let droppedCount = 0;
    const verifiedMatchedTools: ToolRecord[] = [];

    for (const hitId of hitIds) {
      const tool = toolIdToCandidate.get(hitId);
      if (!tool) {
        droppedCount++;
        continue;
      }

      if (this.isToolApprovedAndSafe(tool)) {
        verifiedMatchedTools.push(tool);
      } else {
        droppedCount++;
      }
    }

    const verifiedCoreTools: ToolRecord[] = [];
    for (const coreTool of coreCandidateTools) {
      if (this.isToolApprovedAndSafe(coreTool)) {
        verifiedCoreTools.push(coreTool);
      }
    }

    for (const tool of verifiedMatchedTools) {
      this.activeDiscoveredTools.set(tool.name, tool);
    }

    if (this.onToolListChangedCallback) {
      await this.onToolListChangedCallback();
    }

    return {
      query,
      tools: verifiedMatchedTools,
      coreTools: verifiedCoreTools,
      droppedCount
    };
  }

  async getActiveTools(): Promise<ToolRecord[]> {
    const coreCandidateTools = await this.database.findCoreTools();
    const approvedCoreTools = coreCandidateTools.filter((t) => this.isToolApprovedAndSafe(t));

    const combinedMap = new Map<string, ToolRecord>();
    for (const coreTool of approvedCoreTools) {
      combinedMap.set(coreTool.name, coreTool);
    }
    for (const [name, discoveredTool] of this.activeDiscoveredTools.entries()) {
      if (this.isToolApprovedAndSafe(discoveredTool)) {
        combinedMap.set(name, discoveredTool);
      }
    }

    return Array.from(combinedMap.values());
  }

  isToolApprovedAndSafe(tool: ToolRecord): boolean {
    if (tool.quarantined) {
      return false;
    }
    if (!tool.approvedHash) {
      return false;
    }
    if (tool.approvedHash !== tool.schemaHash) {
      return false;
    }
    return true;
  }
}
