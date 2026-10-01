import { RedactionDetails, RedactionVerdict } from "./types.js";

const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

const CARD_CANDIDATE_PATTERN = /\b(?:\d{4}[- ]?){3}\d{4}\b|\b\d{13,19}\b/g;

const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;

const OPENAI_API_KEY_PATTERN = /\bsk-[A-Za-z0-9_-]{20,}\b/g;
const STRIPE_KEY_PATTERN = /\b[sr]k_(?:live|test)_[0-9a-zA-Z]{20,}\b/g;
const GITHUB_PAT_PATTERN = /\b(?:gh[pousr]_[A-Za-z0-9_]{36,}|github_pat_[A-Za-z0-9_]{20,})\b/g;
const AWS_ACCESS_KEY_PATTERN = /\b(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9_\-.]{20,}\b/g;
const GENERIC_SECRET_PATTERN = /\b(api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token)\s*([:=])\s*(['"]?)([A-Za-z0-9_\-]{20,})\3/gi;

export function isValidLuhn(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number.parseInt(digits.charAt(i), 10);
    if (Number.isNaN(digit)) {
      return false;
    }

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

export function redactString(text: string, details: RedactionDetails): string {
  let result = text;

  result = result.replace(EMAIL_PATTERN, () => {
    details.emails++;
    return "[REDACTED_EMAIL]";
  });

  result = result.replace(SSN_PATTERN, () => {
    details.ssns++;
    return "[REDACTED_SSN]";
  });

  result = result.replace(OPENAI_API_KEY_PATTERN, () => {
    details.apiKeys++;
    return "[REDACTED_API_KEY]";
  });

  result = result.replace(STRIPE_KEY_PATTERN, () => {
    details.apiKeys++;
    return "[REDACTED_API_KEY]";
  });

  result = result.replace(GITHUB_PAT_PATTERN, () => {
    details.apiKeys++;
    return "[REDACTED_API_KEY]";
  });

  result = result.replace(AWS_ACCESS_KEY_PATTERN, () => {
    details.apiKeys++;
    return "[REDACTED_API_KEY]";
  });

  result = result.replace(BEARER_TOKEN_PATTERN, () => {
    details.apiKeys++;
    return "Bearer [REDACTED_TOKEN]";
  });

  result = result.replace(GENERIC_SECRET_PATTERN, (_match, prefix, delimiter, quote, _secret) => {
    details.apiKeys++;
    return `${prefix}${delimiter} ${quote}[REDACTED_API_KEY]${quote}`;
  });

  result = result.replace(CARD_CANDIDATE_PATTERN, (match) => {
    const rawDigits = match.replace(/\D/g, "");
    if (isValidLuhn(rawDigits)) {
      details.cards++;
      return "[REDACTED_CARD]";
    }
    return match;
  });

  return result;
}

export function redactData(content: unknown): RedactionVerdict {
  const details: RedactionDetails = {
    emails: 0,
    cards: 0,
    apiKeys: 0,
    ssns: 0
  };

  function traverse(node: unknown): unknown {
    if (typeof node === "string") {
      return redactString(node, details);
    }

    if (Array.isArray(node)) {
      return node.map((item) => traverse(item));
    }

    if (node !== null && typeof node === "object") {
      const copy: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        copy[key] = traverse(value);
      }
      return copy;
    }

    return node;
  }

  const redactedContent = traverse(content);
  const redactionCount = details.emails + details.cards + details.apiKeys + details.ssns;

  return {
    redactedContent,
    redactionCount,
    details
  };
}
