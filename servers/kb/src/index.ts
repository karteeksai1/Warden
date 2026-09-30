import { createKbApp } from "./app.js";

const port = Number(process.env.KB_PORT || 4003);
const app = createKbApp();

app.listen(port, () => {
  process.stdout.write(`KB MCP server running on http://localhost:${port}\n`);
});

export * from "./types.js";
export * from "./service.js";
export * from "./server.js";
export * from "./app.js";
