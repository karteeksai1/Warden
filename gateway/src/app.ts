import express, { Request, Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { AuthService } from "./auth.js";
import { DownstreamManager } from "./downstream.js";
import { createGatewayMcpServer } from "./proxy.js";
import { SemanticToolRouter } from "./router.js";
import { SecurityScanner } from "./scanner.js";
import { TelemetryService, ApprovalStatus, PolicyDecision } from "./telemetry/index.js";

export function createGatewayApp(
  authService: AuthService,
  downstreamManager: DownstreamManager,
  router?: SemanticToolRouter,
  scanner?: SecurityScanner,
  telemetry?: TelemetryService
) {
  const app = express();
  app.use(express.json());
  const activeTransports = new Map<string, SSEServerTransport>();
  const authMiddleware = authService.createMiddleware();
  const telemetryService = telemetry ?? new TelemetryService();

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

  app.get("/sse", authMiddleware, async (req: Request, res: Response) => {
    const transport = new SSEServerTransport("/message", res);
    const sessionId = transport.sessionId;
    activeTransports.set(sessionId, transport);

    res.on("close", () => {
      activeTransports.delete(sessionId);
    });

    const agentId = (req as Request & { agent?: { id: string } }).agent?.id;
    const mcpServer = createGatewayMcpServer(
      downstreamManager,
      router,
      scanner,
      telemetryService,
      { sessionId, agentId }
    );
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

  app.get("/traces", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? Number.parseInt(String(req.query.limit), 10) : undefined;
      const offset = req.query.offset ? Number.parseInt(String(req.query.offset), 10) : undefined;
      const sessionId = req.query.sessionId ? String(req.query.sessionId) : undefined;
      const agentId = req.query.agentId ? String(req.query.agentId) : undefined;
      const toolName = req.query.toolName ? String(req.query.toolName) : undefined;
      const policyDecision = req.query.policyDecision as PolicyDecision | undefined;

      const traces = await telemetryService.listTraces({
        limit,
        offset,
        sessionId,
        agentId,
        toolName,
        policyDecision
      });
      res.json(traces);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/traces/stream", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    res.write(`: stream_open\n\n`);

    const unsubscribe = telemetryService.subscribeToTraces((trace) => {
      res.write(`event: trace\ndata: ${JSON.stringify(trace)}\n\n`);
    });

    req.on("close", () => {
      unsubscribe();
    });
  });

  app.get("/traces/sse", (_req: Request, res: Response) => {
    res.redirect("/traces/stream");
  });

  app.get("/traces/:id", async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const trace = await telemetryService.getTraceById(id);
      if (!trace) {
        res.status(404).json({ error: `Trace not found: ${id}` });
        return;
      }
      res.json(trace);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/approvals", async (req: Request, res: Response) => {
    try {
      const status = req.query.status as ApprovalStatus | undefined;
      const toolName = req.query.toolName ? String(req.query.toolName) : undefined;
      const limit = req.query.limit ? Number.parseInt(String(req.query.limit), 10) : undefined;
      const offset = req.query.offset ? Number.parseInt(String(req.query.offset), 10) : undefined;

      const approvals = await telemetryService.listApprovals({
        status,
        toolName,
        limit,
        offset
      });
      res.json(approvals);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/approvals/:id", async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const approval = await telemetryService.getApprovalById(id);
      if (!approval) {
        res.status(404).json({ error: `Approval not found: ${id}` });
        return;
      }
      res.json(approval);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/approvals/:id/approve", async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const decidedBy = req.body?.decided_by ?? req.body?.decidedBy ?? "admin";
      const updated = await telemetryService.approve(id, String(decidedBy));
      if (!updated) {
        res.status(404).json({ error: `Approval not found: ${id}` });
        return;
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/approvals/:id/deny", async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const decidedBy = req.body?.decided_by ?? req.body?.decidedBy ?? "admin";
      const updated = await telemetryService.deny(id, String(decidedBy));
      if (!updated) {
        res.status(404).json({ error: `Approval not found: ${id}` });
        return;
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/servers", async (_req: Request, res: Response) => {
    try {
      const health = await downstreamManager.checkHealth();
      const allTools = downstreamManager.getAllTools();
      const registered = downstreamManager.getServers();

      const serverList = registered.map((srv) => {
        const srvHealth = health[srv.name];
        const srvTools = allTools.filter((t) => t.serverName === srv.name);
        return {
          name: srv.name,
          transport: srv.transport,
          endpoint: srv.endpoint,
          status: srvHealth?.status ?? srv.status,
          latency_ms: srvHealth?.latencyMs,
          tools_count: srvTools.length,
          tools: srvTools.map((t) => t.namespacedName)
        };
      });

      res.json({
        servers: serverList,
        total_servers: serverList.length,
        total_tools: allTools.length
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/analytics", async (_req: Request, res: Response) => {
    try {
      const summary = await telemetryService.getAnalytics();
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  return app;
}
