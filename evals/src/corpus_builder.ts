import {
  BenchmarkDataset,
  BenchmarkQuery,
  CorpusSubsets,
  ToolDefinition,
  ToolDomain
} from "./types.js";

// Deterministic Pseudo-Random Number Generator (Mulberry32)
export class PRNG {
  private s: number;

  constructor(seed: number) {
    this.s = Math.floor(seed) >>> 0;
  }

  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  shuffle<T>(array: T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const temp = copy[i]!;
      copy[i] = copy[j]!;
      copy[j] = temp;
    }
    return copy;
  }
}

// -------------------------------------------------------------
// 1. HAND-WRITTEN SEED TOOLS
// -------------------------------------------------------------

export const REAL_SERVER_SEED_TOOLS: ToolDefinition[] = [
  // orders
  {
    id: "tool_orders_get_order",
    name: "orders.get_order",
    serverId: "orders",
    domain: "orders",
    description: "Retrieve detailed order information including customer, status, total amount, items, and shipping status by order ID.",
    inputSchema: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "Unique order identifier" }
      },
      required: ["order_id"]
    },
    isCore: false,
    tags: ["order", "purchase", "customer", "ecommerce", "status"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_orders_list_orders",
    name: "orders.list_orders",
    serverId: "orders",
    domain: "orders",
    description: "List all historical orders placed by a specific customer ID.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: { type: "string", description: "Unique customer identifier" }
      },
      required: ["customer_id"]
    },
    isCore: false,
    tags: ["order", "history", "customer", "list", "ecommerce"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_orders_get_tracking",
    name: "orders.get_tracking",
    serverId: "orders",
    domain: "orders",
    description: "Retrieve real-time shipping carrier tracking updates, status, and estimated delivery date for an order.",
    inputSchema: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "Unique order identifier" }
      },
      required: ["order_id"]
    },
    isCore: false,
    tags: ["tracking", "shipment", "carrier", "delivery", "logistics"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  // refunds
  {
    id: "tool_refunds_issue_refund",
    name: "refunds.issue_refund",
    serverId: "refunds",
    domain: "refunds",
    description: "Issue a customer refund for a specific order and destination account.",
    inputSchema: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "Target order identifier" },
        amount: { type: "number", description: "Refund amount in USD" },
        destination_account: { type: "string", description: "Destination bank or card account" },
        reason: { type: "string", description: "Optional explanation for refund" }
      },
      required: ["order_id", "amount", "destination_account"]
    },
    isCore: false,
    tags: ["refund", "reimbursement", "money", "payment", "customer-service"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_refunds_get_refund_status",
    name: "refunds.get_refund_status",
    serverId: "refunds",
    domain: "refunds",
    description: "Retrieve the current processing and settlement status of an issued refund by refund ID.",
    inputSchema: {
      type: "object",
      properties: {
        refund_id: { type: "string", description: "Unique refund transaction ID" }
      },
      required: ["refund_id"]
    },
    isCore: false,
    tags: ["refund", "status", "settlement", "finance"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  // kb
  {
    id: "tool_kb_search_policy",
    name: "kb.search_policy",
    serverId: "kb",
    domain: "kb",
    description: "Search e-commerce store policies, return windows, refund rules, and terms of service by topic or keywords.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search terms or keywords" }
      },
      required: ["query"]
    },
    isCore: false,
    tags: ["policy", "knowledge-base", "faq", "terms", "returns"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  // email
  {
    id: "tool_email_send_confirmation",
    name: "email.send_confirmation",
    serverId: "email",
    domain: "email",
    description: "Send a transactional order status or refund confirmation email to a customer.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient customer email address" },
        subject: { type: "string", description: "Email subject line" },
        body: { type: "string", description: "Formatted email body text" },
        order_id: { type: "string", description: "Optional associated order ID" }
      },
      required: ["to", "subject", "body"]
    },
    isCore: false,
    tags: ["email", "notification", "confirmation", "receipt", "messaging"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  }
];

