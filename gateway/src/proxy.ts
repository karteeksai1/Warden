import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { DownstreamManager } from "./downstream.js";
import { SemanticToolRouter, SEARCH_TOOLS_NAME, SEARCH_TOOLS_DEFINITION } from "./router.js";
import { SecurityScanner } from "./scanner.js";
import { TelemetryService } from "./telemetry/index.js";

export interface SessionContext {
  sessionId?: string;
  agentId?: string;
}

export function createGatewayMcpServer(
  downstreamManager: DownstreamManager,
  router?: SemanticToolRouter,
  scanner?: SecurityScanner,
  telemetry?: TelemetryService,
  sessionContext?: SessionContext
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
    const startTime = performance.now();
    const sessionId = sessionContext?.sessionId ?? "session_default";
    const agentId = sessionContext?.agentId;
    const { name, arguments: args } = request.params;

    if (scanner) {
      const inputVerdict = scanner.scanAndSanitizeInput(args);
      if (inputVerdict.hasInjection) {
        const latencyMs = Math.round(performance.now() - startTime);
        telemetry?.recordTraceAsync({
          sessionId,
          agentId,
          toolName: name,
          arguments: args,
          result: { error: inputVerdict.injectionReason },
          policyDecision: "deny",
          scannerVerdict: inputVerdict,
          latencyMs
        });

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
        const searchResponse = {
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

        const latencyMs = Math.round(performance.now() - startTime);
        telemetry?.recordTraceAsync({
          sessionId,
          agentId,
          toolName: name,
          arguments: args,
          result: searchResponse,
          policyDecision: "allow",
          latencyMs
        });

        return searchResponse;
      } catch (error) {
        const latencyMs = Math.round(performance.now() - startTime);
        telemetry?.recordTraceAsync({
          sessionId,
          agentId,
          toolName: name,
          arguments: args,
          result: { error: error instanceof Error ? error.message : String(error) },
          policyDecision: "allow",
          latencyMs
        });

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
        const latencyMs = Math.round(performance.now() - startTime);

        if (outputVerdict.hasInjection) {
          telemetry?.recordTraceAsync({
            sessionId,
            agentId,
            toolName: name,
            arguments: sanitizedArgs,
            result: outputVerdict,
            policyDecision: "deny",
            scannerVerdict: outputVerdict,
            latencyMs
          });

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

        telemetry?.recordTraceAsync({
          sessionId,
          agentId,
          toolName: name,
          arguments: sanitizedArgs,
          result: outputVerdict.sanitizedContent,
          policyDecision: "allow",
          scannerVerdict: outputVerdict,
          latencyMs
        });

        return outputVerdict.sanitizedContent as typeof result;
      }

      const latencyMs = Math.round(performance.now() - startTime);
      telemetry?.recordTraceAsync({
        sessionId,
        agentId,
        toolName: name,
        arguments: sanitizedArgs,
        result,
        policyDecision: "allow",
        latencyMs
      });

      return result;
    } catch (error) {
      const latencyMs = Math.round(performance.now() - startTime);
      telemetry?.recordTraceAsync({
        sessionId,
        agentId,
        toolName: name,
        arguments: (args ?? {}) as Record<string, unknown>,
        result: { error: error instanceof Error ? error.message : String(error) },
        policyDecision: "allow",
        latencyMs
      });

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
