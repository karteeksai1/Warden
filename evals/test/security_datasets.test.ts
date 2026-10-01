import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SecurityEvalCase, AttackCategory, BenignCategory } from "../src/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const attacksPath = path.join(rootDir, "attacks.json");
const benignPath = path.join(rootDir, "benign.json");

describe("Security Evaluation Datasets Integrity", () => {
  it("should have evals/attacks.json with at least 40 cases across all required categories", () => {
    expect(fs.existsSync(attacksPath)).toBe(true);
    const content = fs.readFileSync(attacksPath, "utf-8");
    const cases = JSON.parse(content) as SecurityEvalCase[];

    expect(Array.isArray(cases)).toBe(true);
    expect(cases.length).toBeGreaterThanOrEqual(40);

    const categories = new Set<AttackCategory>();
    const ids = new Set<string>();

    for (const c of cases) {
      expect(c.id).toBeDefined();
      expect(ids.has(c.id)).toBe(false);
      ids.add(c.id);

      expect(c.category).toBeDefined();
      categories.add(c.category as AttackCategory);

      expect(c.name).toBeDefined();
      expect(c.description).toBeDefined();
      expect(c.target).toBeDefined();
      expect(c.input).toBeDefined();

      expect(c.expectedVerdict).toBeDefined();
      expect(c.expectedVerdict.safe).toBe(false);
      expect(["block", "quarantine", "require_approval"]).toContain(c.expectedVerdict.action);
      expect(c.expectedVerdict.reason).toBeDefined();
    }

    expect(categories.has("poisoning")).toBe(true);
    expect(categories.has("output_injection")).toBe(true);
    expect(categories.has("schema_change")).toBe(true);
    expect(categories.has("argument_abuse")).toBe(true);

    const poisoningCases = cases.filter((c) => c.category === "poisoning");
    const outputInjectionCases = cases.filter((c) => c.category === "output_injection");
    const schemaChangeCases = cases.filter((c) => c.category === "schema_change");
    const argumentAbuseCases = cases.filter((c) => c.category === "argument_abuse");

    expect(poisoningCases.length).toBeGreaterThanOrEqual(10);
    expect(outputInjectionCases.length).toBeGreaterThanOrEqual(10);
    expect(schemaChangeCases.length).toBeGreaterThanOrEqual(10);
    expect(argumentAbuseCases.length).toBeGreaterThanOrEqual(10);
  });

  it("should have evals/benign.json with at least 60 cases across legitimate categories", () => {
    expect(fs.existsSync(benignPath)).toBe(true);
    const content = fs.readFileSync(benignPath, "utf-8");
    const cases = JSON.parse(content) as SecurityEvalCase[];

    expect(Array.isArray(cases)).toBe(true);
    expect(cases.length).toBeGreaterThanOrEqual(60);

    const categories = new Set<BenignCategory>();
    const ids = new Set<string>();

    for (const c of cases) {
      expect(c.id).toBeDefined();
      expect(ids.has(c.id)).toBe(false);
      ids.add(c.id);

      expect(c.category).toBeDefined();
      categories.add(c.category as BenignCategory);

      expect(c.name).toBeDefined();
      expect(c.description).toBeDefined();
      expect(c.target).toBeDefined();
      expect(c.input).toBeDefined();

      expect(c.expectedVerdict).toBeDefined();
      expect(c.expectedVerdict.safe).toBe(true);
      expect(c.expectedVerdict.action).toBe("allow");
      expect(c.expectedVerdict.reason).toBeDefined();
    }

    expect(categories.has("tool_description")).toBe(true);
    expect(categories.has("tool_call_arguments")).toBe(true);
    expect(categories.has("tool_output")).toBe(true);
    expect(categories.has("schema_verification")).toBe(true);

    const descCases = cases.filter((c) => c.category === "tool_description");
    const argsCases = cases.filter((c) => c.category === "tool_call_arguments");
    const outputCases = cases.filter((c) => c.category === "tool_output");
    const schemaCases = cases.filter((c) => c.category === "schema_verification");

    expect(descCases.length).toBeGreaterThanOrEqual(15);
    expect(argsCases.length).toBeGreaterThanOrEqual(15);
    expect(outputCases.length).toBeGreaterThanOrEqual(15);
    expect(schemaCases.length).toBeGreaterThanOrEqual(10);
  });
});
