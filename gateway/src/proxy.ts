import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { DownstreamManager } from "./downstream.js";

export function createGatewayMcpServer(downstreamManager: DownstreamManager): Server {
  const server = new Server(
    {
      name: "warden-gateway",
      version: "0.1.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = downstreamManager.getAllTools();
    return {
      tools: tools.map((tool) => ({
        name: tool.namespacedName,
        description: tool.description,
        inputSchema: tool.inputSchema
      }))
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const result = await downstreamManager.callTool(name, (args ?? {}) as Record<string, unknown>);
      return result;
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Gateway error calling tool ${name}: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  });

  return server;
}