export const CRM_SEED_TOOLS: ToolDefinition[] = [
  {
    id: "tool_crm_create_lead",
    name: "crm.create_lead",
    serverId: "crm-service",
    domain: "crm",
    description: "Create a new sales lead with contact information, source attribution, and qualification status.",
    inputSchema: {
      type: "object",
      properties: {
        first_name: { type: "string" },
        last_name: { type: "string" },
        email: { type: "string" },
        company: { type: "string" },
        source: { type: "string" }
      },
      required: ["email", "last_name"]
    },
    isCore: false,
    tags: ["lead", "prospect", "sales", "contact"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_crm_get_lead",
    name: "crm.get_lead",
    serverId: "crm-service",
    domain: "crm",
    description: "Retrieve complete details, status, and activity timeline for a sales lead by lead ID.",
    inputSchema: {
      type: "object",
      properties: {
        lead_id: { type: "string" }
      },
      required: ["lead_id"]
    },
    isCore: false,
    tags: ["lead", "sales", "lookup", "prospect"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_crm_update_lead_status",
    name: "crm.update_lead_status",
    serverId: "crm-service",
    domain: "crm",
    description: "Update qualification status and progression stage for an existing lead.",
    inputSchema: {
      type: "object",
      properties: {
        lead_id: { type: "string" },
        status: { type: "string", enum: ["new", "contacted", "qualified", "unqualified"] }
      },
      required: ["lead_id", "status"]
    },
    isCore: false,
    tags: ["lead", "qualification", "sales", "status"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_crm_list_leads_by_owner",
    name: "crm.list_leads_by_owner",
    serverId: "crm-service",
    domain: "crm",
    description: "List all active leads assigned to a specific sales representative or account manager.",
    inputSchema: {
      type: "object",
      properties: {
        owner_id: { type: "string" },
        limit: { type: "number" }
      },
      required: ["owner_id"]
    },
    isCore: false,
    tags: ["lead", "rep", "owner", "sales-team"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_crm_convert_lead_to_deal",
    name: "crm.convert_lead_to_deal",
    serverId: "crm-service",
    domain: "crm",
    description: "Convert a qualified sales lead into an active sales opportunity deal and customer account.",
    inputSchema: {
      type: "object",
      properties: {
        lead_id: { type: "string" },
        deal_name: { type: "string" },
        deal_value: { type: "number" }
      },
      required: ["lead_id", "deal_name"]
    },
    isCore: false,
    tags: ["conversion", "deal", "pipeline", "opportunity"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_crm_create_contact",
    name: "crm.create_contact",
    serverId: "crm-service",
    domain: "crm",
    description: "Create a customer or prospect contact record with name, email, phone number, and company affiliation.",
    inputSchema: {
      type: "object",
      properties: {
        first_name: { type: "string" },
        last_name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        account_id: { type: "string" }
      },
      required: ["last_name", "email"]
    },
    isCore: false,
    tags: ["contact", "customer", "directory", "profile"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_crm_get_contact",
    name: "crm.get_contact",
    serverId: "crm-service",
    domain: "crm",
    description: "Retrieve contact information, communication history, and linked accounts for a contact ID.",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: { type: "string" }
      },
      required: ["contact_id"]
    },
    isCore: false,
    tags: ["contact", "profile", "customer", "lookup"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_crm_update_contact",
    name: "crm.update_contact",
    serverId: "crm-service",
    domain: "crm",
    description: "Update contact details, job title, email address, or phone number for an existing contact.",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        title: { type: "string" }
      },
      required: ["contact_id"]
    },
    isCore: false,
    tags: ["contact", "profile", "update", "modify"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_crm_search_contacts",
    name: "crm.search_contacts",
    serverId: "crm-service",
    domain: "crm",
    description: "Search contacts database by name, company, email domain, or phone number.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number" }
      },
      required: ["query"]
    },
    isCore: false,
    tags: ["search", "contact", "directory", "find"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_crm_create_deal",
    name: "crm.create_deal",
    serverId: "crm-service",
    domain: "crm",
    description: "Create a new sales deal opportunity associated with an account and assigned pipeline stage.",
    inputSchema: {
      type: "object",
      properties: {
        account_id: { type: "string" },
        name: { type: "string" },
        amount: { type: "number" },
        stage: { type: "string" },
        close_date: { type: "string" }
      },
      required: ["account_id", "name", "amount"]
    },
    isCore: false,
    tags: ["deal", "sales", "opportunity", "revenue"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_crm_get_deal",
    name: "crm.get_deal",
    serverId: "crm-service",
    domain: "crm",
    description: "Fetch sales deal details including value amount, expected close date, probability, and current stage.",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string" }
      },
      required: ["deal_id"]
    },
    isCore: false,
    tags: ["deal", "revenue", "opportunity", "lookup"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_crm_update_deal_stage",
    name: "crm.update_deal_stage",
    serverId: "crm-service",
    domain: "crm",
    description: "Move a sales deal to a different pipeline stage (e.g., proposal, negotiation, closed-won).",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string" },
        stage: { type: "string", enum: ["prospecting", "proposal", "negotiation", "closed-won", "closed-lost"] }
      },
      required: ["deal_id", "stage"]
    },
    isCore: false,
    tags: ["deal", "stage", "pipeline", "progress"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_crm_list_deals_pipeline",
    name: "crm.list_deals_pipeline",
    serverId: "crm-service",
    domain: "crm",
    description: "List all sales opportunities within a specific pipeline stage or revenue tier.",
    inputSchema: {
      type: "object",
      properties: {
        stage: { type: "string" },
        min_amount: { type: "number" }
      }
    },
    isCore: false,
    tags: ["pipeline", "deals", "sales", "forecast"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_crm_add_customer_note",
    name: "crm.add_customer_note",
    serverId: "crm-service",
    domain: "crm",
    description: "Append an internal note or meeting summary to a customer account or deal record.",
    inputSchema: {
      type: "object",
      properties: {
        entity_type: { type: "string", enum: ["account", "contact", "deal"] },
        entity_id: { type: "string" },
        note: { type: "string" }
      },
      required: ["entity_type", "entity_id", "note"]
    },
    isCore: false,
    tags: ["note", "memo", "customer", "log"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_crm_log_call_activity",
    name: "crm.log_call_activity",
    serverId: "crm-service",
    domain: "crm",
    description: "Log details of an outbound or inbound phone call with a contact or lead.",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: { type: "string" },
        call_outcome: { type: "string" },
        duration_minutes: { type: "number" },
        summary: { type: "string" }
      },
      required: ["contact_id", "call_outcome"]
    },
    isCore: false,
    tags: ["call", "activity", "outbound", "telecom"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_crm_get_account_history",
    name: "crm.get_account_history",
    serverId: "crm-service",
    domain: "crm",
    description: "Fetch chronological audit trail and interaction history for an enterprise customer account.",
    inputSchema: {
      type: "object",
      properties: {
        account_id: { type: "string" }
      },
      required: ["account_id"]
    },
    isCore: false,
    tags: ["account", "history", "audit", "timeline"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_crm_assign_account_rep",
    name: "crm.assign_account_rep",
    serverId: "crm-service",
    domain: "crm",
    description: "Reassign ownership of a customer account or lead to a new sales representative.",
    inputSchema: {
      type: "object",
      properties: {
        account_id: { type: "string" },
        new_rep_id: { type: "string" }
      },
      required: ["account_id", "new_rep_id"]
    },
    isCore: false,
    tags: ["assign", "owner", "territory", "sales-rep"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_crm_merge_duplicate_leads",
    name: "crm.merge_duplicate_leads",
    serverId: "crm-service",
    domain: "crm",
    description: "Merge two duplicate lead records into a single consolidated record preserving history.",
    inputSchema: {
      type: "object",
      properties: {
        primary_lead_id: { type: "string" },
        duplicate_lead_id: { type: "string" }
      },
      required: ["primary_lead_id", "duplicate_lead_id"]
    },
    isCore: false,
    tags: ["dedup", "merge", "data-cleanup", "leads"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  }
];

export const CLOUDOPS_SEED_TOOLS: ToolDefinition[] = [
  {
    id: "tool_cloudops_restart_service",
    name: "cloudops.restart_service",
    serverId: "cloudops-service",
    domain: "cloudops",
    description: "Restart a running application service instance or daemon across cluster nodes.",
    inputSchema: {
      type: "object",
      properties: {
        service_name: { type: "string" },
        cluster_zone: { type: "string" },
        force: { type: "boolean" }
      },
      required: ["service_name"]
    },
    isCore: false,
    tags: ["restart", "service", "daemon", "infrastructure", "devops"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_cloudops_get_service_health",
    name: "cloudops.get_service_health",
    serverId: "cloudops-service",
    domain: "cloudops",
    description: "Check live health status, readiness probe, and uptime metrics for a target service.",
    inputSchema: {
      type: "object",
      properties: {
        service_name: { type: "string" }
      },
      required: ["service_name"]
    },
    isCore: false,
    tags: ["health", "status", "uptime", "readiness", "monitoring"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_cloudops_scale_deployment",
    name: "cloudops.scale_deployment",
    serverId: "cloudops-service",
    domain: "cloudops",
    description: "Scale the number of replica instances up or down for a containerized deployment.",
    inputSchema: {
      type: "object",
      properties: {
        deployment_name: { type: "string" },
        replicas: { type: "number" }
      },
      required: ["deployment_name", "replicas"]
    },
    isCore: false,
    tags: ["scale", "replicas", "autoscaling", "containers", "kubernetes"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_cloudops_get_cpu_metrics",
    name: "cloudops.get_cpu_metrics",
    serverId: "cloudops-service",
    domain: "cloudops",
    description: "Retrieve current and historical CPU processor utilization percentages for an infrastructure host.",
    inputSchema: {
      type: "object",
      properties: {
        host_id: { type: "string" },
        timeframe_minutes: { type: "number" }
      },
      required: ["host_id"]
    },
    isCore: false,
    tags: ["cpu", "metrics", "processor", "utilization", "telemetry"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_cloudops_get_memory_metrics",
    name: "cloudops.get_memory_metrics",
    serverId: "cloudops-service",
    domain: "cloudops",
    description: "Retrieve RAM memory utilization, swap usage, and available memory for a server node.",
    inputSchema: {
      type: "object",
      properties: {
        node_id: { type: "string" }
      },
      required: ["node_id"]
    },
    isCore: false,
    tags: ["memory", "ram", "swap", "metrics", "resources"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_cloudops_fetch_container_logs",
    name: "cloudops.fetch_container_logs",
    serverId: "cloudops-service",
    domain: "cloudops",
    description: "Fetch recent stdout and stderr application log streams from a container pod.",
    inputSchema: {
      type: "object",
      properties: {
        pod_name: { type: "string" },
        container_name: { type: "string" },
        tail_lines: { type: "number" }
      },
      required: ["pod_name"]
    },
    isCore: false,
    tags: ["logs", "stdout", "stderr", "debugging", "containers"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_cloudops_deploy_release",
    name: "cloudops.deploy_release",
    serverId: "cloudops-service",
    domain: "cloudops",
    description: "Deploy a specified Docker image tag or release version to a target staging or production environment.",
    inputSchema: {
      type: "object",
      properties: {
        service_name: { type: "string" },
        image_tag: { type: "string" },
        environment: { type: "string", enum: ["staging", "production"] }
      },
      required: ["service_name", "image_tag", "environment"]
    },
    isCore: false,
    tags: ["deploy", "release", "ci-cd", "docker", "production"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_cloudops_rollback_deployment",
    name: "cloudops.rollback_deployment",
    serverId: "cloudops-service",
    domain: "cloudops",
    description: "Roll back a deployment to the previous stable release version following an incident.",
    inputSchema: {
      type: "object",
      properties: {
        deployment_name: { type: "string" },
        revision: { type: "number" }
      },
      required: ["deployment_name"]
    },
    isCore: false,
    tags: ["rollback", "revert", "incident", "deployment"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_cloudops_list_active_pods",
    name: "cloudops.list_active_pods",
    serverId: "cloudops-service",
    domain: "cloudops",
    description: "List active container pods, their pod IPs, running status, and host assignments in a namespace.",
    inputSchema: {
      type: "object",
      properties: {
        namespace: { type: "string" },
        label_selector: { type: "string" }
      }
    },
    isCore: false,
    tags: ["pods", "kubernetes", "containers", "cluster"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_cloudops_describe_pod",
    name: "cloudops.describe_pod",
    serverId: "cloudops-service",
    domain: "cloudops",
    description: "Retrieve detailed configuration, events, environment, and container states for a specific pod.",
    inputSchema: {
      type: "object",
      properties: {
        pod_name: { type: "string" },
        namespace: { type: "string" }
      },
      required: ["pod_name"]
    },
    isCore: false,
    tags: ["pod", "inspect", "events", "troubleshooting"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_cloudops_drain_node",
    name: "cloudops.drain_node",
    serverId: "cloudops-service",
    domain: "cloudops",
    description: "Safely drain all pods and workloads from a Kubernetes node for scheduled host maintenance.",
    inputSchema: {
      type: "object",
      properties: {
        node_name: { type: "string" },
        delete_local_data: { type: "boolean" }
      },
      required: ["node_name"]
    },
    isCore: false,
    tags: ["drain", "maintenance", "node", "evict"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_cloudops_update_env_secrets",
    name: "cloudops.update_env_secrets",
    serverId: "cloudops-service",
    domain: "cloudops",
    description: "Update encrypted environment variable secrets or configuration maps for a workload.",
    inputSchema: {
      type: "object",
      properties: {
        workload_name: { type: "string" },
        secret_key: { type: "string" },
        secret_value: { type: "string" }
      },
      required: ["workload_name", "secret_key", "secret_value"]
    },
    isCore: false,
    tags: ["secrets", "env", "configuration", "credentials"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_cloudops_get_network_latency",
    name: "cloudops.get_network_latency",
    serverId: "cloudops-service",
    domain: "cloudops",
    description: "Measure round-trip network latency and packet loss between cluster regions or services.",
    inputSchema: {
      type: "object",
      properties: {
        source_region: { type: "string" },
        target_region: { type: "string" }
      },
      required: ["source_region", "target_region"]
    },
    isCore: false,
    tags: ["network", "latency", "ping", "packet-loss"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_cloudops_rotate_tls_cert",
    name: "cloudops.rotate_tls_cert",
    serverId: "cloudops-service",
    domain: "cloudops",
    description: "Trigger rotation and renewal of SSL/TLS certificates for a domain or ingress endpoint.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string" },
        cert_issuer: { type: "string" }
      },
      required: ["domain"]
    },
    isCore: false,
    tags: ["tls", "ssl", "certificate", "security", "https"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_cloudops_check_disk_usage",
    name: "cloudops.check_disk_usage",
    serverId: "cloudops-service",
    domain: "cloudops",
    description: "Query persistent volume and root filesystem disk space utilization on a server node.",
    inputSchema: {
      type: "object",
      properties: {
        node_name: { type: "string" },
        mount_path: { type: "string" }
      },
      required: ["node_name"]
    },
    isCore: false,
    tags: ["disk", "storage", "filesystem", "volume"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_cloudops_trigger_db_snapshot",
    name: "cloudops.trigger_db_snapshot",
    serverId: "cloudops-service",
    domain: "cloudops",
    description: "Initiate an on-demand point-in-time snapshot backup of a production database cluster.",
    inputSchema: {
      type: "object",
      properties: {
        db_cluster_id: { type: "string" },
        snapshot_label: { type: "string" }
      },
      required: ["db_cluster_id"]
    },
    isCore: false,
    tags: ["database", "backup", "snapshot", "postgres"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_cloudops_restore_db_snapshot",
    name: "cloudops.restore_db_snapshot",
    serverId: "cloudops-service",
    domain: "cloudops",
    description: "Restore a database instance from an existing snapshot backup into an isolated environment.",
    inputSchema: {
      type: "object",
      properties: {
        snapshot_id: { type: "string" },
        target_instance_name: { type: "string" }
      },
      required: ["snapshot_id", "target_instance_name"]
    },
    isCore: false,
    tags: ["database", "restore", "recovery", "snapshot"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_cloudops_flush_cache_cluster",
    name: "cloudops.flush_cache_cluster",
    serverId: "cloudops-service",
    domain: "cloudops",
    description: "Flush cached keys or invalidate specific cache tags across a distributed Redis cluster.",
    inputSchema: {
      type: "object",
      properties: {
        cluster_name: { type: "string" },
        tag_pattern: { type: "string" }
      },
      required: ["cluster_name"]
    },
    isCore: false,
    tags: ["redis", "cache", "flush", "invalidation"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  }
];

export const HR_SEED_TOOLS: ToolDefinition[] = [
  {
    id: "tool_hr_get_employee_profile",
    name: "hr.get_employee_profile",
    serverId: "hr-service",
    domain: "hr",
    description: "Retrieve personal employee profile information, title, department, and employment status.",
    inputSchema: {
      type: "object",
      properties: {
        employee_id: { type: "string" }
      },
      required: ["employee_id"]
    },
    isCore: false,
    tags: ["employee", "profile", "personnel", "staff"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_hr_list_department_members",
    name: "hr.list_department_members",
    serverId: "hr-service",
    domain: "hr",
    description: "List all active team members, titles, and roles within a specific company department.",
    inputSchema: {
      type: "object",
      properties: {
        department: { type: "string" }
      },
      required: ["department"]
    },
    isCore: false,
    tags: ["department", "team", "roster", "employees"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_hr_get_reporting_chain",
    name: "hr.get_reporting_chain",
    serverId: "hr-service",
    domain: "hr",
    description: "Retrieve the organizational reporting hierarchy and manager for an employee.",
    inputSchema: {
      type: "object",
      properties: {
        employee_id: { type: "string" }
      },
      required: ["employee_id"]
    },
    isCore: false,
    tags: ["manager", "org-chart", "hierarchy", "reports"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_hr_request_pto",
    name: "hr.request_pto",
    serverId: "hr-service",
    domain: "hr",
    description: "Submit a paid time off (PTO), sick leave, or personal vacation request for employee approval.",
    inputSchema: {
      type: "object",
      properties: {
        employee_id: { type: "string" },
        start_date: { type: "string" },
        end_date: { type: "string" },
        pto_type: { type: "string", enum: ["vacation", "sick", "personal"] },
        notes: { type: "string" }
      },
      required: ["employee_id", "start_date", "end_date", "pto_type"]
    },
    isCore: false,
    tags: ["pto", "vacation", "leave", "time-off", "sick-day"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_hr_get_pto_balance",
    name: "hr.get_pto_balance",
    serverId: "hr-service",
    domain: "hr",
    description: "Check accrued paid time off, sick leave balances, and taken vacation hours for an employee.",
    inputSchema: {
      type: "object",
      properties: {
        employee_id: { type: "string" }
      },
      required: ["employee_id"]
    },
    isCore: false,
    tags: ["pto", "balance", "vacation", "hours", "leave"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_hr_approve_pto_request",
    name: "hr.approve_pto_request",
    serverId: "hr-service",
    domain: "hr",
    description: "Approve or decline a submitted time off or vacation request as an authorized manager.",
    inputSchema: {
      type: "object",
      properties: {
        request_id: { type: "string" },
        action: { type: "string", enum: ["approve", "reject"] },
        manager_comments: { type: "string" }
      },
      required: ["request_id", "action"]
    },
    isCore: false,
    tags: ["pto", "approval", "manager", "time-off"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_hr_get_payroll_summary",
    name: "hr.get_payroll_summary",
    serverId: "hr-service",
    domain: "hr",
    description: "Fetch summary of recent paystubs, gross pay, tax withholdings, and net salary payments.",
    inputSchema: {
      type: "object",
      properties: {
        employee_id: { type: "string" },
        year: { type: "number" }
      },
      required: ["employee_id"]
    },
    isCore: false,
    tags: ["payroll", "salary", "paystub", "compensation", "taxes"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_hr_update_emergency_contact",
    name: "hr.update_emergency_contact",
    serverId: "hr-service",
    domain: "hr",
    description: "Update emergency contact name, relationship, and phone number for an employee record.",
    inputSchema: {
      type: "object",
      properties: {
        employee_id: { type: "string" },
        contact_name: { type: "string" },
        relationship: { type: "string" },
        phone: { type: "string" }
      },
      required: ["employee_id", "contact_name", "phone"]
    },
    isCore: false,
    tags: ["emergency", "contact", "personnel", "family"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_hr_list_job_postings",
    name: "hr.list_job_postings",
    serverId: "hr-service",
    domain: "hr",
    description: "List open job openings, required qualifications, and department requisitions.",
    inputSchema: {
      type: "object",
      properties: {
        department: { type: "string" },
        location: { type: "string" }
      }
    },
    isCore: false,
    tags: ["recruiting", "jobs", "openings", "careers", "hiring"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_hr_submit_job_application",
    name: "hr.submit_job_application",
    serverId: "hr-service",
    domain: "hr",
    description: "Record a new job applicant candidate submission and attach resume metadata.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: { type: "string" },
        candidate_name: { type: "string" },
        candidate_email: { type: "string" },
        resume_url: { type: "string" }
      },
      required: ["job_id", "candidate_name", "candidate_email"]
    },
    isCore: false,
    tags: ["candidate", "application", "applicant", "resume"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_hr_schedule_interview",
    name: "hr.schedule_interview",
    serverId: "hr-service",
    domain: "hr",
    description: "Schedule an interview time between a job applicant candidate and hiring team interviewers.",
    inputSchema: {
      type: "object",
      properties: {
        candidate_id: { type: "string" },
        interviewer_ids: { type: "string" },
        date_time: { type: "string" }
      },
      required: ["candidate_id", "date_time"]
    },
    isCore: false,
    tags: ["interview", "screening", "recruiting", "hiring"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_hr_submit_interview_feedback",
    name: "hr.submit_interview_feedback",
    serverId: "hr-service",
    domain: "hr",
    description: "Submit candidate evaluation ratings, interview notes, and hiring recommendation score.",
    inputSchema: {
      type: "object",
      properties: {
        interview_id: { type: "string" },
        score: { type: "number" },
        notes: { type: "string" },
        decision: { type: "string", enum: ["strong-hire", "hire", "no-hire"] }
      },
      required: ["interview_id", "score", "decision"]
    },
    isCore: false,
    tags: ["evaluation", "feedback", "rating", "interview"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_hr_initiate_onboarding",
    name: "hr.initiate_onboarding",
    serverId: "hr-service",
    domain: "hr",
    description: "Trigger the standard new-hire onboarding workflow, IT equipment requisition, and document requests.",
    inputSchema: {
      type: "object",
      properties: {
        employee_id: { type: "string" },
        start_date: { type: "string" },
        laptop_type: { type: "string" }
      },
      required: ["employee_id", "start_date"]
    },
    isCore: false,
    tags: ["onboarding", "new-hire", "equipment", "provisioning"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_hr_track_onboarding_checklist",
    name: "hr.track_onboarding_checklist",
    serverId: "hr-service",
    domain: "hr",
    description: "Check completion status of required compliance training and onboarding tasks for a new hire.",
    inputSchema: {
      type: "object",
      properties: {
        employee_id: { type: "string" }
      },
      required: ["employee_id"]
    },
    isCore: false,
    tags: ["checklist", "compliance", "training", "tasks"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_hr_record_performance_review",
    name: "hr.record_performance_review",
    serverId: "hr-service",
    domain: "hr",
    description: "Submit quarterly or annual performance review scores and manager appraisal comments.",
    inputSchema: {
      type: "object",
      properties: {
        employee_id: { type: "string" },
        review_period: { type: "string" },
        rating: { type: "number" },
        comments: { type: "string" }
      },
      required: ["employee_id", "review_period", "rating"]
    },
    isCore: false,
    tags: ["performance", "review", "appraisal", "rating"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_hr_get_compensation_details",
    name: "hr.get_compensation_details",
    serverId: "hr-service",
    domain: "hr",
    description: "View employee compensation structure, salary band, bonus tier, and equity grants.",
    inputSchema: {
      type: "object",
      properties: {
        employee_id: { type: "string" }
      },
      required: ["employee_id"]
    },
    isCore: false,
    tags: ["salary", "equity", "compensation", "bonus"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_hr_initiate_offboarding",
    name: "hr.initiate_offboarding",
    serverId: "hr-service",
    domain: "hr",
    description: "Begin employee resignation or offboarding process, revoke system access, and schedule exit interview.",
    inputSchema: {
      type: "object",
      properties: {
        employee_id: { type: "string" },
        last_working_day: { type: "string" },
        reason: { type: "string" }
      },
      required: ["employee_id", "last_working_day"]
    },
    isCore: false,
    tags: ["offboarding", "resignation", "termination", "exit"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_hr_verify_employment_status",
    name: "hr.verify_employment_status",
    serverId: "hr-service",
    domain: "hr",
    description: "Generate formal employment verification letter confirming start date, title, and active status.",
    inputSchema: {
      type: "object",
      properties: {
        employee_id: { type: "string" },
        verifier_organization: { type: "string" }
      },
      required: ["employee_id"]
    },
    isCore: false,
    tags: ["verification", "employment", "proof", "letter"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  }
];

export const BILLING_SEED_TOOLS: ToolDefinition[] = [
  {
    id: "tool_billing_get_invoice",
    name: "billing.get_invoice",
    serverId: "billing-service",
    domain: "billing",
    description: "Retrieve detailed invoice data, billed line items, tax rate, and payment status by invoice ID.",
    inputSchema: {
      type: "object",
      properties: {
        invoice_id: { type: "string" }
      },
      required: ["invoice_id"]
    },
    isCore: false,
    tags: ["invoice", "bill", "payment", "taxes", "charges"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_billing_list_customer_invoices",
    name: "billing.list_customer_invoices",
    serverId: "billing-service",
    domain: "billing",
    description: "List all billing invoices and payment history for a specific customer or organization.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: { type: "string" },
        status: { type: "string", enum: ["paid", "open", "void", "uncollectible"] }
      },
      required: ["customer_id"]
    },
    isCore: false,
    tags: ["invoices", "history", "billing", "customer"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_billing_create_invoice",
    name: "billing.create_invoice",
    serverId: "billing-service",
    domain: "billing",
    description: "Generate a new itemized customer invoice for goods or contracted services.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: { type: "string" },
        amount: { type: "number" },
        due_date: { type: "string" },
        description: { type: "string" }
      },
      required: ["customer_id", "amount", "due_date"]
    },
    isCore: false,
    tags: ["invoice", "create", "charge", "billing"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_billing_void_invoice",
    name: "billing.void_invoice",
    serverId: "billing-service",
    domain: "billing",
    description: "Void an unpaid or disputed customer invoice and mark it non-collectible.",
    inputSchema: {
      type: "object",
      properties: {
        invoice_id: { type: "string" },
        reason: { type: "string" }
      },
      required: ["invoice_id", "reason"]
    },
    isCore: false,
    tags: ["void", "cancel", "dispute", "invoice"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_billing_charge_credit_card",
    name: "billing.charge_credit_card",
    serverId: "billing-service",
    domain: "billing",
    description: "Process an immediate one-off charge against a stored customer credit card or payment method.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: { type: "string" },
        amount: { type: "number" },
        currency: { type: "string" }
      },
      required: ["customer_id", "amount"]
    },
    isCore: false,
    tags: ["charge", "card", "payment", "transaction"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_billing_get_payment_method",
    name: "billing.get_payment_method",
    serverId: "billing-service",
    domain: "billing",
    description: "Retrieve details, expiration date, and brand of a customer's stored payment method.",
    inputSchema: {
      type: "object",
      properties: {
        payment_method_id: { type: "string" }
      },
      required: ["payment_method_id"]
    },
    isCore: false,
    tags: ["payment-method", "credit-card", "expiry", "wallet"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_billing_attach_payment_method",
    name: "billing.attach_payment_method",
    serverId: "billing-service",
    domain: "billing",
    description: "Attach a new credit card or ACH bank account payment method to a customer billing profile.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: { type: "string" },
        token: { type: "string" },
        is_default: { type: "boolean" }
      },
      required: ["customer_id", "token"]
    },
    isCore: false,
    tags: ["card", "payment-method", "ach", "attach"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_billing_remove_payment_method",
    name: "billing.remove_payment_method",
    serverId: "billing-service",
    domain: "billing",
    description: "Remove or deactivate an expired or unused payment method from a customer billing profile.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: { type: "string" },
        payment_method_id: { type: "string" }
      },
      required: ["customer_id", "payment_method_id"]
    },
    isCore: false,
    tags: ["delete", "remove", "payment-method", "card"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_billing_get_subscription",
    name: "billing.get_subscription",
    serverId: "billing-service",
    domain: "billing",
    description: "Retrieve status, renewal date, current tier, and recurring price of an active subscription plan.",
    inputSchema: {
      type: "object",
      properties: {
        subscription_id: { type: "string" }
      },
      required: ["subscription_id"]
    },
    isCore: false,
    tags: ["subscription", "tier", "plan", "renewal", "membership"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_billing_cancel_subscription",
    name: "billing.cancel_subscription",
    serverId: "billing-service",
    domain: "billing",
    description: "Cancel an active recurring customer subscription at period end or immediately.",
    inputSchema: {
      type: "object",
      properties: {
        subscription_id: { type: "string" },
        immediate: { type: "boolean" },
        feedback: { type: "string" }
      },
      required: ["subscription_id"]
    },
    isCore: false,
    tags: ["cancel", "subscription", "terminate", "churn"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_billing_pause_subscription",
    name: "billing.pause_subscription",
    serverId: "billing-service",
    domain: "billing",
    description: "Temporarily pause recurring subscription billing and service access for a customer.",
    inputSchema: {
      type: "object",
      properties: {
        subscription_id: { type: "string" },
        pause_duration_months: { type: "number" }
      },
      required: ["subscription_id"]
    },
    isCore: false,
    tags: ["pause", "hold", "subscription", "freeze"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_billing_apply_coupon_code",
    name: "billing.apply_coupon_code",
    serverId: "billing-service",
    domain: "billing",
    description: "Apply a promotional discount coupon or voucher code to an upcoming invoice or active subscription.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: { type: "string" },
        coupon_code: { type: "string" }
      },
      required: ["customer_id", "coupon_code"]
    },
    isCore: false,
    tags: ["discount", "coupon", "voucher", "promo"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_billing_generate_tax_report",
    name: "billing.generate_tax_report",
    serverId: "billing-service",
    domain: "billing",
    description: "Generate sales tax collected report grouped by state, province, or country for a billing period.",
    inputSchema: {
      type: "object",
      properties: {
        start_date: { type: "string" },
        end_date: { type: "string" }
      },
      required: ["start_date", "end_date"]
    },
    isCore: false,
    tags: ["tax", "vat", "compliance", "report", "accounting"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_billing_estimate_usage_charges",
    name: "billing.estimate_usage_charges",
    serverId: "billing-service",
    domain: "billing",
    description: "Calculate estimated metered usage charges and overage fees for the current billing cycle.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: { type: "string" }
      },
      required: ["customer_id"]
    },
    isCore: false,
    tags: ["metered", "usage", "estimate", "overage"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_billing_get_account_balance",
    name: "billing.get_account_balance",
    serverId: "billing-service",
    domain: "billing",
    description: "Check current outstanding balance, unpaid charges, and available credit balance on an account.",
    inputSchema: {
      type: "object",
      properties: {
        account_id: { type: "string" }
      },
      required: ["account_id"]
    },
    isCore: false,
    tags: ["balance", "credits", "due", "receivables"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_billing_send_dunning_reminder",
    name: "billing.send_dunning_reminder",
    serverId: "billing-service",
    domain: "billing",
    description: "Send an automated payment overdue notice and invoice link to a delinquent customer.",
    inputSchema: {
      type: "object",
      properties: {
        invoice_id: { type: "string" },
        notice_level: { type: "string", enum: ["first", "second", "final"] }
      },
      required: ["invoice_id"]
    },
    isCore: false,
    tags: ["dunning", "overdue", "collections", "reminder"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_billing_update_billing_address",
    name: "billing.update_billing_address",
    serverId: "billing-service",
    domain: "billing",
    description: "Update tax jurisdiction and legal billing address for a customer organization.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: { type: "string" },
        street: { type: "string" },
        city: { type: "string" },
        country: { type: "string" },
        postal_code: { type: "string" }
      },
      required: ["customer_id", "country"]
    },
    isCore: false,
    tags: ["address", "jurisdiction", "tax", "customer"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_billing_retry_failed_payment",
    name: "billing.retry_failed_payment",
    serverId: "billing-service",
    domain: "billing",
    description: "Trigger an immediate payment retry attempt for a failed or declined invoice charge.",
    inputSchema: {
      type: "object",
      properties: {
        invoice_id: { type: "string" }
      },
      required: ["invoice_id"]
    },
    isCore: false,
    tags: ["retry", "failed-payment", "declined", "charge"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  }
];

export const CALENDAR_SEED_TOOLS: ToolDefinition[] = [
  {
    id: "tool_calendar_create_event",
    name: "calendar.create_event",
    serverId: "calendar-service",
    domain: "calendar",
    description: "Create a new calendar meeting or event with title, start time, end time, and description.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        start_time: { type: "string" },
        end_time: { type: "string" },
        description: { type: "string" }
      },
      required: ["title", "start_time", "end_time"]
    },
    isCore: false,
    tags: ["meeting", "event", "schedule", "calendar"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_calendar_get_event",
    name: "calendar.get_event",
    serverId: "calendar-service",
    domain: "calendar",
    description: "Retrieve event details, attendee response status, location, and meeting link by event ID.",
    inputSchema: {
      type: "object",
      properties: {
        event_id: { type: "string" }
      },
      required: ["event_id"]
    },
    isCore: false,
    tags: ["event", "lookup", "meeting", "details"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_calendar_update_event_time",
    name: "calendar.update_event_time",
    serverId: "calendar-service",
    domain: "calendar",
    description: "Update the start time, end time, or duration of an existing scheduled calendar event.",
    inputSchema: {
      type: "object",
      properties: {
        event_id: { type: "string" },
        new_start_time: { type: "string" },
        new_end_time: { type: "string" }
      },
      required: ["event_id", "new_start_time", "new_end_time"]
    },
    isCore: false,
    tags: ["update", "time", "reschedule", "shift"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_calendar_delete_event",
    name: "calendar.delete_event",
    serverId: "calendar-service",
    domain: "calendar",
    description: "Delete or cancel a scheduled calendar event and send cancellation notices to attendees.",
    inputSchema: {
      type: "object",
      properties: {
        event_id: { type: "string" },
        cancellation_message: { type: "string" }
      },
      required: ["event_id"]
    },
    isCore: false,
    tags: ["delete", "cancel", "event", "meeting"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_calendar_list_upcoming_events",
    name: "calendar.list_upcoming_events",
    serverId: "calendar-service",
    domain: "calendar",
    description: "List upcoming meetings and calendar events for a user within a specified date window.",
    inputSchema: {
      type: "object",
      properties: {
        user_email: { type: "string" },
        days_ahead: { type: "number" }
      },
      required: ["user_email"]
    },
    isCore: false,
    tags: ["upcoming", "schedule", "events", "list"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_calendar_find_free_meeting_slots",
    name: "calendar.find_free_meeting_slots",
    serverId: "calendar-service",
    domain: "calendar",
    description: "Find mutually available open time slots across multiple team members' calendars.",
    inputSchema: {
      type: "object",
      properties: {
        attendee_emails: { type: "string" },
        duration_minutes: { type: "number" },
        date: { type: "string" }
      },
      required: ["attendee_emails", "duration_minutes", "date"]
    },
    isCore: false,
    tags: ["availability", "free-slots", "scheduling", "meeting"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_calendar_invite_attendees",
    name: "calendar.invite_attendees",
    serverId: "calendar-service",
    domain: "calendar",
    description: "Add one or more attendee email addresses to an existing calendar event.",
    inputSchema: {
      type: "object",
      properties: {
        event_id: { type: "string" },
        new_attendees: { type: "string" }
      },
      required: ["event_id", "new_attendees"]
    },
    isCore: false,
    tags: ["invite", "attendees", "guests", "participants"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_calendar_remove_attendee",
    name: "calendar.remove_attendee",
    serverId: "calendar-service",
    domain: "calendar",
    description: "Remove an attendee from a scheduled meeting and update the attendee list.",
    inputSchema: {
      type: "object",
      properties: {
        event_id: { type: "string" },
        attendee_email: { type: "string" }
      },
      required: ["event_id", "attendee_email"]
    },
    isCore: false,
    tags: ["remove", "attendee", "uninvite", "guest"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_calendar_rsvp_event",
    name: "calendar.rsvp_event",
    serverId: "calendar-service",
    domain: "calendar",
    description: "Submit accepted, tentative, or declined RSVP response to a meeting invitation.",
    inputSchema: {
      type: "object",
      properties: {
        event_id: { type: "string" },
        status: { type: "string", enum: ["accepted", "tentative", "declined"] }
      },
      required: ["event_id", "status"]
    },
    isCore: false,
    tags: ["rsvp", "accept", "decline", "attendance"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_calendar_book_conference_room",
    name: "calendar.book_conference_room",
    serverId: "calendar-service",
    domain: "calendar",
    description: "Reserve a physical conference room or meeting space for a specified time block.",
    inputSchema: {
      type: "object",
      properties: {
        room_id: { type: "string" },
        start_time: { type: "string" },
        end_time: { type: "string" }
      },
      required: ["room_id", "start_time", "end_time"]
    },
    isCore: false,
    tags: ["room", "conference", "space", "reservation"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_calendar_release_conference_room",
    name: "calendar.release_conference_room",
    serverId: "calendar-service",
    domain: "calendar",
    description: "Release and cancel a conference room reservation back into the available pool.",
    inputSchema: {
      type: "object",
      properties: {
        reservation_id: { type: "string" }
      },
      required: ["reservation_id"]
    },
    isCore: false,
    tags: ["release", "cancel-room", "space", "unreserve"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_calendar_get_working_hours",
    name: "calendar.get_working_hours",
    serverId: "calendar-service",
    domain: "calendar",
    description: "Retrieve standard working hours, time zone, and lunch break preferences for a colleague.",
    inputSchema: {
      type: "object",
      properties: {
        user_email: { type: "string" }
      },
      required: ["user_email"]
    },
    isCore: false,
    tags: ["hours", "timezone", "availability", "schedule"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_calendar_set_out_of_office",
    name: "calendar.set_out_of_office",
    serverId: "calendar-service",
    domain: "calendar",
    description: "Block out-of-office time on calendar and set automatic meeting decline settings.",
    inputSchema: {
      type: "object",
      properties: {
        start_date: { type: "string" },
        end_date: { type: "string" },
        auto_decline: { type: "boolean" }
      },
      required: ["start_date", "end_date"]
    },
    isCore: false,
    tags: ["ooo", "out-of-office", "vacation", "block"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_calendar_reschedule_event",
    name: "calendar.reschedule_event",
    serverId: "calendar-service",
    domain: "calendar",
    description: "Reschedule a meeting to a new time and notify all participating attendees.",
    inputSchema: {
      type: "object",
      properties: {
        event_id: { type: "string" },
        new_start_time: { type: "string" },
        reason: { type: "string" }
      },
      required: ["event_id", "new_start_time"]
    },
    isCore: false,
    tags: ["reschedule", "postpone", "move", "meeting"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_calendar_attach_meeting_link",
    name: "calendar.attach_meeting_link",
    serverId: "calendar-service",
    domain: "calendar",
    description: "Add or update a video conference link (Google Meet, Zoom) on a calendar invitation.",
    inputSchema: {
      type: "object",
      properties: {
        event_id: { type: "string" },
        video_url: { type: "string" }
      },
      required: ["event_id", "video_url"]
    },
    isCore: false,
    tags: ["zoom", "meet", "videoconference", "link"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_calendar_get_daily_agenda",
    name: "calendar.get_daily_agenda",
    serverId: "calendar-service",
    domain: "calendar",
    description: "Fetch chronological daily agenda, meeting schedule, and prep notes for today.",
    inputSchema: {
      type: "object",
      properties: {
        user_email: { type: "string" },
        target_date: { type: "string" }
      },
      required: ["user_email"]
    },
    isCore: false,
    tags: ["agenda", "daily", "itinerary", "meetings"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_calendar_detect_schedule_conflicts",
    name: "calendar.detect_schedule_conflicts",
    serverId: "calendar-service",
    domain: "calendar",
    description: "Scan user's schedule to detect overlapping meetings and double-booked calendar blocks.",
    inputSchema: {
      type: "object",
      properties: {
        user_email: { type: "string" },
        date: { type: "string" }
      },
      required: ["user_email"]
    },
    isCore: false,
    tags: ["conflict", "overlap", "double-booked", "schedule"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  },
  {
    id: "tool_calendar_create_recurring_series",
    name: "calendar.create_recurring_series",
    serverId: "calendar-service",
    domain: "calendar",
    description: "Create a recurring weekly, bi-weekly, or monthly meeting series with recurrence rule.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        recurrence_rule: { type: "string", enum: ["daily", "weekly", "biweekly", "monthly"] },
        time: { type: "string" }
      },
      required: ["title", "recurrence_rule", "time"]
    },
    isCore: false,
    tags: ["recurring", "cadence", "series", "repeating"],
    isSeed: true,
    isSynthetic: false,
    isNearDuplicate: false,
    isVague: false
  }
];

export const ALL_SEED_TOOLS: ToolDefinition[] = [
  ...REAL_SERVER_SEED_TOOLS,
  ...CRM_SEED_TOOLS,
  ...CLOUDOPS_SEED_TOOLS,
  ...HR_SEED_TOOLS,
  ...BILLING_SEED_TOOLS,
  ...CALENDAR_SEED_TOOLS
];

// -------------------------------------------------------------
// 2. DELIBERATE NEAR-DUPLICATES (Hard cases with semantic overlap)
// -------------------------------------------------------------

export const NEAR_DUPLICATE_TOOLS: ToolDefinition[] = [
  // CRM near-duplicates
  {
    id: "tool_crm_modify_contact_info",
    name: "crm.modify_contact_info",
    serverId: "crm-service",
    domain: "crm",
    description: "Update biographical, phone, or address info for an existing contact record in CRM.",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: { type: "string" },
        new_details: { type: "string" }
      },
      required: ["contact_id"]
    },
    isCore: false,
    tags: ["contact", "update", "modify"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "crm.update_contact"
  },
  {
    id: "tool_crm_open_new_sales_opportunity",
    name: "crm.open_new_sales_opportunity",
    serverId: "crm-service",
    domain: "crm",
    description: "Initiate a new sales deal or pipeline opportunity for an enterprise customer.",
    inputSchema: {
      type: "object",
      properties: {
        account_name: { type: "string" },
        estimated_value: { type: "number" }
      },
      required: ["account_name"]
    },
    isCore: false,
    tags: ["opportunity", "deal", "pipeline"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "crm.create_deal"
  },
  {
    id: "tool_crm_fetch_pipeline_opportunities",
    name: "crm.fetch_pipeline_opportunities",
    serverId: "crm-service",
    domain: "crm",
    description: "List sales pipeline stages and revenue amounts for active deals in the pipeline.",
    inputSchema: {
      type: "object",
      properties: {
        pipeline_stage: { type: "string" }
      }
    },
    isCore: false,
    tags: ["pipeline", "deals", "revenue"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "crm.list_deals_pipeline"
  },
  {
    id: "tool_crm_modify_lead_stage",
    name: "crm.modify_lead_stage",
    serverId: "crm-service",
    domain: "crm",
    description: "Change qualification stage or status for an existing prospective sales lead.",
    inputSchema: {
      type: "object",
      properties: {
        lead_id: { type: "string" },
        new_stage: { type: "string" }
      },
      required: ["lead_id", "new_stage"]
    },
    isCore: false,
    tags: ["lead", "status", "stage"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "crm.update_lead_status"
  },
  {
    id: "tool_crm_lookup_lead_info",
    name: "crm.lookup_lead_info",
    serverId: "crm-service",
    domain: "crm",
    description: "Fetch contact information and status details for a sales prospect by identifier.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" }
      },
      required: ["id"]
    },
    isCore: false,
    tags: ["lead", "prospect", "lookup"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "crm.get_lead"
  },

  // CloudOps near-duplicates
  {
    id: "tool_cloudops_reboot_server_instance",
    name: "cloudops.reboot_server_instance",
    serverId: "cloudops-service",
    domain: "cloudops",
    description: "Restart or reboot the virtual host or service daemon running the application.",
    inputSchema: {
      type: "object",
      properties: {
        instance_id: { type: "string" }
      },
      required: ["instance_id"]
    },
    isCore: false,
    tags: ["reboot", "restart", "server"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "cloudops.restart_service"
  },
  {
    id: "tool_cloudops_query_processor_utilization",
    name: "cloudops.query_processor_utilization",
    serverId: "cloudops-service",
    domain: "cloudops",
    description: "Fetch current and historical CPU processor usage stats and load average for host.",
    inputSchema: {
      type: "object",
      properties: {
        server_id: { type: "string" }
      },
      required: ["server_id"]
    },
    isCore: false,
    tags: ["cpu", "processor", "utilization"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "cloudops.get_cpu_metrics"
  },
  {
    id: "tool_cloudops_stream_application_logs",
    name: "cloudops.stream_application_logs",
    serverId: "cloudops-service",
    domain: "cloudops",
    description: "Retrieve container log outputs, stdout, and stderr for debugging service errors.",
    inputSchema: {
      type: "object",
      properties: {
        container_id: { type: "string" }
      },
      required: ["container_id"]
    },
    isCore: false,
    tags: ["logs", "container", "stdout"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "cloudops.fetch_container_logs"
  },
  {
    id: "tool_cloudops_revert_software_version",
    name: "cloudops.revert_software_version",
    serverId: "cloudops-service",
    domain: "cloudops",
    description: "Roll back the workload deployment to the preceding stable build version.",
    inputSchema: {
      type: "object",
      properties: {
        app_name: { type: "string" }
      },
      required: ["app_name"]
    },
    isCore: false,
    tags: ["rollback", "revert", "deployment"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "cloudops.rollback_deployment"
  },
  {
    id: "tool_cloudops_inspect_container_pod",
    name: "cloudops.inspect_container_pod",
    serverId: "cloudops-service",
    domain: "cloudops",
    description: "Inspect pod details, specifications, events, and container statuses in Kubernetes cluster.",
    inputSchema: {
      type: "object",
      properties: {
        pod_id: { type: "string" }
      },
      required: ["pod_id"]
    },
    isCore: false,
    tags: ["pod", "inspect", "status"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "cloudops.describe_pod"
  },

  // HR near-duplicates
  {
    id: "tool_hr_submit_time_off_request",
    name: "hr.submit_time_off_request",
    serverId: "hr-service",
    domain: "hr",
    description: "File a paid time off or vacation leave application for employee calendar days.",
    inputSchema: {
      type: "object",
      properties: {
        emp_id: { type: "string" },
        leave_dates: { type: "string" }
      },
      required: ["emp_id", "leave_dates"]
    },
    isCore: false,
    tags: ["pto", "time-off", "leave"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "hr.request_pto"
  },
  {
    id: "tool_hr_fetch_worker_record",
    name: "hr.fetch_worker_record",
    serverId: "hr-service",
    domain: "hr",
    description: "Retrieve personal and employment details for an employee by staff identification.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" }
      },
      required: ["id"]
    },
    isCore: false,
    tags: ["worker", "employee", "record"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "hr.get_employee_profile"
  },
  {
    id: "tool_hr_book_candidate_screening",
    name: "hr.book_candidate_screening",
    serverId: "hr-service",
    domain: "hr",
    description: "Schedule an interview session between candidate and hiring team panel.",
    inputSchema: {
      type: "object",
      properties: {
        applicant_id: { type: "string" },
        slot: { type: "string" }
      },
      required: ["applicant_id", "slot"]
    },
    isCore: false,
    tags: ["interview", "screening", "candidate"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "hr.schedule_interview"
  },
  {
    id: "tool_hr_query_vacation_allowance",
    name: "hr.query_vacation_allowance",
    serverId: "hr-service",
    domain: "hr",
    description: "Look up remaining holiday hours and annual leave quota balance for a team member.",
    inputSchema: {
      type: "object",
      properties: {
        worker_id: { type: "string" }
      },
      required: ["worker_id"]
    },
    isCore: false,
    tags: ["vacation", "pto", "allowance"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "hr.get_pto_balance"
  },
  {
    id: "tool_hr_view_paystub_breakdown",
    name: "hr.view_paystub_breakdown",
    serverId: "hr-service",
    domain: "hr",
    description: "Retrieve employee payroll figures, deductions, and wage payment history.",
    inputSchema: {
      type: "object",
      properties: {
        staff_id: { type: "string" }
      },
      required: ["staff_id"]
    },
    isCore: false,
    tags: ["paystub", "payroll", "salary"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "hr.get_payroll_summary"
  },

  // Billing near-duplicates
  {
    id: "tool_billing_terminate_recurring_plan",
    name: "billing.terminate_recurring_plan",
    serverId: "billing-service",
    domain: "billing",
    description: "Cancel or terminate an active recurring membership or subscription agreement.",
    inputSchema: {
      type: "object",
      properties: {
        plan_id: { type: "string" }
      },
      required: ["plan_id"]
    },
    isCore: false,
    tags: ["cancel", "subscription", "terminate"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "billing.cancel_subscription"
  },
  {
    id: "tool_billing_generate_bill",
    name: "billing.generate_bill",
    serverId: "billing-service",
    domain: "billing",
    description: "Create and issue an itemized billing invoice for services rendered to client.",
    inputSchema: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        total_due: { type: "number" }
      },
      required: ["client_id", "total_due"]
    },
    isCore: false,
    tags: ["invoice", "bill", "create"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "billing.create_invoice"
  },
  {
    id: "tool_billing_retrieve_bill_by_number",
    name: "billing.retrieve_bill_by_number",
    serverId: "billing-service",
    domain: "billing",
    description: "Retrieve invoice details and payment breakdown by invoice identifier reference.",
    inputSchema: {
      type: "object",
      properties: {
        bill_reference: { type: "string" }
      },
      required: ["bill_reference"]
    },
    isCore: false,
    tags: ["invoice", "lookup", "bill"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "billing.get_invoice"
  },
  {
    id: "tool_billing_fetch_outstanding_dues",
    name: "billing.fetch_outstanding_dues",
    serverId: "billing-service",
    domain: "billing",
    description: "Query current unpaid balances and pending receivables for commercial customer account.",
    inputSchema: {
      type: "object",
      properties: {
        client_code: { type: "string" }
      },
      required: ["client_code"]
    },
    isCore: false,
    tags: ["balance", "dues", "unpaid"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "billing.get_account_balance"
  },
  {
    id: "tool_billing_register_payment_card",
    name: "billing.register_payment_card",
    serverId: "billing-service",
    domain: "billing",
    description: "Register and bind a new credit or debit card for automatic billing charges.",
    inputSchema: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        card_token: { type: "string" }
      },
      required: ["client_id", "card_token"]
    },
    isCore: false,
    tags: ["card", "payment-method", "attach"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "billing.attach_payment_method"
  },

  // Calendar near-duplicates
  {
    id: "tool_calendar_schedule_calendar_entry",
    name: "calendar.schedule_calendar_entry",
    serverId: "calendar-service",
    domain: "calendar",
    description: "Create a new calendar entry or appointment on calendar with start and finish times.",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string" },
        starts: { type: "string" },
        ends: { type: "string" }
      },
      required: ["subject", "starts", "ends"]
    },
    isCore: false,
    tags: ["calendar", "event", "create"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "calendar.create_event"
  },
  {
    id: "tool_calendar_move_meeting_timeslot",
    name: "calendar.move_meeting_timeslot",
    serverId: "calendar-service",
    domain: "calendar",
    description: "Change time and date of an existing meeting appointment to a different slot.",
    inputSchema: {
      type: "object",
      properties: {
        meeting_id: { type: "string" },
        rescheduled_time: { type: "string" }
      },
      required: ["meeting_id", "rescheduled_time"]
    },
    isCore: false,
    tags: ["reschedule", "move", "calendar"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "calendar.reschedule_event"
  },
  {
    id: "tool_calendar_query_calendar_availability",
    name: "calendar.query_calendar_availability",
    serverId: "calendar-service",
    domain: "calendar",
    description: "Check mutual availability and find open calendar slots across colleagues for a meeting.",
    inputSchema: {
      type: "object",
      properties: {
        users: { type: "string" },
        window_date: { type: "string" }
      },
      required: ["users", "window_date"]
    },
    isCore: false,
    tags: ["free-slots", "availability", "calendar"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "calendar.find_free_meeting_slots"
  },
  {
    id: "tool_calendar_cancel_scheduled_meeting",
    name: "calendar.cancel_scheduled_meeting",
    serverId: "calendar-service",
    domain: "calendar",
    description: "Remove and cancel a scheduled calendar appointment and dispatch alert to invitees.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" }
      },
      required: ["id"]
    },
    isCore: false,
    tags: ["delete", "cancel", "event"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "calendar.delete_event"
  },
  {
    id: "tool_calendar_view_daily_itinerary",
    name: "calendar.view_daily_itinerary",
    serverId: "calendar-service",
    domain: "calendar",
    description: "View scheduled meetings and calendar events for today with room and link details.",
    inputSchema: {
      type: "object",
      properties: {
        user: { type: "string" }
      },
      required: ["user"]
    },
    isCore: false,
    tags: ["agenda", "itinerary", "daily"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "calendar.get_daily_agenda"
  },

  // Real servers near-duplicates
  {
    id: "tool_orders_lookup_purchase_details",
    name: "orders.lookup_purchase_details",
    serverId: "orders",
    domain: "orders",
    description: "Look up completed purchase and line item info by order identifier in store database.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" }
      },
      required: ["id"]
    },
    isCore: false,
    tags: ["order", "purchase", "lookup"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "orders.get_order"
  },
  {
    id: "tool_orders_track_shipment_progress",
    name: "orders.track_shipment_progress",
    serverId: "orders",
    domain: "orders",
    description: "Track package delivery status and logistics carrier updates for customer shipment.",
    inputSchema: {
      type: "object",
      properties: {
        tracking_num: { type: "string" }
      },
      required: ["tracking_num"]
    },
    isCore: false,
    tags: ["tracking", "shipment", "carrier"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "orders.get_tracking"
  },
  {
    id: "tool_refunds_process_customer_reimbursement",
    name: "refunds.process_customer_reimbursement",
    serverId: "refunds",
    domain: "refunds",
    description: "Issue a money refund or reimbursement back to customer payment method for return.",
    inputSchema: {
      type: "object",
      properties: {
        order_num: { type: "string" },
        payout_val: { type: "number" }
      },
      required: ["order_num", "payout_val"]
    },
    isCore: false,
    tags: ["refund", "reimbursement", "payout"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "refunds.issue_refund"
  },
  {
    id: "tool_email_dispatch_transactional_receipt",
    name: "email.dispatch_transactional_receipt",
    serverId: "email",
    domain: "email",
    description: "Dispatch email receipt or confirmation message to recipient address regarding orders.",
    inputSchema: {
      type: "object",
      properties: {
        recipient: { type: "string" },
        text_content: { type: "string" }
      },
      required: ["recipient", "text_content"]
    },
    isCore: false,
    tags: ["email", "receipt", "send"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "email.send_confirmation"
  },
  {
    id: "tool_kb_lookup_support_article",
    name: "kb.lookup_support_article",
    serverId: "kb",
    domain: "kb",
    description: "Search help center documentation, policies, and customer guidelines by keyword.",
    inputSchema: {
      type: "object",
      properties: {
        keywords: { type: "string" }
      },
      required: ["keywords"]
    },
    isCore: false,
    tags: ["kb", "policy", "faq"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: true,
    isVague: false,
    nearDuplicateOf: "kb.search_policy"
  }
];

// -------------------------------------------------------------
// 3. VAGUELY WORDED TOOLS (Hard cases with ambiguous descriptions)
// -------------------------------------------------------------

export const VAGUE_TOOLS: ToolDefinition[] = [
  {
    id: "tool_crm_sync_data",
    name: "crm.sync_data",
    serverId: "crm-service",
    domain: "crm",
    description: "Perform standard synchronization across internal data stores and entities.",
    inputSchema: {
      type: "object",
      properties: { target: { type: "string" } }
    },
    isCore: false,
    tags: ["sync", "data", "records"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: false,
    isVague: true
  },
  {
    id: "tool_crm_handle_record",
    name: "crm.handle_record",
    serverId: "crm-service",
    domain: "crm",
    description: "Handle and process arbitrary CRM entries or updates.",
    inputSchema: {
      type: "object",
      properties: { payload: { type: "string" } }
    },
    isCore: false,
    tags: ["crm", "record", "process"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: false,
    isVague: true
  },
  {
    id: "tool_crm_dispatch_routine",
    name: "crm.dispatch_routine",
    serverId: "crm-service",
    domain: "crm",
    description: "Execute standard pipeline operations and routine updates.",
    inputSchema: {
      type: "object",
      properties: { routine_id: { type: "string" } }
    },
    isCore: false,
    tags: ["routine", "pipeline"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: false,
    isVague: true
  },
  {
    id: "tool_cloudops_system_task",
    name: "cloudops.system_task",
    serverId: "cloudops-service",
    domain: "cloudops",
    description: "Execute maintenance or diagnostic operation on target environment.",
    inputSchema: {
      type: "object",
      properties: { task: { type: "string" } }
    },
    isCore: false,
    tags: ["system", "task", "ops"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: false,
    isVague: true
  },
  {
    id: "tool_cloudops_check_status",
    name: "cloudops.check_status",
    serverId: "cloudops-service",
    domain: "cloudops",
    description: "Check the system state, condition, or resource health.",
    inputSchema: {
      type: "object",
      properties: { target_id: { type: "string" } }
    },
    isCore: false,
    tags: ["status", "check", "system"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: false,
    isVague: true
  },
  {
    id: "tool_cloudops_run_action",
    name: "cloudops.run_action",
    serverId: "cloudops-service",
    domain: "cloudops",
    description: "Dispatch background execution command to node.",
    inputSchema: {
      type: "object",
      properties: { action_name: { type: "string" } }
    },
    isCore: false,
    tags: ["action", "dispatch", "node"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: false,
    isVague: true
  },
  {
    id: "tool_cloudops_manage_resource",
    name: "cloudops.manage_resource",
    serverId: "cloudops-service",
    domain: "cloudops",
    description: "Inspect or manipulate cloud infrastructure resources.",
    inputSchema: {
      type: "object",
      properties: { resource_uri: { type: "string" } }
    },
    isCore: false,
    tags: ["cloud", "resource", "manage"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: false,
    isVague: true
  },
  {
    id: "tool_hr_record_action",
    name: "hr.record_action",
    serverId: "hr-service",
    domain: "hr",
    description: "Process employee status or record changes in system.",
    inputSchema: {
      type: "object",
      properties: { employee: { type: "string" }, action: { type: "string" } }
    },
    isCore: false,
    tags: ["hr", "record", "action"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: false,
    isVague: true
  },
  {
    id: "tool_hr_manage_entry",
    name: "hr.manage_entry",
    serverId: "hr-service",
    domain: "hr",
    description: "Manage personnel documents and entries in company directory.",
    inputSchema: {
      type: "object",
      properties: { entry_key: { type: "string" } }
    },
    isCore: false,
    tags: ["personnel", "directory", "entry"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: false,
    isVague: true
  },
  {
    id: "tool_hr_submit_request",
    name: "hr.submit_request",
    serverId: "hr-service",
    domain: "hr",
    description: "Submit general workplace or personnel request for processing.",
    inputSchema: {
      type: "object",
      properties: { category: { type: "string" }, text: { type: "string" } }
    },
    isCore: false,
    tags: ["request", "workplace", "submission"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: false,
    isVague: true
  },
  {
    id: "tool_billing_process_item",
    name: "billing.process_item",
    serverId: "billing-service",
    domain: "billing",
    description: "Handle the transaction or record for the given entity.",
    inputSchema: {
      type: "object",
      properties: { item_id: { type: "string" } }
    },
    isCore: false,
    tags: ["transaction", "item", "record"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: false,
    isVague: true
  },
  {
    id: "tool_billing_balance_adjustment",
    name: "billing.balance_adjustment",
    serverId: "billing-service",
    domain: "billing",
    description: "Perform internal calculation and ledger adjustment on account.",
    inputSchema: {
      type: "object",
      properties: { acct: { type: "string" }, val: { type: "number" } }
    },
    isCore: false,
    tags: ["ledger", "adjustment", "balance"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: false,
    isVague: true
  },
  {
    id: "tool_billing_manage_account",
    name: "billing.manage_account",
    serverId: "billing-service",
    domain: "billing",
    description: "Inspect or modify customer billing and commercial account state.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } }
    },
    isCore: false,
    tags: ["account", "state", "commercial"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: false,
    isVague: true
  },
  {
    id: "tool_calendar_sync_slot",
    name: "calendar.sync_slot",
    serverId: "calendar-service",
    domain: "calendar",
    description: "Coordinate and verify time blocks with external system.",
    inputSchema: {
      type: "object",
      properties: { slot_id: { type: "string" } }
    },
    isCore: false,
    tags: ["time", "slot", "sync"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: false,
    isVague: true
  },
  {
    id: "tool_calendar_manage_schedule",
    name: "calendar.manage_schedule",
    serverId: "calendar-service",
    domain: "calendar",
    description: "Handle calendar operations and scheduling routines.",
    inputSchema: {
      type: "object",
      properties: { calendar_id: { type: "string" } }
    },
    isCore: false,
    tags: ["calendar", "schedule", "routine"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: false,
    isVague: true
  },
  {
    id: "tool_orders_process_entry",
    name: "orders.process_entry",
    serverId: "orders",
    domain: "orders",
    description: "Process order-related transaction records and state transitions.",
    inputSchema: {
      type: "object",
      properties: { ref: { type: "string" } }
    },
    isCore: false,
    tags: ["orders", "entry", "process"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: false,
    isVague: true
  },
  {
    id: "tool_refunds_reconcile_item",
    name: "refunds.reconcile_item",
    serverId: "refunds",
    domain: "refunds",
    description: "Reconcile disputed items and pending settlement rows in ledger.",
    inputSchema: {
      type: "object",
      properties: { row_id: { type: "string" } }
    },
    isCore: false,
    tags: ["settlement", "reconcile", "ledger"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: false,
    isVague: true
  },
  {
    id: "tool_email_route_message",
    name: "email.route_message",
    serverId: "email",
    domain: "email",
    description: "Process and dispatch outbound communications to external endpoints.",
    inputSchema: {
      type: "object",
      properties: { target: { type: "string" }, payload: { type: "string" } }
    },
    isCore: false,
    tags: ["message", "outbound", "dispatch"],
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: false,
    isVague: true
  }
];

// -------------------------------------------------------------
// 4. ADDITIONAL SPECIALIZED SYNTHETIC TOOLS
// -------------------------------------------------------------

export function generateSpecializedSyntheticTools(): ToolDefinition[] {
  const specs: Array<{
    name: string;
    domain: ToolDomain;
    server: string;
    description: string;
    props: Record<string, string>;
    tags: string[];
  }> = [
    // CRM
    { name: "crm.export_leads_csv", domain: "crm", server: "crm-service", description: "Export qualified sales leads and company emails to a downloadable CSV file.", props: { filter: "string" }, tags: ["export", "csv", "leads"] },
    { name: "crm.tag_contact", domain: "crm", server: "crm-service", description: "Attach descriptive industry or behavioral tags to a customer contact profile.", props: { contact_id: "string", tag: "string" }, tags: ["tag", "contact", "metadata"] },
    { name: "crm.archive_deal", domain: "crm", server: "crm-service", description: "Move an abandoned or expired sales deal opportunity to archive storage.", props: { deal_id: "string" }, tags: ["archive", "deal", "clean"] },
    { name: "crm.set_lead_score", domain: "crm", server: "crm-service", description: "Set numerical lead qualification score based on company size and engagement.", props: { lead_id: "string", score: "number" }, tags: ["score", "lead", "qualification"] },
    { name: "crm.bulk_import_contacts", domain: "crm", server: "crm-service", description: "Bulk import contact records from an uploaded JSON or CSV file.", props: { file_url: "string" }, tags: ["import", "bulk", "contacts"] },
    { name: "crm.track_email_open", domain: "crm", server: "crm-service", description: "Check tracking pixel status to see if prospect opened outbound sales email.", props: { email_id: "string" }, tags: ["email", "tracking", "open"] },
    { name: "crm.get_quota_forecast", domain: "crm", server: "crm-service", description: "Calculate expected sales quota attainment for current quarter by sales rep.", props: { rep_id: "string" }, tags: ["quota", "forecast", "revenue"] },
    { name: "crm.list_territories", domain: "crm", server: "crm-service", description: "List geographic sales territories, postal code mappings, and lead rules.", props: { region: "string" }, tags: ["territory", "geography", "sales"] },
    { name: "crm.transfer_deal_ownership", domain: "crm", server: "crm-service", description: "Transfer a sales opportunity to a different regional account executive.", props: { deal_id: "string", new_owner: "string" }, tags: ["transfer", "owner", "deal"] },
    { name: "crm.flag_inactive_account", domain: "crm", server: "crm-service", description: "Flag an account as dormant or churn risk after 90 days without contact.", props: { account_id: "string" }, tags: ["dormant", "flag", "churn"] },
    { name: "crm.calculate_customer_ltv", domain: "crm", server: "crm-service", description: "Calculate historical and projected lifetime value (LTV) for an account.", props: { account_id: "string" }, tags: ["ltv", "metrics", "analytics"] },
    { name: "crm.assign_lead_routing_rule", domain: "crm", server: "crm-service", description: "Configure round-robin or territory rules for automatic lead dispatch.", props: { rule_name: "string" }, tags: ["routing", "leads", "rules"] },
    { name: "crm.record_lost_reason", domain: "crm", server: "crm-service", description: "Document competitive loss reason and competitor name for a closed deal.", props: { deal_id: "string", reason: "string" }, tags: ["closed-lost", "competitor", "deal"] },
    { name: "crm.get_account_contracts", domain: "crm", server: "crm-service", description: "Retrieve signed master service agreements and order forms for customer.", props: { account_id: "string" }, tags: ["contract", "msa", "legal"] },
    { name: "crm.schedule_sales_demo", domain: "crm", server: "crm-service", description: "Schedule a product demonstration walkthrough for an enterprise prospect.", props: { lead_id: "string", date: "string" }, tags: ["demo", "sales", "prospect"] },
    { name: "crm.enrich_company_data", domain: "crm", server: "crm-service", description: "Enrich company profile with employee count, revenue, and industry tech stack.", props: { domain: "string" }, tags: ["enrich", "firmographic", "data"] },
    { name: "crm.create_campaign", domain: "crm", server: "crm-service", description: "Create an outbound email nurture campaign for target prospect segment.", props: { campaign_name: "string" }, tags: ["campaign", "marketing", "nurture"] },
    { name: "crm.generate_pipeline_report", domain: "crm", server: "crm-service", description: "Generate monthly pipeline summary charts and conversion rates by stage.", props: { month: "string" }, tags: ["report", "pipeline", "analytics"] },

    // CloudOps
    { name: "cloudops.export_telemetry", domain: "cloudops", server: "cloudops-service", description: "Export Prometheus metrics and latency histograms to an OpenTelemetry sink.", props: { metric_name: "string" }, tags: ["telemetry", "prometheus", "metrics"] },
    { name: "cloudops.list_ssl_certificates", domain: "cloudops", server: "cloudops-service", description: "List all active SSL/TLS certificates, expiry dates, and domains on load balancer.", props: { balancer_id: "string" }, tags: ["ssl", "tls", "certificates"] },
    { name: "cloudops.purge_cdn_cache", domain: "cloudops", server: "cloudops-service", description: "Purge edge cache assets and static files across Cloudflare or CloudFront CDN.", props: { url_path: "string" }, tags: ["cdn", "purge", "cache"] },
    { name: "cloudops.get_pod_metrics", domain: "cloudops", server: "cloudops-service", description: "Fetch CPU and memory consumption stats for a specific Kubernetes container pod.", props: { pod_name: "string" }, tags: ["pod", "metrics", "cpu"] },
    { name: "cloudops.restart_pod", domain: "cloudops", server: "cloudops-service", description: "Kill and restart a malfunctioning Kubernetes pod instance in a namespace.", props: { pod_name: "string" }, tags: ["pod", "restart", "kill"] },
    { name: "cloudops.scale_worker_pool", domain: "cloudops", server: "cloudops-service", description: "Scale background message queue consumer worker pool size up or down.", props: { pool_name: "string", size: "number" }, tags: ["worker", "queue", "scale"] },
    { name: "cloudops.get_firewall_rules", domain: "cloudops", server: "cloudops-service", description: "List VPC security group ingress and egress firewall rules and IP allowances.", props: { vpc_id: "string" }, tags: ["firewall", "vpc", "security"] },
    { name: "cloudops.apply_config_map", domain: "cloudops", server: "cloudops-service", description: "Apply updated configuration parameters to Kubernetes ConfigMap resource.", props: { config_name: "string", yaml: "string" }, tags: ["configmap", "k8s", "config"] },
    { name: "cloudops.trigger_log_dump", domain: "cloudops", server: "cloudops-service", description: "Create an emergency archive dump of all host logs for post-incident review.", props: { host_id: "string" }, tags: ["logs", "dump", "archive"] },
    { name: "cloudops.check_dns_propagation", domain: "cloudops", server: "cloudops-service", description: "Check authoritative DNS resolution and TTL propagation across global resolvers.", props: { domain: "string" }, tags: ["dns", "resolve", "propagation"] },
    { name: "cloudops.list_s3_buckets", domain: "cloudops", server: "cloudops-service", description: "List object storage buckets, byte sizes, and encryption policies.", props: { region: "string" }, tags: ["s3", "storage", "buckets"] },
    { name: "cloudops.renew_api_gateway_token", domain: "cloudops", server: "cloudops-service", description: "Rotate master authorization token for internal microservice gateway mesh.", props: { service_id: "string" }, tags: ["token", "gateway", "auth"] },
    { name: "cloudops.simulate_network_partition", domain: "cloudops", server: "cloudops-service", description: "Inject synthetic network packet loss or latency for chaos engineering test.", props: { target_zone: "string" }, tags: ["chaos", "network", "partition"] },
    { name: "cloudops.get_disk_iops", domain: "cloudops", server: "cloudops-service", description: "Monitor read/write IOPS throughput and latency on persistent EBS disk volumes.", props: { volume_id: "string" }, tags: ["iops", "disk", "throughput"] },
    { name: "cloudops.quarantine_host_node", domain: "cloudops", server: "cloudops-service", description: "Isolate a compromised server node from network traffic for forensic audit.", props: { node_id: "string" }, tags: ["quarantine", "security", "node"] },
    { name: "cloudops.inspect_load_balancer", domain: "cloudops", server: "cloudops-service", description: "Inspect active target groups, healthy host counts, and HTTP error rate.", props: { lb_arn: "string" }, tags: ["load-balancer", "traffic", "health"] },
    { name: "cloudops.deploy_lambda_function", domain: "cloudops", server: "cloudops-service", description: "Deploy updated serverless zip package to AWS Lambda execution runtime.", props: { function_name: "string" }, tags: ["lambda", "serverless", "deploy"] },
    { name: "cloudops.manage_auto_scaling_group", domain: "cloudops", server: "cloudops-service", description: "Modify min, max, and desired capacity on EC2 auto-scaling group.", props: { group_name: "string", desired: "number" }, tags: ["asg", "autoscale", "ec2"] },

    // HR
    { name: "hr.download_paystub_pdf", domain: "hr", server: "hr-service", description: "Download official PDF paystub document for a specific pay period.", props: { employee_id: "string", period: "string" }, tags: ["paystub", "pdf", "payroll"] },
    { name: "hr.update_tax_withholdings", domain: "hr", server: "hr-service", description: "Update W-4 federal and state tax withholding allowances for employee payroll.", props: { employee_id: "string", allowances: "number" }, tags: ["w4", "tax", "withholdings"] },
    { name: "hr.enroll_benefits", domain: "hr", server: "hr-service", description: "Elect medical, dental, and vision insurance coverage during open enrollment.", props: { employee_id: "string", plan_code: "string" }, tags: ["benefits", "insurance", "health"] },
    { name: "hr.get_pto_calendar", domain: "hr", server: "hr-service", description: "View team-wide vacation schedule and overlapping out-of-office dates.", props: { department: "string", month: "string" }, tags: ["pto", "calendar", "team"] },
    { name: "hr.upload_resume_document", domain: "hr", server: "hr-service", description: "Upload resume PDF file and parse biographical work history into candidate record.", props: { candidate_id: "string", file_path: "string" }, tags: ["resume", "upload", "candidate"] },
    { name: "hr.assign_onboarding_mentor", domain: "hr", server: "hr-service", description: "Assign an experienced colleague as buddy or onboarding mentor to new employee.", props: { new_hire_id: "string", mentor_id: "string" }, tags: ["mentor", "buddy", "onboarding"] },
    { name: "hr.send_offer_letter", domain: "hr", server: "hr-service", description: "Generate and send formal employment offer letter with salary via DocuSign.", props: { candidate_id: "string", salary: "number" }, tags: ["offer", "hiring", "salary"] },
    { name: "hr.calculate_severance", domain: "hr", server: "hr-service", description: "Calculate severance package and accrued PTO payout for departing staff member.", props: { employee_id: "string" }, tags: ["severance", "offboarding", "payout"] },
    { name: "hr.schedule_exit_interview", domain: "hr", server: "hr-service", description: "Schedule final exit interview survey between resigning employee and HRBP.", props: { employee_id: "string", date: "string" }, tags: ["exit", "interview", "resignation"] },
    { name: "hr.list_company_holidays", domain: "hr", server: "hr-service", description: "List observed corporate paid holidays and office closure dates for calendar year.", props: { year: "number" }, tags: ["holidays", "closures", "calendar"] },
    { name: "hr.submit_expense_claim", domain: "hr", server: "hr-service", description: "Submit receipt and business travel expense report for manager reimbursement.", props: { employee_id: "string", amount: "number" }, tags: ["expense", "reimbursement", "receipt"] },
    { name: "hr.order_replacement_badge", domain: "hr", server: "hr-service", description: "Request issuance of a replacement RFID security access badge for office.", props: { employee_id: "string" }, tags: ["badge", "security", "access"] },
    { name: "hr.request_ergonomic_equipment", domain: "hr", server: "hr-service", description: "Submit workplace accommodation request for standing desk or ergonomic chair.", props: { employee_id: "string", item: "string" }, tags: ["ergonomic", "desk", "facilities"] },
    { name: "hr.verify_right_to_work", domain: "hr", server: "hr-service", description: "Process I-9 verification and work authorization documents for employee.", props: { employee_id: "string" }, tags: ["i9", "verification", "legal"] },
    { name: "hr.nominate_peer_award", domain: "hr", server: "hr-service", description: "Submit quarterly peer recognition nomination and monetary spot bonus for coworker.", props: { nominee_id: "string", reason: "string" }, tags: ["recognition", "award", "bonus"] },
    { name: "hr.record_certifications", domain: "hr", server: "hr-service", description: "Add technical certifications, licenses, and renewal dates to employee CV.", props: { employee_id: "string", cert_name: "string" }, tags: ["certification", "license", "skills"] },
    { name: "hr.adjust_hourly_wage", domain: "hr", server: "hr-service", description: "Process merit increase or promotion adjustment to employee base hourly wage.", props: { employee_id: "string", new_rate: "number" }, tags: ["wage", "raise", "compensation"] },
    { name: "hr.audit_diversity_metrics", domain: "hr", server: "hr-service", description: "Generate aggregated anonymous demographic diversity report for hiring pipeline.", props: { department: "string" }, tags: ["diversity", "eeo", "metrics"] },

    // Billing
    { name: "billing.export_invoices_csv", domain: "billing", server: "billing-service", description: "Export historical customer invoices, taxes, and payment status to a CSV file.", props: { year: "number" }, tags: ["export", "csv", "invoices"] },
    { name: "billing.download_invoice_pdf", domain: "billing", server: "billing-service", description: "Download printable PDF format invoice document with formal company header.", props: { invoice_id: "string" }, tags: ["invoice", "pdf", "receipt"] },
    { name: "billing.issue_credit_memo", domain: "billing", server: "billing-service", description: "Issue a credit note memo reducing account receivable amount on disputed invoice.", props: { invoice_id: "string", credit_amount: "number" }, tags: ["credit-memo", "discount", "adjustment"] },
    { name: "billing.update_tax_exemption", domain: "billing", server: "billing-service", description: "Upload non-profit or resale tax exemption certificate for VAT/sales tax waiver.", props: { customer_id: "string", cert_id: "string" }, tags: ["tax", "exemption", "vat"] },
    { name: "billing.get_payment_gateway_status", domain: "billing", server: "billing-service", description: "Check operational health and response times for Stripe, Adyen, and PayPal gateways.", props: { gateway_name: "string" }, tags: ["gateway", "stripe", "status"] },
    { name: "billing.calculate_proration", domain: "billing", server: "billing-service", description: "Calculate mid-cycle plan upgrade or downgrade proration credit and debit amounts.", props: { subscription_id: "string", new_plan: "string" }, tags: ["proration", "upgrade", "subscription"] },
    { name: "billing.configure_auto_recharge", domain: "billing", server: "billing-service", description: "Set minimum prepaid balance threshold and auto-top-up charge amount.", props: { customer_id: "string", threshold: "number" }, tags: ["auto-topup", "recharge", "prepaid"] },
    { name: "billing.list_payment_methods", domain: "billing", server: "billing-service", description: "List all cards, bank accounts, and wallets on file for a customer.", props: { customer_id: "string" }, tags: ["wallet", "cards", "payment-methods"] },
    { name: "billing.verify_bank_account", domain: "billing", server: "billing-service", description: "Confirm micro-deposit amounts to verify ACH bank account for direct debit.", props: { account_id: "string", amounts: "string" }, tags: ["ach", "bank", "micro-deposit"] },
    { name: "billing.get_mrr_metrics", domain: "billing", server: "billing-service", description: "Retrieve monthly recurring revenue (MRR), net expansion, and churn analytics.", props: { month: "string" }, tags: ["mrr", "churn", "saas-metrics"] },
    { name: "billing.adjust_billing_cycle_anchor", domain: "billing", server: "billing-service", description: "Change customer monthly billing invoice date to a specific day of the month.", props: { customer_id: "string", day: "number" }, tags: ["billing-date", "cycle", "invoice"] },
    { name: "billing.process_wire_transfer", domain: "billing", server: "billing-service", description: "Record manual SWIFT or Fedwire bank transfer payment received against invoice.", props: { invoice_id: "string", wire_ref: "string" }, tags: ["wire", "swift", "manual-payment"] },
    { name: "billing.configure_vat_id", domain: "billing", server: "billing-service", description: "Validate and save European VIES VAT registration number for reverse charge.", props: { customer_id: "string", vat_id: "string" }, tags: ["vat", "vies", "tax-id"] },
    { name: "billing.freeze_overdue_account", domain: "billing", server: "billing-service", description: "Suspend API access and services for customer account with 60+ days overdue bills.", props: { customer_id: "string" }, tags: ["suspend", "delinquent", "freeze"] },
    { name: "billing.preview_upcoming_invoice", domain: "billing", server: "billing-service", description: "Generate draft preview of upcoming monthly charges and metered consumption.", props: { subscription_id: "string" }, tags: ["preview", "draft", "upcoming"] },
    { name: "billing.split_payment_charge", domain: "billing", server: "billing-service", description: "Split an invoice balance across two different credit cards or payment methods.", props: { invoice_id: "string", splits: "string" }, tags: ["split", "charge", "multiple-cards"] },
    { name: "billing.create_custom_quote", domain: "billing", server: "billing-service", description: "Draft enterprise pricing quote with custom terms and volume tiered discount.", props: { customer_id: "string", items: "string" }, tags: ["quote", "enterprise", "pricing"] },
    { name: "billing.reopen_voided_invoice", domain: "billing", server: "billing-service", description: "Reinstate a voided invoice back to open status following dispute resolution.", props: { invoice_id: "string" }, tags: ["reopen", "reinstate", "invoice"] },

    // Calendar
    { name: "calendar.export_ical_feed", domain: "calendar", server: "calendar-service", description: "Export calendar events to an iCalendar (.ics) subscription URL link.", props: { user_email: "string" }, tags: ["ics", "export", "ical"] },
    { name: "calendar.set_reminder_alert", domain: "calendar", server: "calendar-service", description: "Set desktop notification or email pop-up alarm 10 minutes before meeting.", props: { event_id: "string", minutes_before: "number" }, tags: ["reminder", "alarm", "notification"] },
    { name: "calendar.duplicate_event", domain: "calendar", server: "calendar-service", description: "Clone an existing calendar meeting and invitees to a different target date.", props: { event_id: "string", new_date: "string" }, tags: ["duplicate", "clone", "meeting"] },
    { name: "calendar.find_available_room", domain: "calendar", server: "calendar-service", description: "Find an empty conference room with video equipment on a specific floor.", props: { capacity: "number", date_time: "string" }, tags: ["room", "conference", "empty"] },
    { name: "calendar.sync_google_calendar", domain: "calendar", server: "calendar-service", description: "Trigger bidirectional synchronization with external Google Calendar account.", props: { user_email: "string" }, tags: ["google", "sync", "external"] },
    { name: "calendar.get_calendar_timezone", domain: "calendar", server: "calendar-service", description: "Fetch primary IANA time zone identifier for user calendar profile.", props: { user_email: "string" }, tags: ["timezone", "iana", "profile"] },
    { name: "calendar.block_focus_time", domain: "calendar", server: "calendar-service", description: "Schedule a non-interruptible deep work focus time block on daily calendar.", props: { hours: "number", date: "string" }, tags: ["focus", "deep-work", "block"] },
    { name: "calendar.delegate_calendar_access", domain: "calendar", server: "calendar-service", description: "Grant executive assistant permission to schedule and edit events on calendar.", props: { owner: "string", delegate: "string" }, tags: ["delegate", "assistant", "permissions"] },
    { name: "calendar.list_public_holidays", domain: "calendar", server: "calendar-service", description: "Fetch national and regional holidays to overlay onto team calendar schedule.", props: { country: "string", year: "number" }, tags: ["holidays", "regional", "national"] },
    { name: "calendar.suggest_meeting_agenda", domain: "calendar", server: "calendar-service", description: "Generate recommended meeting agenda items and time allocations for meeting.", props: { topic: "string" }, tags: ["agenda", "meeting", "topics"] },
    { name: "calendar.find_next_common_free_hour", domain: "calendar", server: "calendar-service", description: "Find the soonest 60-minute window when all required executives are free.", props: { attendees: "string" }, tags: ["free-hour", "executives", "slot"] },
    { name: "calendar.share_calendar_link", domain: "calendar", server: "calendar-service", description: "Generate public Calendly-style booking link for external guests to schedule calls.", props: { user_email: "string" }, tags: ["booking-link", "scheduling", "public"] },
    { name: "calendar.cancel_recurring_instance", domain: "calendar", server: "calendar-service", description: "Cancel only a single instance of a recurring weekly meeting without deleting series.", props: { series_id: "string", instance_date: "string" }, tags: ["single-instance", "cancel", "series"] },
    { name: "calendar.mark_vip_meeting", domain: "calendar", server: "calendar-service", description: "Flag meeting as high priority VIP customer session to prevent auto-rescheduling.", props: { event_id: "string" }, tags: ["vip", "priority", "protection"] },
    { name: "calendar.set_buffer_time", domain: "calendar", server: "calendar-service", description: "Automatically add 5-minute transition buffer between back-to-back meetings.", props: { user_email: "string", buffer_minutes: "number" }, tags: ["buffer", "transition", "back-to-back"] },
    { name: "calendar.get_rsvp_counts", domain: "calendar", server: "calendar-service", description: "Get count of accepted, declined, and tentative RSVPs for an all-hands meeting.", props: { event_id: "string" }, tags: ["rsvp", "count", "headcount"] },
    { name: "calendar.bulk_decline_meetings", domain: "calendar", server: "calendar-service", description: "Decline all meeting invitations across an entire afternoon with customized note.", props: { user_email: "string", date: "string" }, tags: ["bulk-decline", "clear", "afternoon"] },
    { name: "calendar.update_meeting_room_display", domain: "calendar", server: "calendar-service", description: "Refresh electronic iPad room sign outside conference room with current meeting.", props: { room_id: "string" }, tags: ["display", "signage", "tablet"] }
  ];

  return specs.map((s, idx) => ({
    id: `tool_syn_${s.domain}_${idx + 1}`,
    name: s.name,
    serverId: s.server,
    domain: s.domain,
    description: s.description,
    inputSchema: {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(s.props).map(([k, v]) => [k, { type: v }])
      )
    },
    isCore: false,
    tags: s.tags,
    isSeed: false,
    isSynthetic: true,
    isNearDuplicate: false,
    isVague: false
  }));
}

// -------------------------------------------------------------
// 5. CORPUS ASSEMBLY & SUBSET PARTITIONING
// -------------------------------------------------------------

export function buildCompleteToolCorpus(): ToolDefinition[] {
  const specialized = generateSpecializedSyntheticTools();
  const allTools = [
    ...ALL_SEED_TOOLS,        // 97 tools (7 real + 90 seeds)
    ...NEAR_DUPLICATE_TOOLS,   // 30 tools
    ...VAGUE_TOOLS,            // 18 tools
    ...specialized             // 90 tools
  ];                           // Total = 235 tools

  // If we need a round 250 tools, synthesize remaining 15 domain helpers
  const extraTools: ToolDefinition[] = [];
  const extraDomains: ToolDomain[] = ["crm", "cloudops", "hr", "billing", "calendar"];
  for (let i = 0; i < 15; i++) {
    const domain = extraDomains[i % extraDomains.length]!;
    const name = `${domain}.helper_utility_${i + 1}`;
    extraTools.push({
      id: `tool_extra_${domain}_${i + 1}`,
      name,
      serverId: `${domain}-service`,
      domain,
      description: `Utility tool for specialized ${domain} background operations and maintenance step ${i + 1}.`,
      inputSchema: {
        type: "object",
        properties: { task_param: { type: "string" } }
      },
      isCore: false,
      tags: [domain, "utility", "background"],
      isSeed: false,
      isSynthetic: true,
      isNearDuplicate: false,
      isVague: true
    });
  }

  return [...allTools, ...extraTools]; // 250 tools total
}

export function buildDeterministicSubsets(tools: ToolDefinition[], prng: PRNG): CorpusSubsets {
  // Size 25 MUST contain:
  // - All 7 real server tools (orders.get_order, orders.list_orders, orders.get_tracking, refunds.issue_refund, refunds.get_refund_status, kb.search_policy, email.send_confirmation)
  // - 18 representative seed tools across CRM, CloudOps, HR, billing, calendar
  const realTools = tools.filter((t) => t.domain === "orders" || t.domain === "refunds" || t.domain === "kb" || t.domain === "email");
  const seedsByDomain: Record<string, ToolDefinition[]> = {};
  for (const t of tools) {
    if (t.isSeed && !realTools.includes(t)) {
      seedsByDomain[t.domain] = seedsByDomain[t.domain] ?? [];
      seedsByDomain[t.domain]!.push(t);
    }
  }

  const subset25Ids: string[] = realTools.map((t) => t.id);
  // Pick 3-4 seed tools from each of the 5 main domains to reach 25
  for (const domain of ["crm", "cloudops", "hr", "billing", "calendar"]) {
    const domainSeeds = seedsByDomain[domain] ?? [];
    const chosen = domainSeeds.slice(0, 3);
    for (const c of chosen) {
      if (subset25Ids.length < 25) {
        subset25Ids.push(c.id);
      }
    }
  }
  // Fill remaining up to 25 if needed
  for (const t of tools) {
    if (subset25Ids.length >= 25) break;
    if (t.isSeed && !subset25Ids.includes(t.id)) {
      subset25Ids.push(t.id);
    }
  }

  // Size 50 contains size 25 + 25 more tools (more seeds + near-duplicates)
  const subset50Ids = [...subset25Ids];
  const remainingFor50 = tools.filter((t) => !subset50Ids.includes(t.id) && (t.isSeed || t.isNearDuplicate));
  const shuffled50 = prng.shuffle(remainingFor50);
  for (const t of shuffled50) {
    if (subset50Ids.length >= 50) break;
    subset50Ids.push(t.id);
  }

  // Size 100 contains size 50 + 50 more tools (seeds + near-duplicates + vague tools)
  const subset100Ids = [...subset50Ids];
  const remainingFor100 = tools.filter((t) => !subset100Ids.includes(t.id));
  const shuffled100 = prng.shuffle(remainingFor100);
  for (const t of shuffled100) {
    if (subset100Ids.length >= 100) break;
    subset100Ids.push(t.id);
  }

  // Size 200 contains size 100 + 100 more tools
  const subset200Ids = [...subset100Ids];
  const remainingFor200 = tools.filter((t) => !subset200Ids.includes(t.id));
  const shuffled200 = prng.shuffle(remainingFor200);
  for (const t of shuffled200) {
    if (subset200Ids.length >= 200) break;
    subset200Ids.push(t.id);
  }

  return {
    25: subset25Ids,
    50: subset50Ids,
    100: subset100Ids,
    200: subset200Ids
  };
}

// -------------------------------------------------------------
// 6. BENCHMARK QUERIES (Separate pass, different style, zero label leakage)
// -------------------------------------------------------------

export interface RawQuerySpec {
  text: string;
  expectedTool: string;
  acceptableTools: string[];
  domain: ToolDomain;
  style: "terse" | "indirect" | "typo";
  difficulty: "easy" | "medium" | "hard";
  notes?: string;
}

export const BENCHMARK_QUERY_SPECS: RawQuerySpec[] = [
  // --- REAL SERVERS ---
  // orders.get_order
  { text: "where is order 9921", expectedTool: "orders.get_order", acceptableTools: ["orders.get_order", "orders.lookup_purchase_details"], domain: "orders", style: "terse", difficulty: "easy" },
  { text: "did customer 442 pay for their items?", expectedTool: "orders.get_order", acceptableTools: ["orders.get_order", "orders.lookup_purchase_details"], domain: "orders", style: "indirect", difficulty: "medium" },
  { text: "check ordr #7712 contents", expectedTool: "orders.get_order", acceptableTools: ["orders.get_order", "orders.lookup_purchase_details"], domain: "orders", style: "typo", difficulty: "medium" },
  { text: "pull up whatever was bought in transaction ord-109", expectedTool: "orders.get_order", acceptableTools: ["orders.get_order", "orders.lookup_purchase_details"], domain: "orders", style: "indirect", difficulty: "medium" },

  // orders.list_orders
  { text: "cust_901 purchase history", expectedTool: "orders.list_orders", acceptableTools: ["orders.list_orders"], domain: "orders", style: "terse", difficulty: "easy" },
  { text: "how many times has mrs smith shopped with us before?", expectedTool: "orders.list_orders", acceptableTools: ["orders.list_orders"], domain: "orders", style: "indirect", difficulty: "medium" },
  { text: "shwo me all orders by cust_99", expectedTool: "orders.list_orders", acceptableTools: ["orders.list_orders"], domain: "orders", style: "typo", difficulty: "medium" },

  // orders.get_tracking
  { text: "ship status ord-4482", expectedTool: "orders.get_tracking", acceptableTools: ["orders.get_tracking", "orders.track_shipment_progress"], domain: "orders", style: "terse", difficulty: "easy" },
  { text: "customer said their package never arrived and tracking shows delivered", expectedTool: "orders.get_tracking", acceptableTools: ["orders.get_tracking", "orders.track_shipment_progress"], domain: "orders", style: "indirect", difficulty: "medium" },
  { text: "whre is packge for 90210", expectedTool: "orders.get_tracking", acceptableTools: ["orders.get_tracking", "orders.track_shipment_progress"], domain: "orders", style: "typo", difficulty: "medium" },
  { text: "has ups picked up the box for ord-883 yet?", expectedTool: "orders.get_tracking", acceptableTools: ["orders.get_tracking", "orders.track_shipment_progress"], domain: "orders", style: "indirect", difficulty: "hard" },

  // refunds.issue_refund
  { text: "send refnd for #1092", expectedTool: "refunds.issue_refund", acceptableTools: ["refunds.issue_refund", "refunds.process_customer_reimbursement"], domain: "refunds", style: "terse", difficulty: "easy" },
  { text: "the client was double charged on their amex card and wants their money back", expectedTool: "refunds.issue_refund", acceptableTools: ["refunds.issue_refund", "refunds.process_customer_reimbursement"], domain: "refunds", style: "indirect", difficulty: "medium" },
  { text: "refnd custmr for broke itm", expectedTool: "refunds.issue_refund", acceptableTools: ["refunds.issue_refund", "refunds.process_customer_reimbursement"], domain: "refunds", style: "typo", difficulty: "medium" },
  { text: "credit fifty bucks back to visa acct_332 for returned sweater", expectedTool: "refunds.issue_refund", acceptableTools: ["refunds.issue_refund", "refunds.process_customer_reimbursement"], domain: "refunds", style: "indirect", difficulty: "medium" },

  // refunds.get_refund_status
  { text: "status ref_7812", expectedTool: "refunds.get_refund_status", acceptableTools: ["refunds.get_refund_status"], domain: "refunds", style: "terse", difficulty: "easy" },
  { text: "did that sixty dollar return reimbursement settle yet?", expectedTool: "refunds.get_refund_status", acceptableTools: ["refunds.get_refund_status"], domain: "refunds", style: "indirect", difficulty: "medium" },
  { text: "is refnd ref_9921 complete", expectedTool: "refunds.get_refund_status", acceptableTools: ["refunds.get_refund_status"], domain: "refunds", style: "typo", difficulty: "medium" },

  // kb.search_policy
  { text: "return window electronics", expectedTool: "kb.search_policy", acceptableTools: ["kb.search_policy", "kb.lookup_support_article"], domain: "kb", style: "terse", difficulty: "easy" },
  { text: "what is our policy regarding items returned without original packaging?", expectedTool: "kb.search_policy", acceptableTools: ["kb.search_policy", "kb.lookup_support_article"], domain: "kb", style: "indirect", difficulty: "medium" },
  { text: "faq on waranty period for audio gear", expectedTool: "kb.search_policy", acceptableTools: ["kb.search_policy", "kb.lookup_support_article"], domain: "kb", style: "typo", difficulty: "medium" },
  { text: "can someone get a store credit if 30 days have already elapsed?", expectedTool: "kb.search_policy", acceptableTools: ["kb.search_policy", "kb.lookup_support_article"], domain: "kb", style: "indirect", difficulty: "hard" },

  // email.send_confirmation
  { text: "send receipt 4 order 881", expectedTool: "email.send_confirmation", acceptableTools: ["email.send_confirmation", "email.dispatch_transactional_receipt"], domain: "email", style: "terse", difficulty: "easy" },
  { text: "notify the customer that their package has left our fulfillment center", expectedTool: "email.send_confirmation", acceptableTools: ["email.send_confirmation", "email.dispatch_transactional_receipt"], domain: "email", style: "indirect", difficulty: "medium" },
  { text: "senf confirmation mail to bob@example.com", expectedTool: "email.send_confirmation", acceptableTools: ["email.send_confirmation", "email.dispatch_transactional_receipt"], domain: "email", style: "typo", difficulty: "medium" },
  { text: "shoot an email to the buyer confirming their money was sent back", expectedTool: "email.send_confirmation", acceptableTools: ["email.send_confirmation", "email.dispatch_transactional_receipt"], domain: "email", style: "indirect", difficulty: "medium" },

  // --- CRM DOMAIN ---
  // crm.create_lead
  { text: "new lead john doe acme", expectedTool: "crm.create_lead", acceptableTools: ["crm.create_lead"], domain: "crm", style: "terse", difficulty: "easy" },
  { text: "got a business card at the conference from a guy named mark who wants a demo", expectedTool: "crm.create_lead", acceptableTools: ["crm.create_lead"], domain: "crm", style: "indirect", difficulty: "medium" },
  { text: "crte new lead for inbound call", expectedTool: "crm.create_lead", acceptableTools: ["crm.create_lead"], domain: "crm", style: "typo", difficulty: "medium" },

  // crm.get_lead
  { text: "lead acme stage", expectedTool: "crm.get_lead", acceptableTools: ["crm.get_lead", "crm.lookup_lead_info"], domain: "crm", style: "terse", difficulty: "easy" },
  { text: "did anyone follow up with the inbound prospect from last tuesday?", expectedTool: "crm.get_lead", acceptableTools: ["crm.get_lead", "crm.lookup_lead_info"], domain: "crm", style: "indirect", difficulty: "medium" },

  // crm.update_lead_status
  { text: "mark lead_109 qualified", expectedTool: "crm.update_lead_status", acceptableTools: ["crm.update_lead_status", "crm.modify_lead_stage"], domain: "crm", style: "terse", difficulty: "easy" },
  { text: "this prospect told us they have zero budget so disqualify them", expectedTool: "crm.update_lead_status", acceptableTools: ["crm.update_lead_status", "crm.modify_lead_stage"], domain: "crm", style: "indirect", difficulty: "medium" },

  // crm.convert_lead_to_deal
  { text: "convert lead_5 to deal", expectedTool: "crm.convert_lead_to_deal", acceptableTools: ["crm.convert_lead_to_deal"], domain: "crm", style: "terse", difficulty: "easy" },
  { text: "mark this prospect as converted and set up their corporate account", expectedTool: "crm.convert_lead_to_deal", acceptableTools: ["crm.convert_lead_to_deal"], domain: "crm", style: "indirect", difficulty: "hard" },

  // crm.create_contact
  { text: "add contact sarah@target.com", expectedTool: "crm.create_contact", acceptableTools: ["crm.create_contact"], domain: "crm", style: "terse", difficulty: "easy" },
  { text: "save this vp of engineering's phone number under the cisco account", expectedTool: "crm.create_contact", acceptableTools: ["crm.create_contact"], domain: "crm", style: "indirect", difficulty: "medium" },

  // crm.update_contact
  { text: "change phone contact_88", expectedTool: "crm.update_contact", acceptableTools: ["crm.update_contact", "crm.modify_contact_info"], domain: "crm", style: "terse", difficulty: "easy" },
  { text: "dave moved to a new director role and got a new corporate email", expectedTool: "crm.update_contact", acceptableTools: ["crm.update_contact", "crm.modify_contact_info"], domain: "crm", style: "indirect", difficulty: "medium" },

  // crm.search_contacts
  { text: "find contact wal-mart", expectedTool: "crm.search_contacts", acceptableTools: ["crm.search_contacts"], domain: "crm", style: "terse", difficulty: "easy" },
  { text: "who is our primary technical liaison at stripe?", expectedTool: "crm.search_contacts", acceptableTools: ["crm.search_contacts"], domain: "crm", style: "indirect", difficulty: "medium" },
  { text: "srch contacts in seattle area", expectedTool: "crm.search_contacts", acceptableTools: ["crm.search_contacts"], domain: "crm", style: "typo", difficulty: "medium" },

  // crm.create_deal
  { text: "new deal 50k acme", expectedTool: "crm.create_deal", acceptableTools: ["crm.create_deal", "crm.open_new_sales_opportunity"], domain: "crm", style: "terse", difficulty: "easy" },
  { text: "we have a verbal agreement for a 100k annual contract with uber", expectedTool: "crm.create_deal", acceptableTools: ["crm.create_deal", "crm.open_new_sales_opportunity"], domain: "crm", style: "indirect", difficulty: "medium" },

  // crm.update_deal_stage
  { text: "move deal_4 to closed-won", expectedTool: "crm.update_deal_stage", acceptableTools: ["crm.update_deal_stage"], domain: "crm", style: "terse", difficulty: "easy" },
  { text: "the customer signed the docusign, let's mark the deal as won", expectedTool: "crm.update_deal_stage", acceptableTools: ["crm.update_deal_stage"], domain: "crm", style: "indirect", difficulty: "medium" },

  // crm.add_customer_note
  { text: "add note to cust_5", expectedTool: "crm.add_customer_note", acceptableTools: ["crm.add_customer_note"], domain: "crm", style: "terse", difficulty: "easy" },
  { text: "jot down that the cto prefers asynchronous updates over zoom calls", expectedTool: "crm.add_customer_note", acceptableTools: ["crm.add_customer_note"], domain: "crm", style: "indirect", difficulty: "medium" },

  // crm.log_call_activity
  { text: "log call with bob 15m", expectedTool: "crm.log_call_activity", acceptableTools: ["crm.log_call_activity"], domain: "crm", style: "terse", difficulty: "easy" },
  { text: "just got off the phone with the procurement team about renewal terms", expectedTool: "crm.log_call_activity", acceptableTools: ["crm.log_call_activity"], domain: "crm", style: "indirect", difficulty: "medium" },

  // --- CLOUDOPS DOMAIN ---
  // cloudops.restart_service
  { text: "restart nginx web-1", expectedTool: "cloudops.restart_service", acceptableTools: ["cloudops.restart_service", "cloudops.reboot_server_instance"], domain: "cloudops", style: "terse", difficulty: "easy" },
  { text: "nginx is throwing 502 bad gateway on our web frontend", expectedTool: "cloudops.restart_service", acceptableTools: ["cloudops.restart_service", "cloudops.reboot_server_instance"], domain: "cloudops", style: "indirect", difficulty: "medium" },
  { text: "restrt container prod-worker-1", expectedTool: "cloudops.restart_service", acceptableTools: ["cloudops.restart_service", "cloudops.reboot_server_instance"], domain: "cloudops", style: "typo", difficulty: "medium" },

  // cloudops.get_service_health
  { text: "health status auth-svc", expectedTool: "cloudops.get_service_health", acceptableTools: ["cloudops.get_service_health"], domain: "cloudops", style: "terse", difficulty: "easy" },
  { text: "is the payment gateway responding to readiness probes right now?", expectedTool: "cloudops.get_service_health", acceptableTools: ["cloudops.get_service_health"], domain: "cloudops", style: "indirect", difficulty: "medium" },

  // cloudops.scale_deployment
  { text: "scale api-gateway to 10", expectedTool: "cloudops.scale_deployment", acceptableTools: ["cloudops.scale_deployment"], domain: "cloudops", style: "terse", difficulty: "easy" },
  { text: "traffic is spiking due to black friday, add more container replicas", expectedTool: "cloudops.scale_deployment", acceptableTools: ["cloudops.scale_deployment"], domain: "cloudops", style: "indirect", difficulty: "medium" },

  // cloudops.get_cpu_metrics
  { text: "cpu stats srv-prod-02", expectedTool: "cloudops.get_cpu_metrics", acceptableTools: ["cloudops.get_cpu_metrics", "cloudops.query_processor_utilization"], domain: "cloudops", style: "terse", difficulty: "easy" },
  { text: "server load average is through the roof on node 4", expectedTool: "cloudops.get_cpu_metrics", acceptableTools: ["cloudops.get_cpu_metrics", "cloudops.query_processor_utilization"], domain: "cloudops", style: "indirect", difficulty: "medium" },

  // cloudops.get_memory_metrics
  { text: "mem usage node-3", expectedTool: "cloudops.get_memory_metrics", acceptableTools: ["cloudops.get_memory_metrics"], domain: "cloudops", style: "terse", difficulty: "easy" },
  { text: "is our database node running out of RAM?", expectedTool: "cloudops.get_memory_metrics", acceptableTools: ["cloudops.get_memory_metrics"], domain: "cloudops", style: "indirect", difficulty: "medium" },
  { text: "chekc oom kill swap stats node2", expectedTool: "cloudops.get_memory_metrics", acceptableTools: ["cloudops.get_memory_metrics"], domain: "cloudops", style: "typo", difficulty: "medium" },

  // cloudops.fetch_container_logs
  { text: "logs for pod worker-7f9", expectedTool: "cloudops.fetch_container_logs", acceptableTools: ["cloudops.fetch_container_logs", "cloudops.stream_application_logs"], domain: "cloudops", style: "terse", difficulty: "easy" },
  { text: "what error was printed to stderr right before the crash?", expectedTool: "cloudops.fetch_container_logs", acceptableTools: ["cloudops.fetch_container_logs", "cloudops.stream_application_logs"], domain: "cloudops", style: "indirect", difficulty: "medium" },

  // cloudops.rollback_deployment
  { text: "rollback billing-service", expectedTool: "cloudops.rollback_deployment", acceptableTools: ["cloudops.rollback_deployment", "cloudops.revert_software_version"], domain: "cloudops", style: "terse", difficulty: "easy" },
  { text: "the latest release broke authentication, revert immediately", expectedTool: "cloudops.rollback_deployment", acceptableTools: ["cloudops.rollback_deployment", "cloudops.revert_software_version"], domain: "cloudops", style: "indirect", difficulty: "hard" },

  // cloudops.list_active_pods
  { text: "list pods ns-prod", expectedTool: "cloudops.list_active_pods", acceptableTools: ["cloudops.list_active_pods"], domain: "cloudops", style: "terse", difficulty: "easy" },
  { text: "how many instances of our ingestion worker are currently alive?", expectedTool: "cloudops.list_active_pods", acceptableTools: ["cloudops.list_active_pods"], domain: "cloudops", style: "indirect", difficulty: "medium" },

  // cloudops.check_disk_usage
  { text: "disk space node-db-01", expectedTool: "cloudops.check_disk_usage", acceptableTools: ["cloudops.check_disk_usage"], domain: "cloudops", style: "terse", difficulty: "easy" },
  { text: "disck space running low on srv-01", expectedTool: "cloudops.check_disk_usage", acceptableTools: ["cloudops.check_disk_usage"], domain: "cloudops", style: "typo", difficulty: "medium" },

  // cloudops.flush_cache_cluster
  { text: "flush redis cluster-prod", expectedTool: "cloudops.flush_cache_cluster", acceptableTools: ["cloudops.flush_cache_cluster"], domain: "cloudops", style: "terse", difficulty: "easy" },
  { text: "users are seeing stale product data, wipe the cached keys", expectedTool: "cloudops.flush_cache_cluster", acceptableTools: ["cloudops.flush_cache_cluster"], domain: "cloudops", style: "indirect", difficulty: "medium" },

  // --- HR DOMAIN ---
  // hr.get_employee_profile
  { text: "profile emp_102", expectedTool: "hr.get_employee_profile", acceptableTools: ["hr.get_employee_profile", "hr.fetch_worker_record"], domain: "hr", style: "terse", difficulty: "easy" },
  { text: "when did alex join the company and what is his job grade?", expectedTool: "hr.get_employee_profile", acceptableTools: ["hr.get_employee_profile", "hr.fetch_worker_record"], domain: "hr", style: "indirect", difficulty: "medium" },

  // hr.list_department_members
  { text: "eng department members", expectedTool: "hr.list_department_members", acceptableTools: ["hr.list_department_members"], domain: "hr", style: "terse", difficulty: "easy" },
  { text: "whos in chagre of devops team", expectedTool: "hr.list_department_members", acceptableTools: ["hr.list_department_members"], domain: "hr", style: "typo", difficulty: "medium" },
  { text: "give me a roster of everyone working under marketing", expectedTool: "hr.list_department_members", acceptableTools: ["hr.list_department_members"], domain: "hr", style: "indirect", difficulty: "medium" },

  // hr.get_reporting_chain
  { text: "who is alice's mgr", expectedTool: "hr.get_reporting_chain", acceptableTools: ["hr.get_reporting_chain"], domain: "hr", style: "terse", difficulty: "easy" },
  { text: "who does jason report to in the engineering department?", expectedTool: "hr.get_reporting_chain", acceptableTools: ["hr.get_reporting_chain"], domain: "hr", style: "indirect", difficulty: "medium" },

  // hr.request_pto
  { text: "book vacation oct 10-15", expectedTool: "hr.request_pto", acceptableTools: ["hr.request_pto", "hr.submit_time_off_request"], domain: "hr", style: "terse", difficulty: "easy" },
  { text: "i feel sick today and will be resting at home", expectedTool: "hr.request_pto", acceptableTools: ["hr.request_pto", "hr.submit_time_off_request"], domain: "hr", style: "indirect", difficulty: "medium" },
  { text: "submt pto for next monday", expectedTool: "hr.request_pto", acceptableTools: ["hr.request_pto", "hr.submit_time_off_request"], domain: "hr", style: "typo", difficulty: "medium" },

  // hr.get_pto_balance
  { text: "bob pto balance", expectedTool: "hr.get_pto_balance", acceptableTools: ["hr.get_pto_balance", "hr.query_vacation_allowance"], domain: "hr", style: "terse", difficulty: "easy" },
  { text: "sarah wants to know how many vacation days she has left before december", expectedTool: "hr.get_pto_balance", acceptableTools: ["hr.get_pto_balance", "hr.query_vacation_allowance"], domain: "hr", style: "indirect", difficulty: "medium" },

  // hr.approve_pto_request
  { text: "approve pto req_44", expectedTool: "hr.approve_pto_request", acceptableTools: ["hr.approve_pto_request"], domain: "hr", style: "terse", difficulty: "easy" },
  { text: "aprove vacation for dave", expectedTool: "hr.approve_pto_request", acceptableTools: ["hr.approve_pto_request"], domain: "hr", style: "typo", difficulty: "medium" },

  // hr.get_payroll_summary
  { text: "paystub summary emp_88", expectedTool: "hr.get_payroll_summary", acceptableTools: ["hr.get_payroll_summary", "hr.view_paystub_breakdown"], domain: "hr", style: "terse", difficulty: "easy" },
  { text: "how much was deducted for social security on my last paycheck?", expectedTool: "hr.get_payroll_summary", acceptableTools: ["hr.get_payroll_summary", "hr.view_paystub_breakdown"], domain: "hr", style: "indirect", difficulty: "medium" },

  // hr.schedule_interview
  { text: "interview slot for candidate 99", expectedTool: "hr.schedule_interview", acceptableTools: ["hr.schedule_interview", "hr.book_candidate_screening"], domain: "hr", style: "terse", difficulty: "easy" },
  { text: "let's set up a technical screening with the backend applicant on friday", expectedTool: "hr.schedule_interview", acceptableTools: ["hr.schedule_interview", "hr.book_candidate_screening"], domain: "hr", style: "indirect", difficulty: "medium" },

  // --- BILLING DOMAIN ---
  // billing.get_invoice
  { text: "inv-901 details", expectedTool: "billing.get_invoice", acceptableTools: ["billing.get_invoice", "billing.retrieve_bill_by_number"], domain: "billing", style: "terse", difficulty: "easy" },
  { text: "chekc invoce status inv-981", expectedTool: "billing.get_invoice", acceptableTools: ["billing.get_invoice", "billing.retrieve_bill_by_number"], domain: "billing", style: "typo", difficulty: "medium" },
  { text: "why was this customer charged 450 dollars instead of 300 on their last statement?", expectedTool: "billing.get_invoice", acceptableTools: ["billing.get_invoice", "billing.retrieve_bill_by_number"], domain: "billing", style: "indirect", difficulty: "medium" },

  // billing.list_customer_invoices
  { text: "invoices for cust_441", expectedTool: "billing.list_customer_invoices", acceptableTools: ["billing.list_customer_invoices"], domain: "billing", style: "terse", difficulty: "easy" },
  { text: "how mch did we bll acme corp last mnth", expectedTool: "billing.list_customer_invoices", acceptableTools: ["billing.list_customer_invoices"], domain: "billing", style: "typo", difficulty: "medium" },
  { text: "pull up every bill we ever sent to salesforce", expectedTool: "billing.list_customer_invoices", acceptableTools: ["billing.list_customer_invoices"], domain: "billing", style: "indirect", difficulty: "medium" },

  // billing.create_invoice
  { text: "bill client 1200 for consulting", expectedTool: "billing.create_invoice", acceptableTools: ["billing.create_invoice", "billing.generate_bill"], domain: "billing", style: "terse", difficulty: "easy" },
  { text: "send an itemized request for payment for 5 hours of design work", expectedTool: "billing.create_invoice", acceptableTools: ["billing.create_invoice", "billing.generate_bill"], domain: "billing", style: "indirect", difficulty: "medium" },

  // billing.cancel_subscription
  { text: "cancel acme sub", expectedTool: "billing.cancel_subscription", acceptableTools: ["billing.cancel_subscription", "billing.terminate_recurring_plan"], domain: "billing", style: "terse", difficulty: "easy" },
  { text: "we need to stop billing the customer before the 1st of next month", expectedTool: "billing.cancel_subscription", acceptableTools: ["billing.cancel_subscription", "billing.terminate_recurring_plan"], domain: "billing", style: "indirect", difficulty: "medium" },
  { text: "cancl subscrip sub_881", expectedTool: "billing.cancel_subscription", acceptableTools: ["billing.cancel_subscription", "billing.terminate_recurring_plan"], domain: "billing", style: "typo", difficulty: "medium" },

  // billing.get_account_balance
  { text: "need 2 see what client ows us", expectedTool: "billing.get_account_balance", acceptableTools: ["billing.get_account_balance", "billing.fetch_outstanding_dues"], domain: "billing", style: "terse", difficulty: "easy" },
  { text: "does the customer have any unpaid balances or leftover credits on their account?", expectedTool: "billing.get_account_balance", acceptableTools: ["billing.get_account_balance", "billing.fetch_outstanding_dues"], domain: "billing", style: "indirect", difficulty: "medium" },

  // billing.retry_failed_payment
  { text: "retry failed charge inv_77", expectedTool: "billing.retry_failed_payment", acceptableTools: ["billing.retry_failed_payment"], domain: "billing", style: "terse", difficulty: "easy" },
  { text: "customer says their bank put fraud hold on card which is now lifted, charge it again", expectedTool: "billing.retry_failed_payment", acceptableTools: ["billing.retry_failed_payment"], domain: "billing", style: "indirect", difficulty: "medium" },

  // --- CALENDAR DOMAIN ---
  // calendar.create_event
  { text: "meet with bob tomorrow 10am", expectedTool: "calendar.create_event", acceptableTools: ["calendar.create_event", "calendar.schedule_calendar_entry"], domain: "calendar", style: "terse", difficulty: "easy" },
  { text: "put an all-hands product roadmap sync on the calendar for wednesday", expectedTool: "calendar.create_event", acceptableTools: ["calendar.create_event", "calendar.schedule_calendar_entry"], domain: "calendar", style: "indirect", difficulty: "medium" },
  { text: "schedul meeting with sarah", expectedTool: "calendar.create_event", acceptableTools: ["calendar.create_event", "calendar.schedule_calendar_entry"], domain: "calendar", style: "typo", difficulty: "medium" },

  // calendar.find_free_meeting_slots
  { text: "free slots tmrw afternoon", expectedTool: "calendar.find_free_meeting_slots", acceptableTools: ["calendar.find_free_meeting_slots", "calendar.query_calendar_availability"], domain: "calendar", style: "terse", difficulty: "easy" },
  { text: "alice and i need 30 mins to sync about the sprint before friday", expectedTool: "calendar.find_free_meeting_slots", acceptableTools: ["calendar.find_free_meeting_slots", "calendar.query_calendar_availability"], domain: "calendar", style: "indirect", difficulty: "medium" },

  // calendar.delete_event
  { text: "drop 4pm sync", expectedTool: "calendar.delete_event", acceptableTools: ["calendar.delete_event", "calendar.cancel_scheduled_meeting"], domain: "calendar", style: "terse", difficulty: "easy" },
  { text: "delte meeting from my calndar", expectedTool: "calendar.delete_event", acceptableTools: ["calendar.delete_event", "calendar.cancel_scheduled_meeting"], domain: "calendar", style: "typo", difficulty: "medium" },
  { text: "cancel the one-on-one since my lead is travelling today", expectedTool: "calendar.delete_event", acceptableTools: ["calendar.delete_event", "calendar.cancel_scheduled_meeting"], domain: "calendar", style: "indirect", difficulty: "medium" },

  // calendar.reschedule_event
  { text: "resched 3pm mtg", expectedTool: "calendar.reschedule_event", acceptableTools: ["calendar.reschedule_event", "calendar.move_meeting_timeslot"], domain: "calendar", style: "terse", difficulty: "easy" },
  { text: "reschedul 3pm sync with marketing", expectedTool: "calendar.reschedule_event", acceptableTools: ["calendar.reschedule_event", "calendar.move_meeting_timeslot"], domain: "calendar", style: "typo", difficulty: "medium" },
  { text: "can we push our design critique by an hour so people can grab lunch?", expectedTool: "calendar.reschedule_event", acceptableTools: ["calendar.reschedule_event", "calendar.move_meeting_timeslot"], domain: "calendar", style: "indirect", difficulty: "medium" },

  // calendar.book_conference_room
  { text: "conf room b 2pm", expectedTool: "calendar.book_conference_room", acceptableTools: ["calendar.book_conference_room", "calendar.find_available_room"], domain: "calendar", style: "terse", difficulty: "easy" },
  { text: "check if there are any available conference rooms on the 3rd floor at 10am", expectedTool: "calendar.book_conference_room", acceptableTools: ["calendar.book_conference_room", "calendar.find_available_room"], domain: "calendar", style: "indirect", difficulty: "medium" },

  // calendar.get_daily_agenda
  { text: "what's on my schedule today?", expectedTool: "calendar.get_daily_agenda", acceptableTools: ["calendar.get_daily_agenda", "calendar.view_daily_itinerary"], domain: "calendar", style: "indirect", difficulty: "easy" },
  { text: "daily schedule check for march 15", expectedTool: "calendar.get_daily_agenda", acceptableTools: ["calendar.get_daily_agenda", "calendar.view_daily_itinerary"], domain: "calendar", style: "terse", difficulty: "easy" },

  // calendar.detect_schedule_conflicts
  { text: "did i get double booked on tuesday?", expectedTool: "calendar.detect_schedule_conflicts", acceptableTools: ["calendar.detect_schedule_conflicts"], domain: "calendar", style: "indirect", difficulty: "medium" },
  { text: "check overlaps on calendar", expectedTool: "calendar.detect_schedule_conflicts", acceptableTools: ["calendar.detect_schedule_conflicts"], domain: "calendar", style: "terse", difficulty: "easy" },

  // calendar.set_out_of_office
  { text: "set ooo next week", expectedTool: "calendar.set_out_of_office", acceptableTools: ["calendar.set_out_of_office"], domain: "calendar", style: "terse", difficulty: "easy" },
  { text: "block my calendar out of office and decline any incoming meeting invites", expectedTool: "calendar.set_out_of_office", acceptableTools: ["calendar.set_out_of_office"], domain: "calendar", style: "indirect", difficulty: "medium" }
];

// Helper to expand query specs with more variations up to ~160 queries
export function generateAllBenchmarkQueries(prng: PRNG): BenchmarkQuery[] {
  const baseSpecs = [...BENCHMARK_QUERY_SPECS];

  // Synthesize additional high-quality, realistic queries
  const moreSpecs: RawQuerySpec[] = [
    // CloudOps additional
    { text: "packet loss between us-east and eu-west", expectedTool: "cloudops.get_network_latency", acceptableTools: ["cloudops.get_network_latency"], domain: "cloudops", style: "terse", difficulty: "easy" },
    { text: "rotate cert for api.ourcompany.com", expectedTool: "cloudops.rotate_tls_cert", acceptableTools: ["cloudops.rotate_tls_cert"], domain: "cloudops", style: "terse", difficulty: "easy" },
    { text: "our ssl certificate is expiring tomorrow morning", expectedTool: "cloudops.rotate_tls_cert", acceptableTools: ["cloudops.rotate_tls_cert"], domain: "cloudops", style: "indirect", difficulty: "medium" },
    { text: "take backup of postgres primary before running migrations", expectedTool: "cloudops.trigger_db_snapshot", acceptableTools: ["cloudops.trigger_db_snapshot"], domain: "cloudops", style: "indirect", difficulty: "medium" },
    { text: "evict all workloads from k8s node ip-10-0-12-4", expectedTool: "cloudops.drain_node", acceptableTools: ["cloudops.drain_node"], domain: "cloudops", style: "indirect", difficulty: "medium" },
    { text: "update secret stripe_api_key in prod namespace", expectedTool: "cloudops.update_env_secrets", acceptableTools: ["cloudops.update_env_secrets"], domain: "cloudops", style: "terse", difficulty: "easy" },
    { text: "deploy version v2.14.0 to staging environment", expectedTool: "cloudops.deploy_release", acceptableTools: ["cloudops.deploy_release"], domain: "cloudops", style: "terse", difficulty: "easy" },

    // HR additional
    { text: "how many stock options do i have vested?", expectedTool: "hr.get_compensation_details", acceptableTools: ["hr.get_compensation_details"], domain: "hr", style: "indirect", difficulty: "medium" },
    { text: "verify employment letter for mortgage lender", expectedTool: "hr.verify_employment_status", acceptableTools: ["hr.verify_employment_status"], domain: "hr", style: "indirect", difficulty: "medium" },
    { text: "emergency phone number update for john smith", expectedTool: "hr.update_emergency_contact", acceptableTools: ["hr.update_emergency_contact"], domain: "hr", style: "terse", difficulty: "easy" },
    { text: "mark compliance training completed for new joiner", expectedTool: "hr.track_onboarding_checklist", acceptableTools: ["hr.track_onboarding_checklist"], domain: "hr", style: "indirect", difficulty: "medium" },
    { text: "start onboarding workflow for engineer joining next monday", expectedTool: "hr.initiate_onboarding", acceptableTools: ["hr.initiate_onboarding"], domain: "hr", style: "indirect", difficulty: "medium" },
    { text: "revoke corporate access for employee leaving the company", expectedTool: "hr.initiate_offboarding", acceptableTools: ["hr.initiate_offboarding"], domain: "hr", style: "indirect", difficulty: "medium" },
    { text: "submit annual review rating for emily", expectedTool: "hr.record_performance_review", acceptableTools: ["hr.record_performance_review"], domain: "hr", style: "terse", difficulty: "easy" },

    // Billing additional
    { text: "apply 20% discount coupon SUMMER2026", expectedTool: "billing.apply_coupon_code", acceptableTools: ["billing.apply_coupon_code"], domain: "billing", style: "terse", difficulty: "easy" },
    { text: "customer wants to pause billing for 2 months while travelling", expectedTool: "billing.pause_subscription", acceptableTools: ["billing.pause_subscription"], domain: "billing", style: "indirect", difficulty: "medium" },
    { text: "how much state sales tax did we collect in new york this quarter?", expectedTool: "billing.generate_tax_report", acceptableTools: ["billing.generate_tax_report"], domain: "billing", style: "indirect", difficulty: "medium" },
    { text: "void invoice 1044 because it was sent by mistake", expectedTool: "billing.void_invoice", acceptableTools: ["billing.void_invoice"], domain: "billing", style: "indirect", difficulty: "medium" },
    { text: "send another payment overdue warning to client 901", expectedTool: "billing.send_dunning_reminder", acceptableTools: ["billing.send_dunning_reminder"], domain: "billing", style: "indirect", difficulty: "medium" },
    { text: "charge 50 bucks on stored mastercard", expectedTool: "billing.charge_credit_card", acceptableTools: ["billing.charge_credit_card"], domain: "billing", style: "terse", difficulty: "easy" },
    { text: "what is the client's current billing address for tax purposes?", expectedTool: "billing.update_billing_address", acceptableTools: ["billing.update_billing_address"], domain: "billing", style: "indirect", difficulty: "medium" },

    // CRM additional
    { text: "who is handling the acme enterprise account?", expectedTool: "crm.assign_account_rep", acceptableTools: ["crm.assign_account_rep"], domain: "crm", style: "indirect", difficulty: "medium" },
    { text: "show all communications with customer since january", expectedTool: "crm.get_account_history", acceptableTools: ["crm.get_account_history"], domain: "crm", style: "indirect", difficulty: "medium" },
    { text: "merge the two duplicate records for robert johnson", expectedTool: "crm.merge_duplicate_leads", acceptableTools: ["crm.merge_duplicate_leads"], domain: "crm", style: "indirect", difficulty: "medium" },
    { text: "list all deals currently stuck in proposal review", expectedTool: "crm.list_deals_pipeline", acceptableTools: ["crm.list_deals_pipeline", "crm.fetch_pipeline_opportunities"], domain: "crm", style: "indirect", difficulty: "medium" },
    { text: "list leads assigned to rep 22", expectedTool: "crm.list_leads_by_owner", acceptableTools: ["crm.list_leads_by_owner"], domain: "crm", style: "terse", difficulty: "easy" },

    // Calendar additional
    { text: "invite tom to the architectural review meeting", expectedTool: "calendar.invite_attendees", acceptableTools: ["calendar.invite_attendees"], domain: "calendar", style: "terse", difficulty: "easy" },
    { text: "drop alex from the standup invite list", expectedTool: "calendar.remove_attendee", acceptableTools: ["calendar.remove_attendee"], domain: "calendar", style: "indirect", difficulty: "medium" },
    { text: "add zoom meeting link to the customer presentation", expectedTool: "calendar.attach_meeting_link", acceptableTools: ["calendar.attach_meeting_link"], domain: "calendar", style: "indirect", difficulty: "medium" },
    { text: "set up a recurring 1-on-1 every tuesday at 11am", expectedTool: "calendar.create_recurring_series", acceptableTools: ["calendar.create_recurring_series"], domain: "calendar", style: "indirect", difficulty: "medium" },
    { text: "what timezone does maria work in?", expectedTool: "calendar.get_working_hours", acceptableTools: ["calendar.get_working_hours"], domain: "calendar", style: "indirect", difficulty: "medium" },
    { text: "release conference room 4c since the meeting was cancelled", expectedTool: "calendar.release_conference_room", acceptableTools: ["calendar.release_conference_room"], domain: "calendar", style: "indirect", difficulty: "medium" },
    { text: "accept meeting invite for sprint retro", expectedTool: "calendar.rsvp_event", acceptableTools: ["calendar.rsvp_event"], domain: "calendar", style: "terse", difficulty: "easy" }
  ];

  const combinedSpecs = [...baseSpecs, ...moreSpecs];

  // Deterministically shuffle and split into dev (40%) and test (60%)
  const shuffled = prng.shuffle(combinedSpecs);
  const total = shuffled.length;
  const devCutoff = Math.floor(total * 0.4);

  return shuffled.map((spec, idx) => ({
    id: `query_${String(idx + 1).padStart(3, "0")}`,
    text: spec.text,
    expectedTool: spec.expectedTool,
    acceptableTools: spec.acceptableTools,
    domain: spec.domain,
    style: spec.style,
    difficulty: spec.difficulty,
    split: idx < devCutoff ? "dev" : "test",
    notes: spec.notes
  }));
}

// -------------------------------------------------------------
// 7. COMPLETE DATASET GENERATOR
// -------------------------------------------------------------

export function generateCompleteDataset(seed: number = 42): BenchmarkDataset {
  const prng = new PRNG(seed);
  const tools = buildCompleteToolCorpus();
  const subsets = buildDeterministicSubsets(tools, prng);
  const queries = generateAllBenchmarkQueries(prng);

  const devQueries = queries.filter((q) => q.split === "dev");
  const testQueries = queries.filter((q) => q.split === "test");

  const domainCounts: Record<string, number> = {};
  for (const t of tools) {
    domainCounts[t.domain] = (domainCounts[t.domain] ?? 0) + 1;
  }

  const categoryCounts = {
    seeds: tools.filter((t) => t.isSeed).length,
    synthetic: tools.filter((t) => t.isSynthetic).length,
    nearDuplicates: tools.filter((t) => t.isNearDuplicate).length,
    vagueTools: tools.filter((t) => t.isVague).length
  };

  return {
    seed,
    generatedAt: new Date().toISOString(),
    totalTools: tools.length,
    tools,
    subsets,
    devQueries,
    testQueries,
    domainCounts,
    categoryCounts
  };
}
