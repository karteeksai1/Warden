# Project Brief: Warden

Warden is an enterprise-grade MCP (Model Context Protocol) gateway providing security, semantic routing, human-in-the-loop governance, and observability for AI agent architectures. It sits as a reverse proxy between AI agents and multiple downstream MCP servers.

## Problem Statement

When an AI agent connects directly to many MCP servers (10+ servers, 100+ tools):
1. **Context Bloat & Token Inefficiency:** Hundreds of tool schemas are loaded into every prompt, escalating LLM inference costs, diluting attention, and significantly degrading tool-selection accuracy.
2. **Security Vulnerabilities:** Direct access exposes agents to tool poisoning (hidden malicious instructions in descriptions), prompt injection via tool inputs or outputs, "rug pull" attacks (servers silently mutating tool definitions post-approval), and over-privileged destructive capabilities.
3. **Absence of Governance & Observability:** Lack of centralized auditing, no verification of which agent called what tool, unmonitored costs, and no capability to interpose human approvals on high-risk operations.

## Architectural Solution

Warden operates as a single upstream MCP server to AI agents and a multi-protocol MCP client (HTTP and stdio) to downstream servers.

### Core Guarantees & Principles
- **Deterministic Enforcement:** All security controls, schema validations, rate limits, and policy checks are executed in deterministic TypeScript code outside the LLM. An adversarial or hallucinating model cannot bypass these boundaries.
- **Asynchronous Governance:** High-risk actions trigger non-blocking approval requests. The agent is immediately notified with `PENDING_APPROVAL` and instructed not to poll uncontrollably, while execution is deferred until an out-of-band human decision is made.
- **Dynamic Semantic Exposure:** Instead of exposing the entire tool catalogue, the semantic router exposes only a minimal set of "core" tools plus context-relevant tools dynamically discovered via Pinecone vector search.
- **Auditing Off the Hot Path:** High-throughput trace logging is offloaded asynchronously so telemetry never degrades proxy latency.

## Target Demo Scenario: E-Commerce Customer Support

### Downstream Servers
- **orders:** `get_order`, `list_orders`, `get_tracking`
- **refunds:** `issue_refund(order_id, amount, destination_account)`, `get_refund_status`
- **kb:** `search_policy`
- **email:** `send_confirmation` (logs to stdout/file)

### End-to-End Walkthrough
1. Customer initiates request: *"Order #4821 arrived damaged, I want a refund."*
2. **Semantic Routing:** Gateway exposes KB and Order lookup tools; refund tool is discovered dynamically via query intent.
3. **Policy Execution:**
   - Read operations (`get_order`, `get_tracking`) execute immediately and are traced.
   - Refund of $50 or less: Auto-approved and executed downstream.
   - Refund over $50: Evaluated as `require_approval`. An approval record is created with an argument hash, and the agent receives an immediate `PENDING_APPROVAL` status with `approval_id`.
   - Refund over $1000 daily cumulative cap: Denied deterministically via Redis counters.
   - Cross-account refund (destination account != order owner): Denied.
4. **Security Scanner:** Prompt injections in customer text or KB outputs are flagged. If the KB server mutates its tool schema post-approval, canonical SHA-256 mismatch immediately quarantines the tool.
5. **Dashboard & Human Approval:** A manager approves the refund in the dashboard. The gateway verifies argument integrity against the stored SHA-256 hash and executes the refund idempotently downstream.

## Tech Stack & Infrastructure

- **Gateway & Servers:** TypeScript, Node.js 20+, Express, `@modelcontextprotocol/sdk`, Zod, Vitest.
- **Database & Data Layer:** Neon PostgreSQL with Drizzle ORM (`drizzle-kit` migrations).
- **Caching & Ephemeral State:** Redis 7 (Docker Compose) for token-bucket rate limits, daily quotas, and approval metadata.
- **Vector Search & Embeddings:** Pinecone index with integrated embeddings (`llama-text-embed-v2`). Postgres remains the source of truth; Pinecone acts as a rebuildable index keyed by tool ID.
- **Agent:** Python LangGraph with Claude or GPT models.
- **Dashboard:** React, Vite, Tailwind CSS, Recharts, Server-Sent Events (SSE).
- **Observability:** OpenTelemetry-style structured spans stored in Postgres asynchronously.
- **Deployment:** Docker Compose (local services: Redis, 4 HTTP downstream servers), Neon Postgres (remote), Gateway deployed to Render/Railway/Fly, Dashboard deployed to Vercel.

## Success Criteria

1. **Measurable Token & Accuracy Improvements:** Benchmark prompt token reduction and tool-selection accuracy across corpus sizes of 25, 50, 100, and 200 tools.
2. **Defensible Security Metrics:** Report attack block rates (40+ red-team cases) strictly paired with false-positive rates (60+ benign cases).
3. **Live Demonstration:** 2-3 minute demonstration showcasing benign refund execution, approval pause/resume, prompt injection interception, and automatic rug-pull quarantining.
