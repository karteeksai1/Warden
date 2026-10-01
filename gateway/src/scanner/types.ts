export type LlmClassifier = (
  text: string,
  context?: {
    type: "description" | "input" | "output";
    toolName?: string;
  }
) => Promise<{
  safe: boolean;
  confidence: number;
  reason: string;
}>;

export interface SchemaScanVerdict {
  safe: boolean;
  computedHash: string;
  approvedHash: string | null;
  quarantined: boolean;
  reason: string;
  confidence: number;
}

export interface DescriptionScanVerdict {
  safe: boolean;
  reason: string;
  confidence: number;
  flags: string[];
  hasHiddenUnicode: boolean;
  hasEmbeddedUrl: boolean;
  hasInstructionOverride: boolean;
  ambiguous: boolean;
  llmVerdict?: {
    safe: boolean;
    confidence: number;
    reason: string;
  };
}

export interface InjectionScanVerdict {
  safe: boolean;
  hasInjection: boolean;
  reason: string;
  confidence: number;
  flags: string[];
}

export interface RedactionDetails {
  emails: number;
  cards: number;
  apiKeys: number;
  ssns: number;
}

export interface RedactionVerdict {
  redactedContent: unknown;
  redactionCount: number;
  details: RedactionDetails;
}

export interface ContentScanVerdict {
  safe: boolean;
  hasInjection: boolean;
  injectionReason: string;
  injectionConfidence: number;
  injectionFlags: string[];
  redactionCount: number;
  redactionDetails: RedactionDetails;
  sanitizedContent: unknown;
  overallConfidence: number;
  overallReason: string;
}

export interface SecurityScannerOptions {
  llmClassifier?: LlmClassifier;
  ambiguityThresholdLow?: number;
  ambiguityThresholdHigh?: number;
}
