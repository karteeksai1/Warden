export function estimateTokens(data: unknown): number {
  if (data === undefined || data === null) {
    return 0;
  }

  if (typeof data === "string") {
    if (data.length === 0) {
      return 0;
    }
    return Math.max(1, Math.ceil(data.length / 3.8));
  }

  if (typeof data === "number" || typeof data === "boolean") {
    return 1;
  }

  try {
    const serialized = JSON.stringify(data);
    if (!serialized || serialized.length === 0) {
      return 0;
    }
    return Math.max(1, Math.ceil(serialized.length / 3.8));
  } catch {
    return 1;
  }
}
