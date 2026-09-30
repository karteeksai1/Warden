import express, { Request, Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { RefundService } from "./service.js";
import { createRefundsMcpServer } from "./server.js";

export function createRefundsApp(refundService: RefundService = new RefundService()) {
  const app = express();
  const activeTransports = new Map<string, SSEServerTransport>();

  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "healthy",
      server: "refunds",
      tools: ["issue_refund", "get_refund_status"]
    });
  });

  app.get("/sse", async (_req: Request, res: Response) => {
    const transport = new SSEServerTransport("/message", res);
    const sessionId = transport.sessionId;
    activeTransports.set(sessionId, transport);

    res.on("close", () => {
      activeTransports.delete(sessionId);
    });

    const mcpServer = createRefundsMcpServer(refundService);
    await mcpServer.connect(transport);
  });

  app.post("/message", async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string | undefined;

    if (!sessionId) {
      res.status(400).json({ error: "Missing sessionId query parameter" });
      return;
    }

    const transport = activeTransports.get(sessionId);

    if (!transport) {
      res.status(404).json({ error: `Session not found: ${sessionId}` });
      return;
    }

    await transport.handlePostMessage(req, res);
  });

  return app;
}
