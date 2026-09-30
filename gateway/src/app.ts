import express, { Request, Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { AuthService } from "./auth.js";
import { DownstreamManager } from "./downstream.js";
import { createGatewayMcpServer } from "./proxy.js";

export function createGatewayApp(
  authService: AuthService,
  downstreamManager: DownstreamManager
) {
  const app = express();
  const activeTransports = new Map<string, SSEServerTransport>();
  const authMiddleware = authService.createMiddleware();

  app.get("/health", async (_req: Request, res: Response) => {
    const downstreamHealth = await downstreamManager.checkHealth();
    const tools = downstreamManager.getAllTools();

    res.json({
      status: "healthy",
      gateway: "warden",
      version: "0.1.0",
      tools_count: tools.length,
      downstream: downstreamHealth
    });
  });

  app.get("/sse", authMiddleware, async (_req: Request, res: Response) => {
    const transport = new SSEServerTransport("/message", res);
    const sessionId = transport.sessionId;
    activeTransports.set(sessionId, transport);

    res.on("close", () => {
      activeTransports.delete(sessionId);
    });

    const mcpServer = createGatewayMcpServer(downstreamManager);
    await mcpServer.connect(transport);
  });

  app.post("/message", authMiddleware, async (req: Request, res: Response) => {
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
