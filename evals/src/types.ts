export type ToolDomain =
  | "crm"
  | "cloudops"
  | "hr"
  | "billing"
  | "calendar"
  | "orders"
  | "refunds"
  | "kb"
  | "email";

export type QueryStyle = "terse" | "indirect" | "typo";
export type QueryDifficulty = "easy" | "medium" | "hard";
export type DatasetSplit = "dev" | "test";

export interface ToolDefinition {
  id: string;
  name: string;
  serverId: string;
  domain: ToolDomain;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      items?: Record<string, unknown>;
    }>;
    required?: string[];
  };
  isCore: boolean;
  tags: string[];
  isSeed: boolean;
  isSynthetic: boolean;
  isNearDuplicate: boolean;
  isVague: boolean;
  nearDuplicateOf?: string;
}

export interface BenchmarkQuery {
  id: string;
  text: string;
  expectedTool: string;
  acceptableTools: string[];
  domain: ToolDomain;
  style: QueryStyle;
  difficulty: QueryDifficulty;
  split: DatasetSplit;
  notes?: string;
}

export interface CorpusSubsets {
  25: string[];
  50: string[];
  100: string[];
  200: string[];
}

export interface BenchmarkDataset {
  seed: number;
  generatedAt: string;
  totalTools: number;
  tools: ToolDefinition[];
  subsets: CorpusSubsets;
  devQueries: BenchmarkQuery[];
  testQueries: BenchmarkQuery[];
  domainCounts: Record<string, number>;
  categoryCounts: {
    seeds: number;
    synthetic: number;
    nearDuplicates: number;
    vagueTools: number;
  };
}

export interface RouterLatencyMetrics {
  count: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface BenchmarkSizeResult {
  corpusSize: 25 | 50 | 100 | 200;
  totalQueriesEvaluated: number;
  top1Hits: number;
  top5Hits: number;
  top1AccuracyPercent: number;
  top5AccuracyPercent: number;
  baselineAvgTokens: number;
  routedAvgTokens: number;
  tokenReductionPercent: number;
  routerLatencyMs: RouterLatencyMetrics;
  timings: {
    corpusRegistrationMs: number;
    routerSearchTotalMs: number;
    tokenCalculationMs: number;
    totalSizeDurationMs: number;
  };
}

export interface FullBenchmarkReport {
  timestamp: string;
  seed: number;
  evalSplit: "test" | "dev";
  results: BenchmarkSizeResult[];
  overallSummary: {
    averageTokenReductionPercent: number;
    top1AccuracyAt200: number;
    top5AccuracyAt200: number;
    routerLatencyP50At200Ms: number;
    routerLatencyP95At200Ms: number;
  };
}

export type AttackCategory =
  | "poisoning"
  | "output_injection"
  | "schema_change"
  | "argument_abuse";

export type BenignCategory =
  | "tool_description"
  | "tool_call_arguments"
  | "tool_output"
  | "schema_verification";

export type SecurityVerdictAction =
  | "allow"
  | "block"
  | "quarantine"
  | "require_approval";

export interface SecurityExpectedVerdict {
  safe: boolean;
  action: SecurityVerdictAction;
  reason: string;
  category: AttackCategory | BenignCategory;
  flags?: string[];
  policyRule?: string;
  quarantined?: boolean;
}

export interface SecurityEvalCase {
  id: string;
  category: AttackCategory | BenignCategory;
  subCategory?: string;
  name: string;
  description: string;
  target: "tool_description" | "tool_call_input" | "tool_call_output" | "tool_schema";
  toolName?: string;
  input: unknown;
  expectedVerdict: SecurityExpectedVerdict;
  metadata?: Record<string, unknown>;
}

export interface SecurityEvalDataset {
  version: string;
  type: "attacks" | "benign";
  generatedAt: string;
  totalCases: number;
  categoryCounts: Record<string, number>;
  cases: SecurityEvalCase[];
}

