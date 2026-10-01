import dotenv from "dotenv";
import { parseEnvironment, createDatabaseClient } from "@warden/shared";
import { AuthService } from "./auth.js";
import { DownstreamManager } from "./downstream.js";
import { createGatewayApp } from "./app.js";

dotenv.config();

export * from "./types.js";
export * from "./auth.js";
export * from "./downstream.js";
export * from "./proxy.js";
export * from "./app.js";
export * from "./router.js";
export * from "./scanner.js";
export * from "./telemetry/index.js";

async function bootstrap() {
  const env = parseEnvironment(process.env);
  const dbClient = createDatabaseClient(env.DATABASE_URL);
  const authService = new AuthService(dbClient);
  const downstreamManager = new DownstreamManager();

  downstreamManager.registerServer({
    name: "orders",
    transport: "http",
    endpoint: process.env.ORDERS_URL || "http://localhost:4001/sse"
  });

  downstreamManager.registerServer({
    name: "refunds",
    transport: "http",
    endpoint: process.env.REFUNDS_URL || "http://localhost:4002/sse"
  });

  downstreamManager.registerServer({
    name: "kb",
    transport: "http",
    endpoint: process.env.KB_URL || "http://localhost:4003/sse"
  });

  downstreamManager.registerServer({
    name: "email",
    transport: "http",
    endpoint: process.env.EMAIL_URL || "http://localhost:4004/sse"
  });

  const app = createGatewayApp(authService, downstreamManager);

  app.listen(env.PORT, () => {
    process.stdout.write(`Warden MCP Gateway running on port ${env.PORT}\n`);
  });
}

if (process.env.NODE_ENV !== "test" && process.argv[1]?.endsWith("index.ts")) {
  bootstrap().catch((error) => {
    process.stderr.write(`Gateway bootstrap error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
