export * from "./src/router_benchmark.js";
import { runRouterBenchmark } from "./src/router_benchmark.js";

if (process.argv[1]?.endsWith("router_benchmark.ts") || process.argv[1]?.endsWith("router_benchmark.js")) {
  runRouterBenchmark().catch((err) => {
    process.stderr.write(`Benchmark error: ${err instanceof Error ? err.stack : String(err)}\n`);
    process.exit(1);
  });
}
