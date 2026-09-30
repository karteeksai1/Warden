import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { OrderService } from "./service.js";
import { createOrdersMcpServer } from "./server.js";
export function createOrdersApp(orderService = new OrderService()) {
    const app = express();
    const activeTransports = new Map();
    app.get("/health", (_req, res) => {
        res.json({
            status: "healthy",
            server: "orders",
            tools: ["get_order", "list_orders", "get_tracking"]
        });
    });
    app.get("/sse", async (_req, res) => {
        const transport = new SSEServerTransport("/message", res);
        const sessionId = transport.sessionId;
        activeTransports.set(sessionId, transport);
        res.on("close", () => {
            activeTransports.delete(sessionId);
        });
        const mcpServer = createOrdersMcpServer(orderService);
        await mcpServer.connect(transport);
    });
    app.post("/message", async (req, res) => {
        const sessionId = req.query.sessionId;
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
//# sourceMappingURL=app.js.map