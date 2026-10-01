import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateCompleteDataset } from "./corpus_builder.js";
import type { BenchmarkDataset } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_SEED = 42;

export function runGenerateCorpus(
  seed: number = DEFAULT_SEED,
  outputDir: string = path.join(__dirname, "../data")
): BenchmarkDataset {
  process.stdout.write(`\n=======================================================\n`);
  process.stdout.write(`  Warden Corpus & Benchmark Query Generator\n`);
  process.stdout.write(`  Fixed Seed: ${seed}\n`);
  process.stdout.write(`=======================================================\n\n`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const dataset = generateCompleteDataset(seed);

  // 1. Write individual frozen JSON files
  const corpusPath = path.join(outputDir, "corpus.json");
  fs.writeFileSync(corpusPath, JSON.stringify(dataset.tools, null, 2), "utf-8");

  const subsetsPath = path.join(outputDir, "corpus_subsets.json");
  fs.writeFileSync(subsetsPath, JSON.stringify(dataset.subsets, null, 2), "utf-8");

  const devQueriesPath = path.join(outputDir, "queries_dev.json");
  fs.writeFileSync(devQueriesPath, JSON.stringify(dataset.devQueries, null, 2), "utf-8");

  const testQueriesPath = path.join(outputDir, "queries_test.json");
  fs.writeFileSync(testQueriesPath, JSON.stringify(dataset.testQueries, null, 2), "utf-8");

  // 2. Write unified frozen dataset bundle
  const bundlePath = path.join(outputDir, "benchmark_dataset.json");
  fs.writeFileSync(bundlePath, JSON.stringify(dataset, null, 2), "utf-8");

  process.stdout.write(`Total Tools Generated: ${dataset.totalTools}\n`);
  process.stdout.write(`- Hand-written Seeds:  ${dataset.categoryCounts.seeds}\n`);
  process.stdout.write(`- Synthetic Tools:     ${dataset.categoryCounts.synthetic}\n`);
  process.stdout.write(`  ├─ Near-Duplicates:  ${dataset.categoryCounts.nearDuplicates} (deliberate hard cases)\n`);
  process.stdout.write(`  └─ Vaguely Worded:   ${dataset.categoryCounts.vagueTools} (ambiguous hard cases)\n\n`);

  process.stdout.write(`Domain Distribution:\n`);
  for (const [domain, count] of Object.entries(dataset.domainCounts)) {
    process.stdout.write(`  ${domain.padEnd(12)}: ${count} tools\n`);
  }

  process.stdout.write(`\nCorpus Subsets:\n`);
  for (const size of [25, 50, 100, 200] as const) {
    process.stdout.write(`  Subset size ${String(size).padEnd(3)}: ${dataset.subsets[size].length} tools\n`);
  }

  process.stdout.write(`\nBenchmark Queries (Pass 2 - Separate Pipeline, No Label Leakage):\n`);
  process.stdout.write(`  Total Queries:     ${dataset.devQueries.length + dataset.testQueries.length}\n`);
  process.stdout.write(`  - Dev Split (40%):  ${dataset.devQueries.length} queries\n`);
  process.stdout.write(`  - Test Split (60%): ${dataset.testQueries.length} queries\n`);

  const styles = { terse: 0, indirect: 0, typo: 0 };
  for (const q of [...dataset.devQueries, ...dataset.testQueries]) {
    styles[q.style] = (styles[q.style] || 0) + 1;
  }
  process.stdout.write(`  - Terse style:      ${styles.terse}\n`);
  process.stdout.write(`  - Indirect style:   ${styles.indirect}\n`);
  process.stdout.write(`  - Typos/Slang:      ${styles.typo}\n\n`);

  process.stdout.write(`Committed JSON artifacts written to:\n`);
  process.stdout.write(`  - ${corpusPath}\n`);
  process.stdout.write(`  - ${subsetsPath}\n`);
  process.stdout.write(`  - ${devQueriesPath}\n`);
  process.stdout.write(`  - ${testQueriesPath}\n`);
  process.stdout.write(`  - ${bundlePath}\n\n`);

  return dataset;
}

if (process.argv[1]?.endsWith("src/generate_corpus.ts") || process.argv[1]?.endsWith("src/generate_corpus.js")) {
  runGenerateCorpus();
}
