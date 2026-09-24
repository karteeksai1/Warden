# System Specification: Warden MCP Gateway

## 1. System Overview

Warden is an intelligent reverse proxy and policy enforcement layer positioned between AI agents (MCP clients) and downstream tools (MCP servers).

```
[ AI Agent (LangGraph / Claude / GPT) ]
                   │
                   ▼ (Streamable HTTP / SSE)
         ┌───────────────────┐
         │   Warden Gateway  │ ◄─── Upstash Redis (REDIS_URL) & Neon Postgres
         └─────────┬─────────┘
   ┌───────────────┼───────────────┬──────────────┐
   ▼               ▼               ▼              ▼
[orders]       [refunds]         [kb]          [email]
(HTTP MCP)     (HTTP MCP)     (HTTP MCP)     (HTTP MCP / stdio)
```

In development, all components (gateway, 4 downstream servers, dashboard) run concurrently as native Node.js processes via `npm run dev:all`. Docker packaging and `docker-compose.yml` are deferred to Phase 9.

---

## 2. Data Model (Postgres via Drizzle ORM)

PostgreSQL (Neon) is the primary relational source of truth.

### Tables

1. `agents`
   - `id`: UUID (Primary Key, default random)
   - `name`: Text (Unique, not null)
   - `api_key_hash`: Text (SHA-256 of agent API key, not null)
   - `created_at`: Timestamp with time zone (not null, default now)

2. `servers`
   - `id`: UUID (Primary Key)
   - `name`: Text (Unique, not null)
   - `transport`: Enum (`http`, `stdio`)
   - `endpoint`: Text (URL or executable path, not null)
   - `status`: Enum (`healthy`, `unhealthy`, `disabled`)
   - `last_health_check_at`: Timestamp with time zone
   - `created_at`: Timestamp with time zone

3. `tools`
   - `id`: UUID (Primary Key)
   - `server_id`: UUID (Foreign Key -> `servers.id`, on delete cascade)
   - `name`: Text (Namespaced e.g. `orders.get_order`, not null)
   - `description`: Text (not null)
   - `input_schema`: JSONB (not null)
   - `schema_hash`: Text (SHA-256 of canonicalized schema, not null)
   - `approved_hash`: Text (SHA-256 approved by admin, nullable)
   - `quarantined`: Boolean (default false, not null)
   - `is_core`: Boolean (default false, not null)
   - `created_at`: Timestamp with time zone
   - `updated_at`: Timestamp with time zone

4. `traces`
   - `id`: UUID (Primary Key)
   - `session_id`: Text (Indexed, not null)
   - `agent_id`: UUID (Foreign Key -> `agents.id`, not null)
   - `tool_id`: UUID (Foreign Key -> `tools.id`, nullable)
   - `tool_name`: Text (not null)
   - `arguments`: JSONB (Raw input arguments)
   - `result`: JSONB (Downstream response or error)
   - `policy_decision`: Enum (`allow`, `deny`, `require_approval`, not null)
   - `scanner_verdict`: JSONB (Injection flags, PII matches, sanitization details)
   - `latency_ms`: Integer (Total duration in ms)
   - `tokens_in`: Integer (Estimated prompt tokens)
   - `tokens_out`: Integer (Estimated completion tokens)
   - `created_at`: Timestamp with time zone (not null, default now)

5. `approvals`
   - `id`: UUID (Primary Key)
   - `trace_id`: UUID (Foreign Key -> `traces.id`, not null)
   - `tool_name`: Text (not null)
   - `arguments`: JSONB (not null)
   - `arguments_hash`: Text (SHA-256 of canonical JSON arguments, not null)
   - `status`: Enum (`pending`, `approved`, `rejected`, `expired`, `executed`)
   - `decided_by`: Text (User ID or email, nullable)
   - `decided_at`: Timestamp with time zone (nullable)
   - `expires_at`: Timestamp with time zone (not null, default now + 24 hours)
   - `created_at`: Timestamp with time zone (not null, default now)

---

## 3. Vector Search & Semantic Routing (Pinecone Integrated Embeddings)

- **Vector Database:** Pinecone index with integrated embedding support.
- **Embedding Model:** Hosted `llama-text-embed-v2` (Pinecone managed embedding).
- **Index Strategy:**
  - Tools are upserted with metadata: `tool_id`, `name`, `description`, `server_id`.
  - Vectors are keyed directly by `tool_id` (PostgreSQL UUID string).
  - Postgres remains the definitive source of truth.
  - After Pinecone vector retrieval, results are joined/filtered against Postgres: any tool with `quarantined = true` or `approved_hash != schema_hash` is discarded immediately.
- **Index Synchronization:**
  - When a tool schema updates, its record is updated in Postgres and re-upserted into Pinecone.
  - When a tool is quarantined or removed, its vector record is purged or filtered out.
- **Reliability & Performance:**
  - 429 rate limit responses from Pinecone are handled with jittered exponential backoff.
  - Tool semantic search queries are cached in Redis with a TTL of 300 seconds.
  - Router latency is tracked and reported as an isolated metric in telemetry and benchmarks.

