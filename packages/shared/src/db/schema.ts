import { pgTable, uuid, text, timestamp, boolean, jsonb, integer, pgEnum, index } from "drizzle-orm/pg-core";

export const serverTransportEnum = pgEnum("server_transport", ["http", "stdio"]);
export const serverStatusEnum = pgEnum("server_status", ["healthy", "unhealthy", "disabled"]);
export const policyDecisionEnum = pgEnum("policy_decision", ["allow", "deny", "require_approval"]);
export const approvalStatusEnum = pgEnum("approval_status", ["pending", "approved", "rejected", "expired", "executed"]);

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  apiKeyHash: text("api_key_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const servers = pgTable("servers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  transport: serverTransportEnum("transport").notNull(),
  endpoint: text("endpoint").notNull(),
  status: serverStatusEnum("status").default("healthy").notNull(),
  lastHealthCheckAt: timestamp("last_health_check_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const tools = pgTable("tools", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id").notNull().references(() => servers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  inputSchema: jsonb("input_schema").notNull(),
  schemaHash: text("schema_hash").notNull(),
  approvedHash: text("approved_hash"),
  quarantined: boolean("quarantined").default(false).notNull(),
  isCore: boolean("is_core").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  toolsServerIdIndex: index("tools_server_id_idx").on(table.serverId),
  toolsNameIndex: index("tools_name_idx").on(table.name)
}));

export const traces = pgTable("traces", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: text("session_id").notNull(),
  agentId: uuid("agent_id").notNull().references(() => agents.id),
  toolId: uuid("tool_id").references(() => tools.id),
  toolName: text("tool_name").notNull(),
  arguments: jsonb("arguments"),
  result: jsonb("result"),
  policyDecision: policyDecisionEnum("policy_decision").notNull(),
  scannerVerdict: jsonb("scanner_verdict"),
  latencyMs: integer("latency_ms").notNull(),
  tokensIn: integer("tokens_in").default(0).notNull(),
  tokensOut: integer("tokens_out").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  tracesSessionIdIndex: index("traces_session_id_idx").on(table.sessionId),
  tracesAgentIdIndex: index("traces_agent_id_idx").on(table.agentId),
  tracesCreatedAtIndex: index("traces_created_at_idx").on(table.createdAt)
}));

export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  traceId: uuid("trace_id").notNull().references(() => traces.id),
  toolName: text("tool_name").notNull(),
  arguments: jsonb("arguments").notNull(),
  argumentsHash: text("arguments_hash").notNull(),
  status: approvalStatusEnum("status").default("pending").notNull(),
  decidedBy: text("decided_by"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  approvalsTraceIdIndex: index("approvals_trace_id_idx").on(table.traceId),
  approvalsStatusIndex: index("approvals_status_idx").on(table.status)
}));

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type Server = typeof servers.$inferSelect;
export type NewServer = typeof servers.$inferInsert;
export type Tool = typeof tools.$inferSelect;
export type NewTool = typeof tools.$inferInsert;
export type Trace = typeof traces.$inferSelect;
export type NewTrace = typeof traces.$inferInsert;
export type Approval = typeof approvals.$inferSelect;
export type NewApproval = typeof approvals.$inferInsert;
