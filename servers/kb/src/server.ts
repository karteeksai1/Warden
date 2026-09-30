import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PolicyService } from "./service.js";

export function createKbMcpServer(policyService: PolicyService = new PolicyService()): McpServer {
  const server = new McpServer({
    name: "kb",
    version: "0.1.0"
  });

  server.tool(
    "search_policy",
    "Search e-commerce store policies, return windows, refund rules, and terms of service by topic or keywords.",
    {
      query: z.string().min(1, "query must not be empty")
    },
    async ({ query }) => {
      const results = policyService.searchPolicies(query);

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No policies matched query: "${query}". Please check the terms or contact a support supervisor.`
            }
          ]
        };
      }

      const formattedResults = results
        .map((policy) => {
          return `### ${policy.title} [ID: ${policy.id}]\n**Category:** ${policy.category}\n**Relevance Score:** ${policy.relevance_score}\n\n${policy.content}`;
        })
        .join("\n\n---\n\n");

      return {
        content: [
          {
            type: "text",
            text: formattedResults
          }
        ]
      };
    }
  );

  return server;
}
