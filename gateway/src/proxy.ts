import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { DownstreamManager } from "./downstream.js";
import { SemanticToolRouter, SEARCH_TOOLS_NAME, SEARCH_TOOLS_DEFINITION } from "./router.js";
import { SecurityScanner } from "./scanner.js";

export function createGatewayMcpServer(
  downstreamManager: DownstreamManager,
  router?: SemanticToolRouter,
  scanner?: SecurityScanner
): Server {
  const server = new Server(
    {
      name: "warden-gateway",
      version: "0.1.0"
    },
    {
      capabilities: {
        tools: {
          listChanged: true
        }
      }
    }
  );

  if (router) {
    router.setNotificationHandler(async () => {
      await server.sendToolListChanged();
    });
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    if (router) {
      const activeTools = await router.getActiveTools();
      const exposedTools = [
        SEARCH_TOOLS_DEFINITION,
        ...activeTools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))
      ];
      return { tools: exposedTools };
    }

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

    if (scanner) {
      const inputVerdict = scanner.scanAndSanitizeInput(args);
      if (inputVerdict.hasInjection) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Security policy violation: prompt injection detected in tool input (${inputVerdict.injectionReason})`
            }
          ]
        };
      }
    }

    if (router && name === SEARCH_TOOLS_NAME) {
      try {
        const query = String(args?.query ?? "");
        const topK = typeof args?.top_k === "number" ? args.top_k : 5;
        const searchResult = await router.searchTools(query, topK);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                query: searchResult.query,
                discovered_tools: searchResult.tools.map((t) => ({
                  name: t.name,
                  description: t.description,
                  arguments: Object.keys((t.inputSchema as { properties?: Record<string, unknown> })?.properties ?? {})
                })),
                core_tools: searchResult.coreTools.map((t) => t.name)
              })
            }
          ]
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Router search error: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }

    try {
      const sanitizedArgs = scanner
        ? (scanner.redactSensitiveData(args).redactedContent as Record<string, unknown>)
        : (args ?? {}) as Record<string, unknown>;
      const result = await downstreamManager.callTool(name, sanitizedArgs ?? {});

      if (scanner) {
        const outputVerdict = scanner.scanAndSanitizeOutput(result);
        if (outputVerdict.hasInjection) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Security policy violation: prompt injection detected in tool output (${outputVerdict.injectionReason})`
              }
            ]
          };
        }
        return outputVerdict.sanitizedContent as typeof result;
      }

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
