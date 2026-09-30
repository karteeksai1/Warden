import { createRefundsApp } from "./app.js";
const port = Number(process.env.REFUNDS_PORT || 4002);
const app = createRefundsApp();
app.listen(port, () => {
    process.stdout.write(`Refunds MCP server running on http://localhost:${port}\n`);
});
export * from "./types.js";
export * from "./service.js";
export * from "./server.js";
export * from "./app.js";
//# sourceMappingURL=index.js.map