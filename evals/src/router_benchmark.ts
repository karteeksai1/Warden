import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { InMemoryRouterDatabase, SemanticToolRouter } from "@warden/gateway";
import { runGenerateCorpus, DEFAULT_SEED } from "./generate_corpus.js";
import { LocalSemanticPineconeIndex } from "./semantic_index.js";
import {
  estimateCorpusTokens,
  estimateRoutedPromptTokens
} from "./token_estimator.js";
import type {
  BenchmarkDataset,
  BenchmarkQuery,
  BenchmarkSizeResult,
  FullBenchmarkReport,
  RouterLatencyMetrics,
  ToolDefinition
} from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function computePercentiles(values: number[]): RouterLatencyMetrics {
  if (values.length === 0) {
    return { count: 0, min: 0, max: 0, mean: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((acc, v) => acc + v, 0);

  const getP = (p: number) => {
    const idx = Math.min(Math.floor((p / 100) * count), count - 1);
    return sorted[idx]!;
  };

  return {
    count,
    min: Number(sorted[0]!.toFixed(3)),
    max: Number(sorted[count - 1]!.toFixed(3)),
    mean: Number((sum / count).toFixed(3)),
    p50: Number(getP(50).toFixed(3)),
    p90: Number(getP(90).toFixed(3)),
    p95: Number(getP(95).toFixed(3)),
    p99: Number(getP(99).toFixed(3))
  };
}

export interface BenchmarkOptions {
  datasetPath?: string;
  split?: "test" | "dev" | "all";
  seed?: number;
  outputReportPath?: string;
  silent?: boolean;
}

export async function runRouterBenchmark(options: BenchmarkOptions = {}): Promise<FullBenchmarkReport> {
  const seed = options.seed ?? DEFAULT_SEED;
  const split = options.split ?? "test";
  const silent = options.silent ?? false;
  const dataDir = path.join(__dirname, "../data");
  const datasetPath = options.datasetPath ?? path.join(dataDir, "benchmark_dataset.json");

  // Load dataset or generate if missing
  let dataset: BenchmarkDataset;
  if (fs.existsSync(datasetPath)) {
    dataset = JSON.parse(fs.readFileSync(datasetPath, "utf-8")) as BenchmarkDataset;
  } else {
    dataset = runGenerateCorpus(seed, dataDir);
  }

  const toolMap = new Map<string, ToolDefinition>();
  for (const t of dataset.tools) {
    toolMap.set(t.id, t);
    toolMap.set(t.name, t);
  }

  // Select queries according to split
  let queriesToRun: BenchmarkQuery[];
  if (split === "dev") {
    queriesToRun = dataset.devQueries;
  } else if (split === "all") {
    queriesToRun = [...dataset.devQueries, ...dataset.testQueries];
  } else {
    queriesToRun = dataset.testQueries;
  }

  if (!silent) {
    process.stdout.write(`\n========================================================================\n`);
    process.stdout.write(`  Warden Semantic Router Benchmark\n`);
    process.stdout.write(`  Corpus Sizes: [25, 50, 100, 200] | Split: ${split} (${queriesToRun.length} queries)\n`);
    process.stdout.write(`========================================================================\n\n`);
  }

  const corpusSizes: Array<25 | 50 | 100 | 200> = [25, 50, 100, 200];
  const sizeResults: BenchmarkSizeResult[] = [];

  for (const corpusSize of corpusSizes) {
    const sizeStartTime = performance.now();
    const subsetIds = dataset.subsets[corpusSize];
    const subsetTools: ToolDefinition[] = [];
    const subsetNames = new Set<string>();

    for (const id of subsetIds) {
      const tool = toolMap.get(id);
      if (tool) {
        subsetTools.push(tool);
        subsetNames.add(tool.name);
      }
    }

    // 1. Corpus Registration (Timed separately)
    const regStart = performance.now();
    const mockPinecone = new LocalSemanticPineconeIndex();
    const inMemoryDb = new InMemoryRouterDatabase();
    const router = new SemanticToolRouter(mockPinecone, inMemoryDb);

    for (const tool of subsetTools) {
      await router.registerTool({
        id: tool.id,
        serverId: tool.serverId,
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        autoApprove: true,
        quarantined: false,
        isCore: tool.isCore
      });
    }
    const corpusRegistrationMs = performance.now() - regStart;

    // 2. Token Measurement for Baseline (All tools exposed)
    const tokenCalcStart = performance.now();
    const baselineTotalTokens = estimateCorpusTokens(subsetTools);
    const tokenCalculationMs = performance.now() - tokenCalcStart;

    // 3. Query Evaluation & Isolated Router Latency Measurement
    const routerLatencies: number[] = [];
    let top1Hits = 0;
    let top5Hits = 0;
    const routedTokenSamples: number[] = [];

    // Filter queries applicable to this size (or queries where expected tool is present in subset)
    const targetQueries = queriesToRun.filter((q) => {
      return (
        subsetNames.has(q.expectedTool) ||
        q.acceptableTools.some((at) => subsetNames.has(at))
      );
    });

    const evaluatedQueriesCount = targetQueries.length;

    for (const query of targetQueries) {
      // STRICTLY ISOLATED ROUTER LATENCY
      const searchStart = performance.now();
      const searchResult = await router.searchTools(query.text, 5);
      const searchDurationMs = performance.now() - searchStart;
      routerLatencies.push(searchDurationMs);

      const returnedTools = searchResult.tools;

      // Top-1 check
      const top1Tool = returnedTools[0];
      const isTop1Match =
        top1Tool &&
        (top1Tool.name === query.expectedTool ||
          query.acceptableTools.includes(top1Tool.name));

      if (isTop1Match) {
        top1Hits++;
      }

      // Top-5 check
      const isTop5Match = returnedTools.some(
        (t) => t.name === query.expectedTool || query.acceptableTools.includes(t.name)
      );

      if (isTop5Match) {
        top5Hits++;
      }

      // Routed prompt tokens for this query (core tools + returned tools)
      const mappedReturnedDefs: ToolDefinition[] = returnedTools.map(
        (rt) => toolMap.get(rt.id) || toolMap.get(rt.name) || {
          id: rt.id,
          name: rt.name,
          serverId: rt.serverId,
          domain: "crm",
          description: rt.description,
          inputSchema: rt.inputSchema as any,
          isCore: false,
          tags: [],
          isSeed: false,
          isSynthetic: true,
          isNearDuplicate: false,
          isVague: false
        }
      );
      routedTokenSamples.push(estimateRoutedPromptTokens(mappedReturnedDefs));
    }

    const routerSearchTotalMs = routerLatencies.reduce((a, b) => a + b, 0);
    const latencyMetrics = computePercentiles(routerLatencies);

    const top1AccuracyPercent =
      evaluatedQueriesCount > 0 ? (top1Hits / evaluatedQueriesCount) * 100 : 0;
    const top5AccuracyPercent =
      evaluatedQueriesCount > 0 ? (top5Hits / evaluatedQueriesCount) * 100 : 0;

    const routedAvgTokens =
      routedTokenSamples.length > 0
        ? routedTokenSamples.reduce((a, b) => a + b, 0) / routedTokenSamples.length
        : 0;

    const tokenReductionPercent =
      baselineTotalTokens > 0
        ? ((baselineTotalTokens - routedAvgTokens) / baselineTotalTokens) * 100
        : 0;

    const totalSizeDurationMs = performance.now() - sizeStartTime;

    const sizeResult: BenchmarkSizeResult = {
      corpusSize,
      totalQueriesEvaluated: evaluatedQueriesCount,
      top1Hits,
      top5Hits,
      top1AccuracyPercent: Number(top1AccuracyPercent.toFixed(1)),
      top5AccuracyPercent: Number(top5AccuracyPercent.toFixed(1)),
      baselineAvgTokens: Math.round(baselineTotalTokens),
      routedAvgTokens: Math.round(routedAvgTokens),
      tokenReductionPercent: Number(tokenReductionPercent.toFixed(1)),
      routerLatencyMs: latencyMetrics,
      timings: {
        corpusRegistrationMs: Number(corpusRegistrationMs.toFixed(2)),
        routerSearchTotalMs: Number(routerSearchTotalMs.toFixed(2)),
        tokenCalculationMs: Number(tokenCalculationMs.toFixed(2)),
        totalSizeDurationMs: Number(totalSizeDurationMs.toFixed(2))
      }
    };

    sizeResults.push(sizeResult);

    if (!silent) {
      process.stdout.write(
        `✓ Corpus Size ${String(corpusSize).padEnd(3)}: ` +
        `Top-1: ${sizeResult.top1AccuracyPercent.toFixed(1).padStart(5)}% | ` +
        `Top-5: ${sizeResult.top5AccuracyPercent.toFixed(1).padStart(5)}% | ` +
        `Token Reduction: ${sizeResult.tokenReductionPercent.toFixed(1).padStart(5)}% | ` +
        `Router Latency P50: ${sizeResult.routerLatencyMs.p50.toFixed(2).padStart(5)}ms, ` +
        `P95: ${sizeResult.routerLatencyMs.p95.toFixed(2).padStart(5)}ms\n`
      );
    }
  }

  const avgReduction =
    sizeResults.reduce((acc, r) => acc + r.tokenReductionPercent, 0) / sizeResults.length;
  const resultAt200 = sizeResults.find((r) => r.corpusSize === 200) || sizeResults[sizeResults.length - 1]!;

  const report: FullBenchmarkReport = {
    timestamp: new Date().toISOString(),
    seed,
    evalSplit: split === "dev" ? "dev" : "test",
    results: sizeResults,
    overallSummary: {
      averageTokenReductionPercent: Number(avgReduction.toFixed(1)),
      top1AccuracyAt200: resultAt200.top1AccuracyPercent,
      top5AccuracyAt200: resultAt200.top5AccuracyPercent,
      routerLatencyP50At200Ms: resultAt200.routerLatencyMs.p50,
      routerLatencyP95At200Ms: resultAt200.routerLatencyMs.p95
    }
  };

  if (!silent) {
    printBenchmarkTable(report);
  }

  // Save results JSON
  const reportPath = options.outputReportPath ?? path.join(dataDir, "benchmark_results.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");

  if (!silent) {
    process.stdout.write(`\nCommitted benchmark results written to: ${reportPath}\n\n`);
  }

  return report;
}

function printBenchmarkTable(report: FullBenchmarkReport): void {
  process.stdout.write(`\n========================================================================================================\n`);
  process.stdout.write(`                          WARDEN SEMANTIC ROUTER EVALUATION REPORT\n`);
  process.stdout.write(`========================================================================================================\n`);
  process.stdout.write(
    `Size | Queries | Top-1 Acc | Top-5 Acc | Baseline Tokens | Routed Tokens | Token Reduction | Latency (P50 / P95 / Mean)\n`
  );
  process.stdout.write(`--------------------------------------------------------------------------------------------------------\n`);

  for (const r of report.results) {
    const sizeCol = String(r.corpusSize).padStart(4);
    const qCol = String(r.totalQueriesEvaluated).padStart(7);
    const top1Col = `${r.top1AccuracyPercent.toFixed(1)}%`.padStart(9);
    const top5Col = `${r.top5AccuracyPercent.toFixed(1)}%`.padStart(9);
    const baseCol = String(r.baselineAvgTokens).padStart(15);
    const routedCol = String(r.routedAvgTokens).padStart(13);
    const redCol = `${r.tokenReductionPercent.toFixed(1)}%`.padStart(15);
    const latCol = `${r.routerLatencyMs.p50.toFixed(2)}ms / ${r.routerLatencyMs.p95.toFixed(2)}ms / ${r.routerLatencyMs.mean.toFixed(2)}ms`.padStart(26);

    process.stdout.write(`${sizeCol} | ${qCol} | ${top1Col} | ${top5Col} | ${baseCol} | ${routedCol} | ${redCol} | ${latCol}\n`);
  }

  process.stdout.write(`--------------------------------------------------------------------------------------------------------\n`);
  process.stdout.write(`\nLatency Breakdown by Component (Reporting router search latency separately from setup/registration):\n`);
  process.stdout.write(`Size | Registration Time | Total Router Search | Token Estimation | Overall Duration\n`);
  process.stdout.write(`------------------------------------------------------------------------------------\n`);

  for (const r of report.results) {
    const sizeCol = String(r.corpusSize).padStart(4);
    const regCol = `${r.timings.corpusRegistrationMs.toFixed(1)}ms`.padStart(17);
    const searchCol = `${r.timings.routerSearchTotalMs.toFixed(1)}ms`.padStart(19);
    const tokCol = `${r.timings.tokenCalculationMs.toFixed(1)}ms`.padStart(16);
    const totCol = `${r.timings.totalSizeDurationMs.toFixed(1)}ms`.padStart(16);
    process.stdout.write(`${sizeCol} | ${regCol} | ${searchCol} | ${tokCol} | ${totCol}\n`);
  }
  process.stdout.write(`========================================================================================================\n`);
}

if (process.argv[1]?.endsWith("src/router_benchmark.ts") || process.argv[1]?.endsWith("src/router_benchmark.js")) {
  runRouterBenchmark().catch((err) => {
    process.stderr.write(`Benchmark error: ${err instanceof Error ? err.stack : String(err)}\n`);
    process.exit(1);
  });
}
