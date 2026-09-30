import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { RefundService } from "./service.js";

export function createRefundsMcpServer(refundService: RefundService = new RefundService()): McpServer {
  const server = new McpServer({
    name: "refunds",
    version: "0.1.0"
  });

  server.tool(
    "issue_refund",
    "Issue a customer refund for a specific order and destination account.",
    {
      order_id: z.string().min(1, "order_id must not be empty"),
      amount: z.number().positive("Refund amount must be greater than zero").max(10000, "Refund amount cannot exceed single transaction cap"),
      destination_account: z.string().min(1, "destination_account must not be empty"),
      reason: z.string().optional()
    },
    async ({ order_id, amount, destination_account, reason }) => {
      const record = refundService.issueRefund({
        order_id,
        amount,
        destination_account,
        reason
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(record, null, 2)
          }
        ]
      };
    }
  );

  server.tool(
    "get_refund_status",
    "Retrieve the current processing and settlement status of an issued refund by refund ID.",
    {
      refund_id: z.string().min(1, "refund_id must not be empty")
    },
    async ({ refund_id }) => {
      const record = refundService.getRefundStatus(refund_id);

      if (!record) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Refund record not found with ID: ${refund_id}`
            }
          ]
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(record, null, 2)
          }
        ]
      };
    }
  );

  return server;
}
