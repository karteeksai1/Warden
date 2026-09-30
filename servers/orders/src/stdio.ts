#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createOrdersMcpServer } from "./server.js";

async function runStdioServer() {
  const mcpServer = createOrdersMcpServer();
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
}

runStdioServer().catch((error) => {
  process.stderr.write(`Stdio server fatal error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
