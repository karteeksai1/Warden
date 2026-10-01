import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  generateCompleteDataset,
  REAL_SERVER_SEED_TOOLS,
  CRM_SEED_TOOLS,
  CLOUDOPS_SEED_TOOLS,
  HR_SEED_TOOLS,
  BILLING_SEED_TOOLS,
  CALENDAR_SEED_TOOLS
} from "../src/corpus_builder.js";
import { runGenerateCorpus, DEFAULT_SEED } from "../src/generate_corpus.js";
import { runRouterBenchmark } from "../src/router_benchmark.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Warden Corpus Generator & Router Benchmark", () => {
  it("should have 15-20 hand-written seed tools per domain plus 4 real servers' tools", () => {
    // 4 real demo servers (orders, refunds, kb, email)
    expect(REAL_SERVER_SEED_TOOLS.length).toBeGreaterThanOrEqual(7);
    const realDomains = new Set(REAL_SERVER_SEED_TOOLS.map((t) => t.domain));
    expect(realDomains.has("orders")).toBe(true);
    expect(realDomains.has("refunds")).toBe(true);
    expect(realDomains.has("kb")).toBe(true);
    expect(realDomains.has("email")).toBe(true);

    // 5 domains with 15-20 seed tool definitions each
    expect(CRM_SEED_TOOLS.length).toBeGreaterThanOrEqual(15);
    expect(CRM_SEED_TOOLS.length).toBeLessThanOrEqual(20);

    expect(CLOUDOPS_SEED_TOOLS.length).toBeGreaterThanOrEqual(15);
    expect(CLOUDOPS_SEED_TOOLS.length).toBeLessThanOrEqual(20);

    expect(HR_SEED_TOOLS.length).toBeGreaterThanOrEqual(15);
    expect(HR_SEED_TOOLS.length).toBeLessThanOrEqual(20);

    expect(BILLING_SEED_TOOLS.length).toBeGreaterThanOrEqual(15);
    expect(BILLING_SEED_TOOLS.length).toBeLessThanOrEqual(20);

    expect(CALENDAR_SEED_TOOLS.length).toBeGreaterThanOrEqual(15);
    expect(CALENDAR_SEED_TOOLS.length).toBeLessThanOrEqual(20);
  });

  it("should include deliberate near-duplicates and vaguely worded tools as hard cases", () => {
    const dataset = generateCompleteDataset(DEFAULT_SEED);

    expect(dataset.categoryCounts.nearDuplicates).toBeGreaterThanOrEqual(20);
    expect(dataset.categoryCounts.vagueTools).toBeGreaterThanOrEqual(15);

    const nearDup = dataset.tools.find((t) => t.isNearDuplicate);
    expect(nearDup).toBeDefined();
    expect(nearDup?.nearDuplicateOf).toBeDefined();

    const vague = dataset.tools.find((t) => t.isVague);
    expect(vague).toBeDefined();
  });

  it("should generate benchmark queries in a different style without label leakage and split into dev/test", () => {
    const dataset = generateCompleteDataset(DEFAULT_SEED);

    expect(dataset.devQueries.length).toBeGreaterThan(0);
    expect(dataset.testQueries.length).toBeGreaterThan(0);

    const allQueries = [...dataset.devQueries, ...dataset.testQueries];
    const terseQueries = allQueries.filter((q) => q.style === "terse");
    const indirectQueries = allQueries.filter((q) => q.style === "indirect");
    const typoQueries = allQueries.filter((q) => q.style === "typo");

    expect(terseQueries.length).toBeGreaterThan(15);
    expect(indirectQueries.length).toBeGreaterThan(25);
    expect(typoQueries.length).toBeGreaterThan(10);

    // Verify deterministic split
    const devIds = new Set(dataset.devQueries.map((q) => q.id));
    for (const testQ of dataset.testQueries) {
      expect(devIds.has(testQ.id)).toBe(false);
    }
  });

  it("should freeze output deterministically with fixed random seed and write valid JSON files", () => {
    const testDir = path.join(__dirname, "../scratch/test_data");
    const dataset1 = runGenerateCorpus(DEFAULT_SEED, testDir);
    const dataset2 = generateCompleteDataset(DEFAULT_SEED);

    expect(dataset1.totalTools).toBe(dataset2.totalTools);
    expect(dataset1.tools.map((t) => t.id)).toEqual(dataset2.tools.map((t) => t.id));
    expect(dataset1.devQueries.map((q) => q.text)).toEqual(dataset2.devQueries.map((q) => q.text));

    expect(fs.existsSync(path.join(testDir, "corpus.json"))).toBe(true);
    expect(fs.existsSync(path.join(testDir, "corpus_subsets.json"))).toBe(true);
    expect(fs.existsSync(path.join(testDir, "queries_dev.json"))).toBe(true);
    expect(fs.existsSync(path.join(testDir, "queries_test.json"))).toBe(true);
    expect(fs.existsSync(path.join(testDir, "benchmark_dataset.json"))).toBe(true);

    // Clean up scratch dir
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("should benchmark top-1/top-5 accuracy and token reduction at corpus sizes 25, 50, 100, 200 with isolated router latency", async () => {
    const report = await runRouterBenchmark({ split: "test", silent: true });

    expect(report.results.length).toBe(4);
    const sizes = report.results.map((r) => r.corpusSize);
    expect(sizes).toEqual([25, 50, 100, 200]);

    for (const res of report.results) {
      expect(res.top1AccuracyPercent).toBeGreaterThan(35);
      expect(res.top5AccuracyPercent).toBeGreaterThan(60);
      expect(res.tokenReductionPercent).toBeGreaterThan(65);
      expect(res.routerLatencyMs.p50).toBeGreaterThan(0);
      expect(res.routerLatencyMs.p95).toBeGreaterThan(0);

      // Verify router search latency is tracked and distinct from registration
      expect(res.timings.corpusRegistrationMs).toBeGreaterThan(0);
      expect(res.timings.routerSearchTotalMs).toBeGreaterThan(0);
      expect(res.timings.tokenCalculationMs).toBeGreaterThanOrEqual(0);
    }

    // Token reduction should monotonically increase with corpus size
    const reductions = report.results.map((r) => r.tokenReductionPercent);
    for (let i = 1; i < reductions.length; i++) {
      expect(reductions[i]!).toBeGreaterThanOrEqual(reductions[i - 1]!);
    }
  });
});
