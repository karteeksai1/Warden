# Warden: Enterprise MCP Gateway & Security Firewall

Warden is an enterprise-grade reverse proxy, security gateway, and governance layer positioned between AI agents (MCP clients) and downstream tool servers (MCP servers).

```
[ AI Agent (LangGraph / Claude / GPT) ]
                   │
                   ▼ (Streamable HTTP / SSE)
         ┌───────────────────┐
         │   Warden Gateway  │ ◄─── Upstash Redis & Neon Postgres
         └─────────┬─────────┘
   ┌───────────────┼───────────────┬──────────────┐
   ▼               ▼               ▼              ▼
[orders]       [refunds]         [kb]          [email]
(HTTP MCP)     (HTTP MCP)     (HTTP MCP)     (HTTP MCP / stdio)
```

---

## Key Capabilities

### 1. Dynamic Semantic Tool Routing
* **Problem:** Loading dozens or hundreds of tool schemas into every prompt causes severe context bloat, escalates token costs, dilutes model attention, and degrades tool selection accuracy.
* **Vector Indexing:** Tools are embedded into Pinecone using managed `llama-text-embed-v2` embeddings based on tool name, description, and parameter keys:
  ```
  Tool: {name}
  Description: {description}
  Arguments: {param1, param2, ...}
  ```
* **Search Execution:** Incoming queries are vectorized and matched in Pinecone. The matched tool IDs are joined against PostgreSQL: any tool that is quarantined (`quarantined = true`) or lacks an approved schema hash (`approved_hash === null` or `approved_hash !== schema_hash`) is filtered out before reaching the agent.
* **Core Tools vs. Dynamic Tools:** A small subset of critical tools is pinned as "core" and always returned, while specialized tools are dynamically resolved on demand.

### 2. Authentication & Key Management
* **SHA-256 Hashing:** Raw API keys are never stored in plaintext. They are hashed using SHA-256 upon creation and stored in `agents.api_key_hash`.
* **Flexible Extraction:** Incoming requests provide keys via `x-api-key` header, `Authorization: Bearer <key>`, or `?apiKey=` query parameter.
* **Middleware Enforcement:** Unauthenticated requests to MCP endpoints (`/sse`, `/message`) are rejected immediately with HTTP 401.

### 3. Multi-Layer Security Scanner
* **Tool Description Poisoning Detection:** Analyzes registered tool descriptions before publication:
  * Regex heuristics targeting instruction overrides (`ignore previous instructions`), system overrides (`admin override`), and developer jailbreaks (`DAN mode`, `unrestricted mode`).
  * Detection of zero-width and invisible Unicode characters (`\u200B`–`\u200D`, `\uFEFF`, bidirectional override controls).
  * Detection of hidden URLs and markdown exfiltration links.
  * Optional LLM-based secondary classifier for borderline or ambiguous cases.
* **Payload & Output Injection Scanner:** Scans both tool input arguments and downstream tool response payloads:
  * Detects instruction overrides and persona hijacking attempts.
  * Identifies chat template delimiters (`<|im_start|>system`, `<<SYS>>`, `[SYSTEM]`, `[ADMIN]`, `Human: Assistant:`).
  * Flags prompt leak and secret exfiltration attempts.
* **PII & Secret Redaction:** Automatically sanitizes sensitive data from inputs and outputs before payloads reach the LLM:
  * Payment card numbers (validated with Luhn checksum algorithm).
  * Email addresses.
  * API keys and tokens (OpenAI `sk-`, Stripe keys, AWS access keys, JWTs).
* **Schema Integrity & Rug-Pull Prevention:**
  * Canonicalizes JSON Schema representations using deterministic recursive key ordering.
  * Computes a SHA-256 hash (`schema_hash`) and compares it against `approved_hash`.
  * If a downstream server silently mutates its schema after admin approval, the tool is quarantined immediately.

### 4. Human-in-the-Loop (HITL) Governance
* **Non-Blocking Approvals:** High-risk tool calls (such as refunds exceeding monetary thresholds or daily cumulative limits) return an immediate `PENDING_APPROVAL` status with an `approval_id`. The connection is not held open.
* **Tamper-Proof Argument Integrity:** The call arguments are serialized and stored alongside a SHA-256 `arguments_hash`.
* **Idempotent Human Review:** Operators review and decide pending calls via REST endpoints (`POST /approvals/:id/approve` or `POST /approvals/:id/deny`). On approval, the gateway verifies that the stored arguments match the original hash before downstream execution. Duplicate approval clicks execute idempotently.
* **Automatic Expiration:** Pending approvals expire automatically after 24 hours.

### 5. Telemetry & Observability Off the Hot Path
* **Asynchronous Spans:** Telemetry traces are dispatched asynchronously so logging never degrades proxy latency.
* **Trace Analytics:** Records per-call latency, token usage estimates, policy decisions (`allow`, `deny`, `require_approval`), and scanner verdicts.
* **Real-Time Streaming:** Server-Sent Events stream (`GET /traces/stream`) pushes live tool execution events to dashboards and monitoring tools.

