import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { PolicyDocument, PolicySearchResult, policyDocumentSchema } from "./types.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const dataFilePath = path.resolve(currentDirectory, "../src/data/policies.json");
const fallbackDataFilePath = path.resolve(currentDirectory, "./data/policies.json");

function loadPolicies(): PolicyDocument[] {
  const targetPath = fs.existsSync(dataFilePath) ? dataFilePath : fallbackDataFilePath;
  const rawContent = fs.readFileSync(targetPath, "utf-8");
  const parsed = JSON.parse(rawContent);
  return z.array(policyDocumentSchema).parse(parsed);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

export class PolicyService {
  private readonly policies: PolicyDocument[];

  constructor(initialPolicies?: PolicyDocument[]) {
    this.policies = initialPolicies ?? loadPolicies();
  }

  searchPolicies(query: string, maxResults: number = 3): PolicySearchResult[] {
    const queryTokens = tokenize(query);

    if (queryTokens.length === 0) {
      return [];
    }

    const scoredPolicies = this.policies
      .map((policy) => {
        let score = 0;
        const policyKeywords = policy.keywords.map((keyword) => keyword.toLowerCase());
        const policyTitleTokens = tokenize(policy.title);
        const policyContentTokens = tokenize(policy.content);

        for (const token of queryTokens) {
          if (policyKeywords.some((keyword) => keyword.includes(token))) {
            score += 5;
          }
          if (policyTitleTokens.includes(token)) {
            score += 3;
          }
          const contentOccurrences = policyContentTokens.filter((item) => item === token).length;
          score += contentOccurrences;
        }

        return {
          ...policy,
          relevance_score: score
        };
      })
      .filter((result) => result.relevance_score > 0)
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, maxResults);

    return scoredPolicies;
  }

  getPolicyById(id: string): PolicyDocument | undefined {
    return this.policies.find((policy) => policy.id === id);
  }

  getAllPolicies(): PolicyDocument[] {
    return [...this.policies];
  }
}
