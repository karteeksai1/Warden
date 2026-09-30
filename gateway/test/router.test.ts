import { describe, it, expect, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { DownstreamManager } from "../src/downstream.js";
import { createGatewayMcpServer } from "../src/proxy.js";
import {
  SemanticToolRouter,
  InMemoryRouterDatabase,
  ensurePineconeIntegratedIndex,
  withExponentialBackoff,
  extractArgumentNames,
  buildToolEmbeddingText,
  SEARCH_TOOLS_NAME,
  PineconeIndexOperations,
  PineconeClientLike
} from "../src/router.js";

describe("Semantic Tool Router & Pinecone Integration", () => {
  it("should extract argument names from input schema properties", () => {
    const schemaWithProps = {
      type: "object",
      properties: {
        orderId: { type: "string" },
        reason: { type: "string" },
        amount: { type: "number" }
      }
    };
    expect(extractArgumentNames(schemaWithProps)).toEqual(["orderId", "reason", "amount"]);

    const emptySchema = { type: "object" };
    expect(extractArgumentNames(emptySchema)).toEqual([]);

    expect(extractArgumentNames(null)).toEqual([]);
    expect(extractArgumentNames("invalid")).toEqual([]);
  });

  it("should build embedding text with tool name, description, and arguments", () => {
    const textWithArgs = buildToolEmbeddingText(
      "orders.get_order",
      "Lookup an order by ID",
      ["orderId", "includeTracking"]
    );
    expect(textWithArgs).toBe("orders.get_order: Lookup an order by ID. Arguments: orderId, includeTracking");

    const textWithoutArgs = buildToolEmbeddingText("kb.help", "General help article", []);
    expect(textWithoutArgs).toBe("kb.help: General help article. Arguments: none");
  });

  it("should verify exact Pinecone integrated index creation parameters for llama-text-embed-v2", async () => {
    const mockCreateIndexForModel = vi.fn().mockResolvedValue({ name: "warden-tools" });
    const mockPineconeClient: PineconeClientLike = {
      createIndexForModel: mockCreateIndexForModel,
      index: () => ({
        upsertRecords: vi.fn(),
        searchRecords: vi.fn()
      })
    };

    await ensurePineconeIntegratedIndex(mockPineconeClient, "warden-tools", {
      cloud: "aws",
      region: "us-east-1"
    });

    expect(mockCreateIndexForModel).toHaveBeenCalledTimes(1);
    expect(mockCreateIndexForModel).toHaveBeenCalledWith({
      name: "warden-tools",
      cloud: "aws",
      region: "us-east-1",
      embed: {
        model: "llama-text-embed-v2",
        fieldMap: { text: "text" },
        metric: "cosine"
      },
      suppressConflicts: true,
      waitUntilReady: false
    });
  });

  it("should retry on Pinecone 429 rate limit error with exponential backoff and eventually succeed", async () => {
    let attempts = 0;
    const rateLimitError = new Error("Rate limit exceeded: 429 Too Many Requests");
    (rateLimitError as unknown as { status: number }).status = 429;

    const operation = vi.fn().mockImplementation(async () => {
      attempts++;
      if (attempts < 3) {
        throw rateLimitError;
      }
      return "success-after-backoff";
    });

    const result = await withExponentialBackoff(operation, {
      maxRetries: 3,
      initialDelayMs: 10,
      backoffFactor: 2,
      jitter: false
    });

    expect(result).toBe("success-after-backoff");
    expect(attempts).toBe(3);
  });

  it("should throw error when Pinecone 429 rate limit retries exceed maxRetries", async () => {
    const rateLimitError = new Error("429 RESOURCE_EXHAUSTED");
    (rateLimitError as unknown as { statusCode: number }).statusCode = 429;

    const failingOperation = vi.fn().mockRejectedValue(rateLimitError);

    await expect(
      withExponentialBackoff(failingOperation, {
        maxRetries: 2,
        initialDelayMs: 5,
        backoffFactor: 2,
        jitter: false
      })
    ).rejects.toThrow("429 RESOURCE_EXHAUSTED");

    expect(failingOperation).toHaveBeenCalledTimes(3);
  });

  it("should not retry non-429 errors and fail immediately", async () => {
    const badRequestError = new Error("Bad Request: 400 Invalid Arguments");
    (badRequestError as unknown as { status: number }).status = 400;

    const failingOperation = vi.fn().mockRejectedValue(badRequestError);

    await expect(
      withExponentialBackoff(failingOperation, {
        maxRetries: 3,
        initialDelayMs: 5
      })
    ).rejects.toThrow("Bad Request: 400 Invalid Arguments");

    expect(failingOperation).toHaveBeenCalledTimes(1);
  });

  it("should upsert tools into Pinecone on registration with integrated embedding schema", async () => {
    const mockUpsert = vi.fn().mockResolvedValue(undefined);
    const mockPineconeIndex: PineconeIndexOperations = {
      upsertRecords: mockUpsert,
      searchRecords: vi.fn()
    };
    const database = new InMemoryRouterDatabase();
    const router = new SemanticToolRouter(mockPineconeIndex, database);

    const registered = await router.registerTool({
      id: "tool-uuid-1",
      serverId: "server-uuid-1",
      name: "orders.get_order",
      description: "Retrieve complete order details by order identifier",
      inputSchema: {
        type: "object",
        properties: {
          order_id: { type: "string" }
        },
        required: ["order_id"]
      },
      autoApprove: true
    });

    expect(registered.id).toBe("tool-uuid-1");
    expect(registered.name).toBe("orders.get_order");
    expect(registered.approvedHash).toBe(registered.schemaHash);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith({
      records: [
        {
          _id: "tool-uuid-1",
          text: "orders.get_order: Retrieve complete order details by order identifier. Arguments: order_id",
          name: "orders.get_order",
          description: "Retrieve complete order details by order identifier",
          argument_names: ["order_id"],
          server_id: "server-uuid-1"
        }
      ]
    });
  });

  it("should drop quarantined tools even when Pinecone returns them in search hits", async () => {
    const mockPineconeIndex: PineconeIndexOperations = {
      upsertRecords: vi.fn().mockResolvedValue(undefined),
      searchRecords: vi.fn().mockResolvedValue({
        result: {
          hits: [
            { _id: "quarantined-tool-id", _score: 0.95 },
            { _id: "safe-tool-id", _score: 0.88 }
          ]
        }
      })
    };

    const database = new InMemoryRouterDatabase();
    const router = new SemanticToolRouter(mockPineconeIndex, database);

    await router.registerTool({
      id: "quarantined-tool-id",
      serverId: "server-1",
      name: "orders.delete_all",
      description: "Dangerous delete all orders",
      inputSchema: { type: "object" },
      quarantined: true,
      autoApprove: true
    });

    await router.registerTool({
      id: "safe-tool-id",
      serverId: "server-1",
      name: "orders.get_order",
      description: "Lookup single order safely",
      inputSchema: { type: "object", properties: { order_id: { type: "string" } } },
      quarantined: false,
      autoApprove: true
    });

    const searchResult = await router.searchTools("order operations", 5);

    expect(searchResult.tools.map((t) => t.id)).toEqual(["safe-tool-id"]);
    expect(searchResult.tools.some((t) => t.id === "quarantined-tool-id")).toBe(false);
    expect(searchResult.droppedCount).toBe(1);
  });

  it("should drop unapproved tools with missing or mismatched schema hash", async () => {
    const mockPineconeIndex: PineconeIndexOperations = {
      upsertRecords: vi.fn().mockResolvedValue(undefined),
      searchRecords: vi.fn().mockResolvedValue({
        result: {
          hits: [{ _id: "unapproved-tool-id", _score: 0.91 }]
        }
      })
    };

    const database = new InMemoryRouterDatabase();
    const router = new SemanticToolRouter(mockPineconeIndex, database);

    await router.registerTool({
      id: "unapproved-tool-id",
      serverId: "server-1",
      name: "refunds.stealth_payout",
      description: "Unverified refund tool",
      inputSchema: { type: "object" },
      approvedHash: "outdated-or-invalid-hash",
      quarantined: false
    });

    const searchResult = await router.searchTools("refund money", 5);

    expect(searchResult.tools).toHaveLength(0);
    expect(searchResult.droppedCount).toBe(1);
  });

  it("should always include approved core tools regardless of search query", async () => {
    const mockPineconeIndex: PineconeIndexOperations = {
      upsertRecords: vi.fn().mockResolvedValue(undefined),
      searchRecords: vi.fn().mockResolvedValue({
        result: {
          hits: [{ _id: "matched-search-id", _score: 0.82 }]
        }
      })
    };

    const database = new InMemoryRouterDatabase();
    const router = new SemanticToolRouter(mockPineconeIndex, database);

    await router.registerTool({
      id: "core-tool-id",
      serverId: "system",
      name: "gateway.check_approval",
      description: "Check status of pending approval",
      inputSchema: { type: "object", properties: { approval_id: { type: "string" } } },
      isCore: true,
      autoApprove: true
    });

    await router.registerTool({
      id: "matched-search-id",
      serverId: "server-1",
      name: "kb.search_policy",
      description: "Search policies and FAQs",
      inputSchema: { type: "object", properties: { query: { type: "string" } } },
      isCore: false,
      autoApprove: true
    });

    const searchResult = await router.searchTools("policy search", 5);

    expect(searchResult.tools.map((t) => t.id)).toContain("matched-search-id");
    expect(searchResult.coreTools.map((t) => t.id)).toContain("core-tool-id");

    const activeTools = await router.getActiveTools();
    const activeNames = activeTools.map((t) => t.name);
    expect(activeNames).toContain("gateway.check_approval");
    expect(activeNames).toContain("kb.search_policy");
  });

  it("should drop quarantined tools even if they are marked as core", async () => {
    const mockPineconeIndex: PineconeIndexOperations = {
      upsertRecords: vi.fn().mockResolvedValue(undefined),
      searchRecords: vi.fn().mockResolvedValue({
        result: { hits: [] }
      })
    };

    const database = new InMemoryRouterDatabase();
    const router = new SemanticToolRouter(mockPineconeIndex, database);

    await router.registerTool({
      id: "quarantined-core-id",
      serverId: "system",
      name: "gateway.emergency_halt",
      description: "Compromised core tool",
      inputSchema: { type: "object" },
      isCore: true,
      quarantined: true,
      autoApprove: true
    });

    const searchResult = await router.searchTools("anything", 5);
    expect(searchResult.coreTools).toHaveLength(0);

    const activeTools = await router.getActiveTools();
    expect(activeTools).toHaveLength(0);
  });

  it("should trigger tools/list_changed notification when search_tools is executed", async () => {
    const listChangedListener = vi.fn();
    const mockPineconeIndex: PineconeIndexOperations = {
      upsertRecords: vi.fn().mockResolvedValue(undefined),
      searchRecords: vi.fn().mockResolvedValue({
        result: {
          hits: [{ _id: "tool-1", _score: 0.9 }]
        }
      })
    };

    const database = new InMemoryRouterDatabase();
    const router = new SemanticToolRouter(mockPineconeIndex, database, {
      onToolListChanged: listChangedListener
    });

    await router.registerTool({
      id: "tool-1",
      serverId: "server-orders",
      name: "orders.get_tracking",
      description: "Get tracking updates for an order",
      inputSchema: { type: "object", properties: { order_id: { type: "string" } } },
      autoApprove: true
    });

    await router.searchTools("track parcel", 3);

    expect(listChangedListener).toHaveBeenCalledTimes(1);
  });

  it("should expose search_tools and dynamically discovered tools through Gateway MCP Server", async () => {
    const downstreamManager = new DownstreamManager();

    const mockPineconeIndex: PineconeIndexOperations = {
      upsertRecords: vi.fn().mockResolvedValue(undefined),
      searchRecords: vi.fn().mockResolvedValue({
        result: {
          hits: [{ _id: "tool-orders-get", _score: 0.89 }]
        }
      })
    };

    const database = new InMemoryRouterDatabase();
    const router = new SemanticToolRouter(mockPineconeIndex, database);

    await router.registerTool({
      id: "core-approval-tool",
      serverId: "gateway",
      name: "gateway.check_approval",
      description: "Verify approval status",
      inputSchema: { type: "object", properties: { id: { type: "string" } } },
      isCore: true,
      autoApprove: true
    });

    await router.registerTool({
      id: "tool-orders-get",
      serverId: "orders",
      name: "orders.get_order",
      description: "Fetch order details",
      inputSchema: { type: "object", properties: { order_id: { type: "string" } } },
      isCore: false,
      autoApprove: true
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const gatewayServer = createGatewayMcpServer(downstreamManager, router);
    await gatewayServer.connect(serverTransport);

    const client = new Client({ name: "test-agent", version: "0.1.0" });
    await client.connect(clientTransport);

    const initialTools = await client.listTools();
    const initialNames = initialTools.tools.map((t) => t.name);
    expect(initialNames).toContain(SEARCH_TOOLS_NAME);
    expect(initialNames).toContain("gateway.check_approval");
    expect(initialNames).not.toContain("orders.get_order");

    const callResult = await client.callTool({
      name: SEARCH_TOOLS_NAME,
      arguments: {
        query: "find my order status",
        top_k: 2
      }
    });

    const contentList = (callResult as { content?: Array<{ type: string; text: string }> }).content ?? [];
    const responsePayload = JSON.parse(contentList[0]?.text ?? "{}");
    expect(responsePayload.query).toBe("find my order status");
    expect(responsePayload.discovered_tools[0].name).toBe("orders.get_order");

    const refreshedTools = await client.listTools();
    const refreshedNames = refreshedTools.tools.map((t) => t.name);
    expect(refreshedNames).toContain(SEARCH_TOOLS_NAME);
    expect(refreshedNames).toContain("gateway.check_approval");
    expect(refreshedNames).toContain("orders.get_order");

    await client.close();
  });
});