---

## Repository Structure

```
├── gateway/                 # Core Warden MCP Reverse Proxy
│   ├── src/
│   │   ├── app.ts           # Express HTTP server & REST API
│   │   ├── auth.ts          # API key extraction & SHA-256 verification
│   │   ├── downstream.ts    # Downstream MCP client connections (HTTP & stdio)
│   │   ├── proxy.ts         # MCP proxy orchestration & request handling
│   │   ├── router.ts        # Pinecone vector search & tool indexing
│   │   ├── scanner/         # Security scanning (poisoning, injection, redaction, schema)
│   │   └── telemetry/       # Asynchronous trace logging & approval service
│   └── test/                # Gateway unit and end-to-end integration tests
├── packages/
│   └── shared/              # Shared database schema, Drizzle ORM client, & environment validation
├── servers/                 # Reference Downstream MCP Tool Servers
│   ├── orders/              # Orders service (get_order, list_orders, get_tracking)
│   ├── refunds/             # Refunds service (issue_refund, get_refund_status)
│   ├── kb/                  # Knowledge base service (search_policy)
│   └── email/               # Confirmation email service (stdio transport)
├── evals/                   # Red-team attack vectors & benign evaluation datasets
│   ├── attacks.json         # 40+ attack cases (poisoning, output injection, schema mutation)
│   ├── benign.json          # 60+ legitimate cases for false-positive validation
│   └── test/                # Security benchmark test runners
└── dashboard/               # Security operator UI (React, Vite, Tailwind CSS)
```

---

## Downstream Services & Tools

| Server | Transport | Tools | Description |
|---|---|---|---|
| `orders` | HTTP MCP | `orders.get_order`<br>`orders.list_orders`<br>`orders.get_tracking` | Order history, order status, and tracking data lookup. |
| `refunds` | HTTP MCP | `refunds.issue_refund`<br>`refunds.get_refund_status` | Refund processing with monetary thresholds and approval triggers. |
| `kb` | HTTP MCP | `kb.search_policy` | Internal return policy documentation lookup. |
| `email` | stdio MCP | `email.send_confirmation` | Sends transactional confirmation emails. |

---

## REST & Management Endpoints

### Health & MCP Protocol
* `GET /health` — Gateway status and version.
* `GET /sse` — MCP SSE connection endpoint (requires authentication).
* `POST /message` — MCP JSON-RPC message endpoint (requires authentication).

### Human Approvals
* `GET /approvals` — List approval requests (supports filter by `status` and `toolName`).
* `GET /approvals/:id` — Retrieve detailed approval request and argument payload.
* `POST /approvals/:id/approve` — Approve a pending tool execution (`{ "decided_by": "admin" }`).
* `POST /approvals/:id/deny` — Deny a pending tool execution (`{ "decided_by": "admin" }`).

### Telemetry & Real-Time Streams
* `GET /traces` — Query telemetry spans by `agentId`, `toolName`, `policyDecision`, or time range.
* `GET /traces/summary` — Aggregate metrics: total calls, average latency, token totals, decision breakdowns.
* `GET /traces/stream` — SSE stream of real-time tool traces.

### Downstream Server Registry
* `GET /servers` — List registered downstream MCP servers.
* `GET /servers/:id` — Get server details and health check status.
* `POST /servers/:id/health` — Trigger on-demand health check for a downstream server.

---

## Security Evaluation Suite

Warden includes benchmark datasets and test suites in `evals/`:
* **`evals/attacks.json`**: 40+ adversarial test vectors covering:
  * Tool description poisoning and invisible Unicode injections.
  * Indirect prompt injection via tool input parameters and tool return data.
  * Delimiter injection and LLM persona hijack attempts.
  * Schema rug-pulls and unauthorized parameter modifications.
* **`evals/benign.json`**: 60+ legitimate, complex business payloads to verify low false-positive rates.
* **Continuous Verification**: Executed via `npm test` against the security scanner.

---

## Getting Started

### Prerequisites
* Node.js 20+
* PostgreSQL (e.g. Neon)
* Upstash Redis (or any Redis 6+ instance)
* Pinecone account (for semantic vector routing)

### Environment Configuration
Copy `.env.example` to `.env` and fill in your connection credentials:

```bash
cp .env.example .env
```

```ini
NODE_ENV=development
PORT=3000

NEON_DATABASE_URL=postgresql://user:password@host/neondb?sslmode=require
REDIS_URL=rediss://default:password@host:6379

PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=warden-tools
```

### Installation & Database Setup

```bash
npm install
npm run db:generate
npm run db:migrate
```

### Running Locally

Run all services concurrently (Gateway, Downstream Servers, and Dashboard):

```bash
npm run dev
```

Run specific components:

```bash
npm run dev:gateway    # Warden Gateway on port 3000
npm run dev:servers    # Downstream MCP servers
npm run dev:dashboard  # Operator dashboard
```

### Running Tests & Typechecks

```bash
npm test              # Run Vitest suite across all workspaces (127+ tests)
npm run typecheck     # Validate TypeScript project references
```
