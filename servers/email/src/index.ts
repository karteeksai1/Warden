import { createEmailApp } from "./app.js";

const port = Number(process.env.EMAIL_PORT || 4004);
const app = createEmailApp();

app.listen(port, () => {
  process.stdout.write(`Email MCP server running on http://localhost:${port}\n`);
});

export * from "./types.js";
export * from "./service.js";
export * from "./server.js";
export * from "./app.js";
