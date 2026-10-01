import { DatabaseClient } from "@warden/shared";
import { RouterDatabase } from "../router.js";
import {
  ContentScanVerdict,
  DescriptionScanVerdict,
  InjectionScanVerdict,
  RedactionVerdict,
  SchemaScanVerdict,
  SecurityScannerOptions
} from "./types.js";
import {
  computeToolCanonicalHash,
  resolveSchemaDatabase,
  SchemaScannerDatabase,
  verifyToolSchemaIntegrity
} from "./schema.js";
import { scanDescriptionForPoisoning } from "./poisoning.js";
import { scanContentForInjection } from "./injection.js";
import { redactData } from "./redaction.js";

export * from "./types.js";
export * from "./schema.js";
export * from "./poisoning.js";
export * from "./injection.js";
export * from "./redaction.js";

export class SecurityScanner {
  private readonly database?: SchemaScannerDatabase;
  private readonly options: SecurityScannerOptions;

  constructor(
    database?: SchemaScannerDatabase | RouterDatabase | DatabaseClient,
    options: SecurityScannerOptions = {}
  ) {
    if (database) {
      this.database = resolveSchemaDatabase(database);
    }
    this.options = options;
  }

  async verifyToolSchema(toolId: string, currentSchema: unknown): Promise<SchemaScanVerdict> {
    if (!this.database) {
      const computedHash = computeToolCanonicalHash(currentSchema);
      return {
        safe: true,
        computedHash,
        approvedHash: null,
        quarantined: false,
        reason: "Schema canonicalized without database verification configured",
        confidence: 1.0
      };
    }
    return verifyToolSchemaIntegrity(toolId, currentSchema, this.database);
  }

  async scanToolDescription(
    description: string,
    toolName?: string
  ): Promise<DescriptionScanVerdict> {
    return scanDescriptionForPoisoning(description, {
      llmClassifier: this.options.llmClassifier,
      toolName,
      ambiguityThresholdLow: this.options.ambiguityThresholdLow,
      ambiguityThresholdHigh: this.options.ambiguityThresholdHigh
    });
  }

  scanForInjection(content: unknown): InjectionScanVerdict {
    return scanContentForInjection(content);
  }

  redactSensitiveData(content: unknown): RedactionVerdict {
    return redactData(content);
  }

  scanAndSanitize(content: unknown): ContentScanVerdict {
    const injectionVerdict = this.scanForInjection(content);
    const redactionVerdict = this.redactSensitiveData(content);

    const safe = !injectionVerdict.hasInjection;
    const overallConfidence = injectionVerdict.hasInjection
      ? injectionVerdict.confidence
      : 1.0;

    let overallReason = "Content clean and safe";
    if (injectionVerdict.hasInjection) {
      overallReason = `Prompt injection flagged: ${injectionVerdict.reason}`;
    } else if (redactionVerdict.redactionCount > 0) {
      overallReason = `Clean with ${redactionVerdict.redactionCount} sensitive items redacted`;
    }

    return {
      safe,
      hasInjection: injectionVerdict.hasInjection,
      injectionReason: injectionVerdict.reason,
      injectionConfidence: injectionVerdict.confidence,
      injectionFlags: injectionVerdict.flags,
      redactionCount: redactionVerdict.redactionCount,
      redactionDetails: redactionVerdict.details,
      sanitizedContent: redactionVerdict.redactedContent,
      overallConfidence,
      overallReason
    };
  }

  scanAndSanitizeInput(input: unknown): ContentScanVerdict {
    return this.scanAndSanitize(input);
  }

  scanAndSanitizeOutput(output: unknown): ContentScanVerdict {
    return this.scanAndSanitize(output);
  }
}
