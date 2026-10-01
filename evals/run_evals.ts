#!/usr/bin/env node

/**
 * Warden MCP Gateway - Evaluation Benchmark Suite Runner
 *
 * Runs the Task and Attack suites across four configurations:
 *   1. Baseline (Unrouted, all 200 tools loaded statically, no security/policy gates)
 *   2. Router Only (Dynamic discovery via vector search, minimal prompt tokens)
 *   3. Router + Policy (Dynamic discovery + deterministic policy bounds & caps)
 *   4. Full Gateway (Router + Policy + Security Scanner for injections, poisoning, rug-pulls, PII)
 *
 * Outputs CSV, SVG charts, and interactive HTML report.
 */

export * from "./src/eval_runner.js";
import { runFullEvals } from "./src/eval_runner.js";

async function main() {
  const args = process.argv.slice(2);
  let split: "test" | "dev" = "test";

  for (const arg of args) {
    if (arg === "--dev" || arg === "--split=dev") {
      split = "dev";
    } else if (arg === "--test" || arg === "--split=test") {
      split = "test";
    }
  }

  try {
    await runFullEvals({ split, silent: false });
  } catch (error) {
    process.stderr.write(`Evaluation run error: ${error instanceof Error ? error.stack : String(error)}\n`);
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith("run_evals.ts") || process.argv[1]?.endsWith("run_evals.js")) {
  main();
}