---

## 4. Policy Engine & Deterministic Rules

The policy engine operates with zero LLM dependence. Rules are declared in YAML and validated via Zod schemas at startup.

### Capabilities
- **Agent Tool Permissions:** Glob-based allow/deny patterns (e.g. `orders.*`, `refunds.get_*`).
- **Token Bucket Rate Limiting:** Enforced via Redis atomic Lua scripts (e.g. max 30 calls/minute per agent).
- **Argument Value Constraints:** Numeric range caps (e.g. `amount <= 50` for auto-approval, `amount > 50` requires approval).
- **Cumulative Quotas:** Rolling daily totals stored in Redis (e.g. max $1000 refunds per day across all agents).
- **Relational Integrity Checks:** Cross-field checks (e.g., destination account must match order record account).

### Approval Workflow
- When a policy evaluates to `require_approval`:
  1. A pending trace and an `approvals` record are created with the SHA-256 hash of the canonicalized arguments.
  2. The gateway immediately terminates the tool call with a structured response:
     ```json
     {
       "status": "PENDING_APPROVAL",
       "approval_id": "<uuid>",
       "message": "This action requires human approval. Do not retry this tool call immediately. Check status later using gateway.check_approval."
     }
     ```
  3. The agent is exposed a core tool: `gateway.check_approval(approval_id)`.
  4. Once approved via the dashboard, the gateway independently executes the stored call idempotently against the downstream server.
  5. The approval verification strictly compares the stored arguments hash before execution. Approvals expire 24 hours after creation.

---

## 5. Security Scanner

### 1. Schema Integrity ("Rug Pull" Detection)
- Tool schemas (name, description, input parameters) are canonicalized using RFC 8785 (deterministic JSON key ordering).
- A SHA-256 hash is generated and compared against `tools.approved_hash`.
- Any modification without explicit admin re-approval immediately sets `quarantined = true` and raises an alert.

### 2. Description Poisoning Defense
- Inspects tool descriptions at registration time:
  - Invisible Unicode characters (zero-width spaces, directional overrides).
  - Malicious markdown injection or concealed URL references.
  - Regex patterns indicating override attempts (`ignore previous instructions`, `system override`).
  - Optional fallback classifier for boundary cases.

### 3. Input & Output Inspection / Redaction
- **Prompt Injection:** Heuristic scanner for typical jailbreaks, evasion markers, and jailbreak templates in arguments and tool responses.
- **Data Redaction:** High-performance regex pipeline masking:
  - Credit card numbers (Luhn validated).
  - Social security numbers / tax identifiers.
  - Personal email addresses.
  - API keys and Bearer tokens (AWS, OpenAI, GitHub, Stripe formats).

---

## 6. Request Lifecycle

```
[Agent Tool Call Request]
          │
          ▼
1. Authenticate (API key hashed and validated against `agents`)
          │
          ▼
2. Policy Engine (Glob permissions, Redis token bucket, argument bounds)
   ├─ Denied ─────────────► Return MCP Error + Record Trace
   ├─ Require Approval ───► Store Pending Approval + Return PENDING_APPROVAL
   └─ Allowed
          │
          ▼
3. Input Security Scan (Injection detection, schema validation)
   ├─ Malicious ──────────► Return Security Violation + Alert
   └─ Clean
          │
          ▼
4. Forward to Downstream Server (HTTP or stdio transport)
          │
          ▼
5. Output Security Scan & Redaction (Mask PII/keys, check response injection)
          │
          ▼
6. Asynchronous Trace Write (Postgres trace record queued off hot path)
          │
          ▼
[Return Sanitized Result to Agent]
```

---

## 7. Eval Harness & Metrics

### Configurations
- **Config A:** Baseline direct MCP connection (all tools exposed, no gateway).
- **Config B:** Router only (Pinecone dynamic discovery + core tools).
- **Config C:** Router + Policy Engine.
- **Config D:** Full Warden Gateway (Router + Policy + Security Scanner + Async Auditing).

### Synthetic Benchmark Dataset
- 15-20 hand-crafted tools across 5 domains (CRM, CloudOps, HR, Billing, Calendar) + 4 real demo servers.
- Includes deliberately challenging edge cases: near-duplicate names, semantically overlapping functions, vague descriptions.
- Queries generated via separate disconnected pipeline to avoid semantic leakage.
- Dedicated frozen dataset committed with fixed seeds and split into `dev` and `test`.
- Scaled benchmarks reported at 25, 50, 100, and 200 tool corpus sizes.

### Quantitative Metrics
- **Prompt Token Usage:** Average tokens loaded per prompt across corpus sizes.
- **Tool-Selection Accuracy:** Top-1 and Top-k accuracy on test query set.
- **Attack Block Rate:** Successfully intercepted malicious payloads (40+ red-team cases).
- **False-Positive Rate:** Unwarranted blocks on benign edge cases (60+ benign cases).
- **Gateway Latency Overhead:** P50, P95, and P99 latency split by router, policy, scanning, and downstream transport.
