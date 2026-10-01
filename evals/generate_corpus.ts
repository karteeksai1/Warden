export * from "./src/generate_corpus.js";
import { runGenerateCorpus } from "./src/generate_corpus.js";

if (process.argv[1]?.endsWith("generate_corpus.ts") || process.argv[1]?.endsWith("generate_corpus.js")) {
  runGenerateCorpus();
}
