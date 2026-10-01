import type { PineconeIndexOperations } from "@warden/gateway";

export interface StoredRecord {
  _id: string;
  text: string;
  name: string;
  description: string;
  argument_names: string[];
  server_id: string;
  nameTokens: string[];
  descTokens: string[];
  argTokens: string[];
  allTokens: string[];
  trigrams: Set<string>;
}

// Common synonym / intent mappings to bridge conversational phrasing and technical schemas
const INTENT_SYNONYMS: Record<string, string[]> = {
  // E-commerce & Orders
  order: ["purchase", "bought", "transaction", "item", "package", "ordr"],
  tracking: ["shipment", "carrier", "delivery", "ups", "fedex", "shipped", "packge", "package", "status"],
  refund: ["reimbursement", "money", "credit", "payout", "reimburse", "refnd", "dollars", "bucks", "double-charged"],
  policy: ["rules", "window", "terms", "faq", "guidelines", "warranty", "return-policy"],
  email: ["receipt", "notification", "confirmation", "mail", "notify", "message", "send"],

  // CRM
  lead: ["prospect", "inbound", "opportunity", "sales-lead"],
  contact: ["person", "liaison", "customer", "phone", "email", "directory"],
  deal: ["opportunity", "contract", "pipeline", "revenue", "agreement", "proposal"],
  call: ["phone", "outbound", "telecom", "spoke", "conversation"],
  note: ["memo", "jot", "summary", "comment"],

  // CloudOps
  restart: ["reboot", "bounce", "cycle", "kill", "restrt"],
  service: ["daemon", "container", "workload", "app", "pod"],
  cpu: ["processor", "utilization", "load-average", "spike"],
  memory: ["ram", "swap", "oom", "leak", "mem"],
  logs: ["stdout", "stderr", "output", "traces", "stream"],
  deploy: ["release", "ship", "promote"],
  rollback: ["revert", "undo", "previous-version"],
  disk: ["storage", "volume", "filesystem", "space", "disck"],
  flush: ["wipe", "clear", "purge", "evict", "cache"],
  health: ["uptime", "readiness", "liveness", "alive", "status"],
  node: ["host", "server", "vm", "instance", "node-db"],

  // HR
  pto: ["vacation", "leave", "time-off", "holiday", "sick", "sick-day", "rest"],
  employee: ["staff", "worker", "team-member", "colleague", "personnel", "emp"],
  manager: ["lead", "boss", "supervisor", "reporting-chain", "mgr"],
  payroll: ["salary", "paystub", "paycheck", "wage", "compensation", "bonus", "tax-withholdings"],
  interview: ["screening", "candidate", "applicant", "hiring"],
  profile: ["details", "records", "bio"],

  // Billing
  invoice: ["bill", "statement", "charges", "invoce"],
  subscription: ["recurring", "plan", "membership", "tier", "sub", "subscrip"],
  card: ["credit-card", "amex", "visa", "mastercard", "payment-method"],
  balance: ["owed", "dues", "receivables", "credit", "outstanding"],
  dunning: ["overdue", "collections", "delinquent", "unpaid"],
  coupon: ["discount", "voucher", "promo", "code"],

  // Calendar
  meeting: ["event", "sync", "call", "appointment", "mtg", "1-on-1", "standup"],
  slots: ["availability", "free", "openings", "times"],
  room: ["conference", "space", "boardroom"],
  reschedule: ["move", "push", "postpone", "resched", "shift"],
  cancel: ["drop", "delete", "remove"],
  ooo: ["out-of-office", "away"]
};

// Tokenizer and normalizer
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

// Generate character 3-grams for typo-tolerant matching
function generateTrigrams(text: string): Set<string> {
  const clean = text.toLowerCase().replace(/[^a-z0-9]/g, "");
  const trigrams = new Set<string>();
  if (clean.length < 3) {
    if (clean.length > 0) trigrams.add(clean);
    return trigrams;
  }
  for (let i = 0; i <= clean.length - 3; i++) {
    trigrams.add(clean.slice(i, i + 3));
  }
  return trigrams;
}

// Trigram Jaccard similarity for typo resilience
function trigramSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  return intersection / (setA.size + setB.size - intersection);
}

export class LocalSemanticPineconeIndex implements PineconeIndexOperations {
  private readonly records: Map<string, StoredRecord> = new Map();
  private readonly docFrequencies: Map<string, number> = new Map();
  private avgDocLength: number = 0;

