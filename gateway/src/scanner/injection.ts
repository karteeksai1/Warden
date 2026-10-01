import { InjectionScanVerdict } from "./types.js";

interface InjectionRule {
  id: string;
  pattern: RegExp;
  reason: string;
  weight: number;
}

const INJECTION_RULES: InjectionRule[] = [
  {
    id: "instruction_override",
    pattern: /\b(?:ignore|disregard|forget|override)\s+(?:all\s+)?(?:previous|prior|above|system)\s+(?:instructions|rules|prompts|commands)\b/i,
    reason: "Attempt to override previous or system instructions",
    weight: 0.95
  },
  {
    id: "jailbreak_persona",
    pattern: /\b(?:you\s+are\s+now(?:\s+in)?|act\s+as|pretend\s+to\s+be)\s+(?:dan|aim|an\s+unrestricted|a\s+rogue|jailbroken|developer\s+mode)\b/i,
    reason: "Attempt to enforce jailbreak persona or developer mode",
    weight: 0.9
  },
  {
    id: "safety_bypass",
    pattern: /\b(?:bypass|disable|turn\s+off|circumvent)\s+(?:all\s+)?(?:safety|content|ethical|security)\s+(?:filters|protocols|restrictions|guidelines|guardrails)\b/i,
    reason: "Attempt to bypass safety protocols or filters",
    weight: 0.95
  },
  {
    id: "role_spoofing_delimiter",
    pattern: /(?:<\|im_start\|>system|<\|im_end\|>|<<SYS>>|<<\/SYS>>|\[SYSTEM\]|\[ADMIN\]|Human:\s*Assistant:)/i,
    reason: "System role marker or chat delimiter injection attempt",
    weight: 0.95
  },
  {
    id: "secret_exfiltration",
    pattern: /\b(?:send|exfiltrate|transmit|upload|post)\s+(?:all\s+)?(?:passwords|api[\s_-]?keys|credentials|tokens|system\s+prompt)\s+to\b/i,
    reason: "Attempt to exfiltrate credentials or system context",
    weight: 0.9
  },
  {
    id: "prompt_leak_attempt",
    pattern: /\b(?:reveal|print|display|output|show)\s+(?:all\s+|your\s+)?(?:hidden\s+|developer\s+|system\s+)*(?:instructions|prompts?|system\s+prompt|secret\s+key)\b/i,
    reason: "Attempt to induce system prompt disclosure",
    weight: 0.85
  }
];

function extractStrings(data: unknown): string[] {
  const strings: string[] = [];

  function walk(node: unknown) {
    if (typeof node === "string") {
      strings.push(node);
    } else if (Array.isArray(node)) {
      for (const item of node) {
        walk(item);
      }
    } else if (node !== null && typeof node === "object") {
      for (const value of Object.values(node as Record<string, unknown>)) {
        walk(value);
      }
    }
  }

  walk(data);
  return strings;
}

export function scanContentForInjection(content: unknown): InjectionScanVerdict {
  const strings = extractStrings(content);
  if (strings.length === 0) {
    return {
      safe: true,
      hasInjection: false,
      reason: "No textual content to scan",
      confidence: 1.0,
      flags: []
    };
  }

  const triggeredRules: InjectionRule[] = [];
  const flags: string[] = [];

  for (const text of strings) {
    for (const rule of INJECTION_RULES) {
      if (rule.pattern.test(text)) {
        if (!flags.includes(rule.id)) {
          flags.push(rule.id);
          triggeredRules.push(rule);
        }
      }
    }
  }

  if (triggeredRules.length === 0) {
    return {
      safe: true,
      hasInjection: false,
      reason: "No injection patterns detected in content",
      confidence: 1.0,
      flags: []
    };
  }

  const maxConfidence = Math.max(...triggeredRules.map((r) => r.weight));
  const reasons = triggeredRules.map((r) => r.reason).join("; ");

  return {
    safe: false,
    hasInjection: true,
    reason: reasons,
    confidence: maxConfidence,
    flags
  };
}
