import express, { Request, Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { OrderService } from "./service.js";
import { createOrdersMcpServer } from "./server.js";

export function createOrdersApp(orderService: OrderService = new OrderService()) {
  const app = express();
  const activeTransports = new Map<string, SSEServerTransport>();

  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "healthy",
      server: "orders",
      tools: ["get_order", "list_orders", "get_tracking"]
    });
  });

  app.get("/sse", async (_req: Request, res: Response) => {
    const transport = new SSEServerTransport("/message", res);
    const sessionId = transport.sessionId;
    activeTransports.set(sessionId, transport);

    res.on("close", () => {
      activeTransports.delete(sessionId);
    });

    const mcpServer = createOrdersMcpServer(orderService);
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
