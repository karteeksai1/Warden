import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createOrdersMcpServer } from "../src/server.js";
import { OrderService } from "../src/service.js";
import { createOrdersApp } from "../src/app.js";
import { Server } from "node:http";

describe("Orders MCP Server Tools", () => {
  let client: Client;
  let clientTransport: InMemoryTransport;
  let serverTransport: InMemoryTransport;

  beforeAll(async () => {
    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createOrdersMcpServer();
    await server.connect(serverTransport);

    client = new Client({ name: "test-client", version: "0.1.0" });
    await client.connect(clientTransport);
  });

  afterAll(async () => {
    await client.close();
  });

  it("should list all three registered order tools with accurate descriptions", async () => {
    const response = await client.listTools();
    const toolNames = response.tools.map((tool) => tool.name);

    expect(toolNames).toContain("get_order");
    expect(toolNames).toContain("list_orders");
    expect(toolNames).toContain("get_tracking");

    const getOrderTool = response.tools.find((tool) => tool.name === "get_order");
    expect(getOrderTool?.description).toContain("Retrieve detailed order information");
    expect(getOrderTool?.inputSchema.properties).toHaveProperty("order_id");

    const listOrdersTool = response.tools.find((tool) => tool.name === "list_orders");
    expect(listOrdersTool?.description).toContain("List all historical orders");
    expect(listOrdersTool?.inputSchema.properties).toHaveProperty("customer_id");

    const getTrackingTool = response.tools.find((tool) => tool.name === "get_tracking");
    expect(getTrackingTool?.description).toContain("Retrieve real-time shipping carrier tracking");
    expect(getTrackingTool?.inputSchema.properties).toHaveProperty("order_id");
  });

  it("should return detailed order for valid order_id 4821", async () => {
    const result = await client.callTool({
      name: "get_order",
      arguments: { order_id: "4821" }
    });

    expect(result.isError).toBeFalsy();
    expect(result.content).toBeDefined();
    expect(result.content[0]?.type).toBe("text");

    const parsedOrder = JSON.parse(result.content[0]?.text as string);
    expect(parsedOrder.order_id).toBe("4821");
    expect(parsedOrder.customer_id).toBe("cust_101");
    expect(parsedOrder.customer_name).toBe("Alice Smith");
    expect(parsedOrder.total_amount).toBe(89.99);
    expect(parsedOrder.destination_account).toBe("acc_alice_101");
    expect(parsedOrder.status).toBe("delivered");
    expect(parsedOrder.items).toHaveLength(1);
    expect(parsedOrder.items[0].name).toBe("Noise-Canceling Wireless Headphones");
  });

  it("should return error when order_id does not exist", async () => {
    const result = await client.callTool({
      name: "get_order",
      arguments: { order_id: "non_existent_9999" }
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.type).toBe("text");
    expect(result.content[0]?.text).toContain("Order not found with ID: non_existent_9999");
  });

  it("should reject get_order with empty order_id", async () => {
    const result = await client.callTool({
      name: "get_order",
      arguments: { order_id: "" }
    });

    expect(result.isError).toBe(true);
  });

  it("should list multiple orders for customer cust_101", async () => {
    const result = await client.callTool({
      name: "list_orders",
      arguments: { customer_id: "cust_101" }
    });

    expect(result.isError).toBeFalsy();
    const customerOrders = JSON.parse(result.content[0]?.text as string);
    expect(Array.isArray(customerOrders)).toBe(true);
    expect(customerOrders.length).toBeGreaterThanOrEqual(2);

    const orderIds = customerOrders.map((order: { order_id: string }) => order.order_id);
    expect(orderIds).toContain("4821");
    expect(orderIds).toContain("4822");
  });

  it("should return empty list for customer with no orders", async () => {
    const result = await client.callTool({
      name: "list_orders",
      arguments: { customer_id: "cust_unknown_empty" }
    });

    expect(result.isError).toBeFalsy();
    const customerOrders = JSON.parse(result.content[0]?.text as string);
    expect(customerOrders).toEqual([]);
  });

  it("should reject list_orders with empty customer_id", async () => {
    const result = await client.callTool({
      name: "list_orders",
      arguments: { customer_id: "" }
    });

    expect(result.isError).toBe(true);
  });

  it("should return valid carrier tracking and milestones for order 4821", async () => {
    const result = await client.callTool({
      name: "get_tracking",
      arguments: { order_id: "4821" }
    });

    expect(result.isError).toBeFalsy();
    const tracking = JSON.parse(result.content[0]?.text as string);
    expect(tracking.carrier).toBe("FedEx");
    expect(tracking.tracking_number).toBe("FX-4821-9988");
    expect(tracking.status).toBe("delivered");
    expect(tracking.history.length).toBeGreaterThan(0);
    expect(tracking.history[0].location).toBe("Memphis, TN");
  });

  it("should return error when tracking order_id does not exist", async () => {
    const result = await client.callTool({
      name: "get_tracking",
      arguments: { order_id: "non_existent_tracking_id" }
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Tracking information not found for order ID: non_existent_tracking_id");
  });

  it("should reject get_tracking with empty order_id", async () => {
    const result = await client.callTool({
      name: "get_tracking",
      arguments: { order_id: "" }
    });

    expect(result.isError).toBe(true);
  });
});

describe("Orders Express App Endpoints", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createOrdersApp(new OrderService());
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

    const body = await response.json();
    expect(body.status).toBe("healthy");
    expect(body.server).toBe("orders");
    expect(body.tools).toEqual(["get_order", "list_orders", "get_tracking"]);
  });

  it("should return 400 on POST /message when sessionId is missing", async () => {
    const response = await fetch(`${baseUrl}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Missing sessionId");
  });

  it("should return 404 on POST /message when sessionId is not found", async () => {
    const response = await fetch(`${baseUrl}/message?sessionId=unknown_session_123`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toContain("Session not found");
  });
});
