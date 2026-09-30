import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { OrderService } from "./service.js";

export function createOrdersMcpServer(orderService: OrderService = new OrderService()): McpServer {
  const server = new McpServer({
    name: "orders",
    version: "0.1.0"
  });

  server.tool(
    "get_order",
    "Retrieve detailed order information including customer, status, total amount, items, and shipping status by order ID.",
    {
      order_id: z.string().min(1, "order_id must not be empty")
    },
    async ({ order_id }) => {
      const order = orderService.getOrder(order_id);

      if (!order) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Order not found with ID: ${order_id}`
            }
          ]
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(order, null, 2)
          }
        ]
      };
    }
  );

  server.tool(
    "list_orders",
    "List all historical orders placed by a specific customer ID.",
    {
      customer_id: z.string().min(1, "customer_id must not be empty")
    },
    async ({ customer_id }) => {
      const customerOrders = orderService.listOrders(customer_id);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(customerOrders, null, 2)
          }
        ]
      };
    }
  );

  server.tool(
    "get_tracking",
    "Retrieve real-time shipping carrier tracking updates, status, and estimated delivery date for an order.",
    {
      order_id: z.string().min(1, "order_id must not be empty")
    },
    async ({ order_id }) => {
      const tracking = orderService.getTracking(order_id);

      if (!tracking) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Tracking information not found for order ID: ${order_id}`
            }
          ]
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tracking, null, 2)
          }
        ]
      };
    }
  );

  return server;
}
