import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { EmailService } from "./service.js";

export function createEmailMcpServer(emailService: EmailService = new EmailService()): McpServer {
  const server = new McpServer({
    name: "email",
    version: "0.1.0"
  });

  server.tool(
    "send_confirmation",
    "Send a transactional order status or refund confirmation email to a customer.",
    {
      to: z.string().email("to must be a valid email address"),
      subject: z.string().min(1, "subject must not be empty"),
      body: z.string().min(1, "body must not be empty"),
      order_id: z.string().optional()
    },
    async ({ to, subject, body, order_id }) => {
      const record = emailService.sendConfirmation({
        to,
        subject,
        body,
        order_id
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

  return server;
}
