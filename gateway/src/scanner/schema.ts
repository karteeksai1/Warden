import { eq, tools as toolsTable, DatabaseClient } from "@warden/shared";
import { computeSchemaHash } from "../downstream.js";
import { ToolRecord, RouterDatabase } from "../router.js";
import { SchemaScanVerdict } from "./types.js";

export interface SchemaScannerDatabase {
  findToolById(id: string): Promise<ToolRecord | null>;
  quarantineTool(id: string): Promise<void>;
}

export function computeToolCanonicalHash(schemaInput: unknown): string {
  return computeSchemaHash(schemaInput);
}

export class DrizzleSchemaScannerDatabase implements SchemaScannerDatabase {
  constructor(private readonly db: DatabaseClient) {}

  async findToolById(id: string): Promise<ToolRecord | null> {
    const rows = await this.db.select().from(toolsTable).where(eq(toolsTable.id, id));
    const row = rows[0];
    if (!row) {
      return null;
    }
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

  async quarantineTool(id: string): Promise<void> {
    await this.db
      .update(toolsTable)
      .set({ quarantined: true, updatedAt: new Date() })
      .where(eq(toolsTable.id, id));
  }
}

export class RouterDatabaseSchemaAdapter implements SchemaScannerDatabase {
  constructor(private readonly routerDb: RouterDatabase) {}

  async findToolById(id: string): Promise<ToolRecord | null> {
    return this.routerDb.findToolById(id);
  }

  async quarantineTool(id: string): Promise<void> {
    const tool = await this.routerDb.findToolById(id);
    if (tool) {
      tool.quarantined = true;
      tool.updatedAt = new Date();
      await this.routerDb.saveTool(tool);
    }
  }
}

export function resolveSchemaDatabase(
  db: SchemaScannerDatabase | RouterDatabase | DatabaseClient
): SchemaScannerDatabase {
  if ("quarantineTool" in db && typeof db.quarantineTool === "function") {
    return db as SchemaScannerDatabase;
  }
  if ("saveTool" in db && typeof db.saveTool === "function") {
    return new RouterDatabaseSchemaAdapter(db as RouterDatabase);
  }
  return new DrizzleSchemaScannerDatabase(db as DatabaseClient);
}

export async function verifyToolSchemaIntegrity(
  toolId: string,
  currentSchema: unknown,
  databaseInput: SchemaScannerDatabase | RouterDatabase | DatabaseClient
): Promise<SchemaScanVerdict> {
  const db = resolveSchemaDatabase(databaseInput);
  const computedHash = computeToolCanonicalHash(currentSchema);

  const tool = await db.findToolById(toolId);
  if (!tool) {
    return {
      safe: false,
      computedHash,
      approvedHash: null,
      quarantined: false,
      reason: `Tool not found in database: ${toolId}`,
      confidence: 1.0
    };
  }

  if (tool.approvedHash === null) {
    await db.quarantineTool(toolId);
    return {
      safe: false,
      computedHash,
      approvedHash: null,
      quarantined: true,
      reason: "Tool has never been approved by administrator: automatically quarantined",
      confidence: 1.0
    };
  }

  if (tool.approvedHash !== computedHash) {
    await db.quarantineTool(toolId);
    return {
      safe: false,
      computedHash,
      approvedHash: tool.approvedHash,
      quarantined: true,
      reason: `Schema hash mismatch (expected approved ${tool.approvedHash}, received ${computedHash}): potential rug pull detected, automatically quarantined`,
      confidence: 1.0
    };
  }

  return {
    safe: !tool.quarantined,
    computedHash,
    approvedHash: tool.approvedHash,
    quarantined: tool.quarantined,
    reason: tool.quarantined
      ? "Tool schema matches approved hash but tool is currently quarantined"
      : "Tool schema integrity verified against approved hash",
    confidence: 1.0
  };
}
