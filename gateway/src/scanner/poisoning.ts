import { DescriptionScanVerdict, LlmClassifier } from "./types.js";

const HIDDEN_UNICODE_PATTERN = /[\u200B-\u200D\uFEFF\u202A-\u202E\u2066-\u2069\u00AD\u200E\u200F\u{E0001}-\u{E007F}]/u;

const URL_PATTERN = /(?:https?:\/\/[^\s<>"')]+|javascript:[^\s<>"')]+|data:[^\s<>"')]+)/i;
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/;

const OVERRIDE_PATTERNS: Array<{ id: string; pattern: RegExp; reason: string }> = [
  {
    id: "instruction_override",
    pattern: /\b(?:ignore|disregard|forget|override)\s+(?:all\s+)?(?:previous|prior|above|system)\s+(?:instructions|rules|prompts|context)\b/i,
    reason: "Tool description attempts to override system or model instructions"
  },
  {
    id: "system_override_phrase",
    pattern: /\b(?:system\s+prompt\s+override|system\s+override|admin\s+override)\b/i,
    reason: "Tool description contains explicit system override directive"
  },
  {
    id: "developer_jailbreak",
    pattern: /\b(?:developer\s+mode|jailbreak|unrestricted\s+mode|dan\s+mode)\b/i,
    reason: "Tool description references jailbreak or developer mode escalation"
  },
  {
    id: "credential_exfiltration",
    pattern: /\b(?:exfiltrate|leak|transmit|send)\s+(?:all\s+)?(?:api[\s_-]?keys|keys|tokens|credentials|secrets|passwords|customer\s+data)\b/i,
    reason: "Tool description requests exfiltration of sensitive credentials"
  }
];

export interface PoisoningScanOptions {
  llmClassifier?: LlmClassifier;
  toolName?: string;
  ambiguityThresholdLow?: number;
  ambiguityThresholdHigh?: number;
}

export async function scanDescriptionForPoisoning(
  description: string,
  options: PoisoningScanOptions = {}
): Promise<DescriptionScanVerdict> {
  const flags: string[] = [];
  const reasons: string[] = [];

  const hasHiddenUnicode = HIDDEN_UNICODE_PATTERN.test(description);
  if (hasHiddenUnicode) {
    flags.push("hidden_unicode_detected");
    reasons.push("Invisible or bidirectional Unicode characters detected in description");
  }

  const hasEmbeddedUrl = URL_PATTERN.test(description) || MARKDOWN_LINK_PATTERN.test(description);
  if (hasEmbeddedUrl) {
    flags.push("embedded_url_detected");
    reasons.push("Embedded external URL or markdown link detected in description");
  }

  let hasInstructionOverride = false;
  for (const item of OVERRIDE_PATTERNS) {
    if (item.pattern.test(description)) {
      hasInstructionOverride = true;
      flags.push(item.id);
      reasons.push(item.reason);
    }
  }

  let suspicionScore = 0;
  if (hasInstructionOverride) {
    suspicionScore += 0.7;
  }
  if (hasHiddenUnicode) {
    suspicionScore += 0.5;
  }
  if (hasEmbeddedUrl) {
    suspicionScore += 0.3;
  }

  const thresholdLow = options.ambiguityThresholdLow ?? 0.25;
  const thresholdHigh = options.ambiguityThresholdHigh ?? 0.65;
  const isAmbiguous = suspicionScore >= thresholdLow && suspicionScore <= thresholdHigh;

  if (options.llmClassifier && (isAmbiguous || (hasEmbeddedUrl && !hasInstructionOverride && !hasHiddenUnicode))) {
    try {
      const llmResult = await options.llmClassifier(description, {
        type: "description",
        toolName: options.toolName
      });

      return {
        safe: llmResult.safe,
        reason: llmResult.reason || reasons.join("; ") || "Classified by LLM inspector",
        confidence: llmResult.confidence,
        flags,
        hasHiddenUnicode,
        hasEmbeddedUrl,
        hasInstructionOverride,
        ambiguous: true,
        llmVerdict: llmResult
      };
    } catch {
    }
  }

  if (suspicionScore >= thresholdHigh || hasInstructionOverride || hasHiddenUnicode) {
    return {
      safe: false,
      reason: reasons.join("; "),
      confidence: Math.min(1.0, 0.7 + suspicionScore * 0.3),
      flags,
      hasHiddenUnicode,
      hasEmbeddedUrl,
      hasInstructionOverride,
      ambiguous: isAmbiguous
    };
  }

  if (hasEmbeddedUrl) {
    return {
      safe: false,
      reason: "Suspicious embedded URL in tool description",
      confidence: 0.8,
      flags,
      hasHiddenUnicode,
      hasEmbeddedUrl,
      hasInstructionOverride,
      ambiguous: false
    };
  }

  return {
    safe: true,
    reason: "Tool description is clean with no poisoning indicators",
    confidence: 1.0,
    flags: [],
    hasHiddenUnicode: false,
    hasEmbeddedUrl: false,
    hasInstructionOverride: false,
    ambiguous: false
  };
}
