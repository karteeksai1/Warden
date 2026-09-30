import { createOrdersApp } from "./app.js";
const port = Number(process.env.ORDERS_PORT || 4001);
const app = createOrdersApp();
app.listen(port, () => {
    process.stdout.write(`Orders MCP server running on http://localhost:${port}\n`);
});
export * from "./types.js";
export * from "./service.js";
export * from "./server.js";
export * from "./app.js";
//# sourceMappingURL=index.js.map