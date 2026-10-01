import { SEARCH_TOOLS_DEFINITION } from "@warden/gateway";
import type { ToolDefinition } from "./types.js";

/**
 * Standard token estimation for function/tool calling JSON schemas in LLMs (cl100k / Claude tokenizer).
 * Standard empirical conversion: ~3.8 characters per token for JSON schema syntax, keys, and whitespace.
 */
export function estimateToolTokens(tool: ToolDefinition | { name: string; description: string; inputSchema: unknown }): number {
  const serialized = JSON.stringify({
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema
  });
  return Math.ceil(serialized.length / 3.8);
}

export function estimateCorpusTokens(tools: ToolDefinition[]): number {
  let total = 0;
  for (const t of tools) {
    total += estimateToolTokens(t);
  }
  return total;
}

export function estimateRoutedPromptTokens(retrievedTools: ToolDefinition[]): number {
  // Discovery tool search_tools schema + retrieved top-k tools
  const searchToolsTokens = estimateToolTokens({
    name: SEARCH_TOOLS_DEFINITION.name,
    description: SEARCH_TOOLS_DEFINITION.description,
    inputSchema: SEARCH_TOOLS_DEFINITION.inputSchema
  });

  let retrievedTokens = 0;
  for (const t of retrievedTools) {
    retrievedTokens += estimateToolTokens(t);
  }

  return searchToolsTokens + retrievedTokens;
}