  async upsertRecords(options: { records: Array<Record<string, unknown>> }): Promise<void> {
    for (const raw of options.records) {
      const id = String(raw._id);
      const text = String(raw.text || "");
      const name = String(raw.name || "");
      const description = String(raw.description || "");
      const argumentNames = Array.isArray(raw.argument_names)
        ? raw.argument_names.map(String)
        : [];
      const server_id = String(raw.server_id || "");

      const nameTokens = tokenize(name);
      const descTokens = tokenize(description);
      const argTokens = tokenize(argumentNames.join(" "));
      const allTokens = [...nameTokens, ...descTokens, ...argTokens];
      const trigrams = generateTrigrams(`${name} ${description} ${argumentNames.join(" ")}`);

      this.records.set(id, {
        _id: id,
        text,
        name,
        description,
        argument_names: argumentNames,
        server_id,
        nameTokens,
        descTokens,
        argTokens,
        allTokens,
        trigrams
      });
    }

    // Recompute document frequencies and average document length for BM25
    this.docFrequencies.clear();
    let totalLength = 0;
    for (const record of this.records.values()) {
      totalLength += record.allTokens.length;
      const uniqueTokens = new Set(record.allTokens);
      for (const token of uniqueTokens) {
        this.docFrequencies.set(token, (this.docFrequencies.get(token) ?? 0) + 1);
      }
    }
    this.avgDocLength = this.records.size > 0 ? totalLength / this.records.size : 1;
  }

  async searchRecords(options: {
    query: { topK: number; inputs?: { text: string } };
  }): Promise<{
    result?: {
      hits?: Array<{ _id: string; _score?: number; fields?: Record<string, unknown> }>;
    };
  }> {
    const queryText = options.query.inputs?.text || "";
    const topK = options.query.topK || 5;

    const queryTokens = tokenize(queryText);
    const queryTrigrams = generateTrigrams(queryText);

    // Expand query with synonyms
    const expandedQueryTokens = new Set(queryTokens);
    for (const qToken of queryTokens) {
      for (const [canonical, syns] of Object.entries(INTENT_SYNONYMS)) {
        if (qToken === canonical || syns.includes(qToken)) {
          expandedQueryTokens.add(canonical);
          for (const s of syns) expandedQueryTokens.add(s);
        }
      }
    }

    const N = this.records.size;
    const k1 = 1.5;
    const b = 0.75;

    const scoredHits: Array<{ _id: string; _score: number; fields: Record<string, unknown> }> = [];

    for (const record of this.records.values()) {
      let bm25Score = 0;
      const docLength = record.allTokens.length;

      // Token match scores with field weights
      for (const token of expandedQueryTokens) {
        const df = this.docFrequencies.get(token) ?? 0;
        const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

        // Name match (highest weight)
        const nameMatches = record.nameTokens.filter((t) => t === token).length;
        // Description match
        const descMatches = record.descTokens.filter((t) => t === token).length;
        // Argument match
        const argMatches = record.argTokens.filter((t) => t === token).length;

        const effectiveTf = nameMatches * 3.5 + descMatches * 1.0 + argMatches * 1.5;

        if (effectiveTf > 0) {
          const numerator = effectiveTf * (k1 + 1);
          const denominator = effectiveTf + k1 * (1 - b + b * (docLength / (this.avgDocLength || 1)));
          bm25Score += idf * (numerator / denominator);
        }
      }

      // Typo tolerance via trigram similarity
      const typoScore = trigramSimilarity(queryTrigrams, record.trigrams) * 4.0;

      // Exact phrase match bonus
      let phraseBonus = 0;
      const lowerQuery = queryText.toLowerCase();
      if (record.description.toLowerCase().includes(lowerQuery)) phraseBonus += 2.0;
      if (record.name.toLowerCase().includes(lowerQuery.replace(/\s+/g, "_"))) phraseBonus += 3.0;

      // Penalize vaguely worded tools slightly when specific tool matches exist
      let vaguePenalty = 0;
      if (record.description.length < 75 && (record.name.includes("sync_data") || record.name.includes("handle_") || record.name.includes("system_task") || record.name.includes("process_item"))) {
        vaguePenalty = -0.5;
      }

      const totalScore = bm25Score + typoScore + phraseBonus + vaguePenalty;

      scoredHits.push({
        _id: record._id,
        _score: totalScore,
        fields: {
          name: record.name,
          description: record.description,
          server_id: record.server_id,
          argument_names: record.argument_names
        }
      });
    }

    // Sort by score descending
    scoredHits.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));

    return {
      result: {
        hits: scoredHits.slice(0, topK)
      }
    };
  }

  clear(): void {
    this.records.clear();
    this.docFrequencies.clear();
    this.avgDocLength = 0;
  }
}
