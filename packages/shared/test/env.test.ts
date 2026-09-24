import { describe, it, expect } from "vitest";
import { parseEnvironment, safeParseEnvironment } from "../src/env.js";

describe("Environment Schema Validation", () => {
  const validBaseConfig = {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/warden",
    REDIS_URL: "redis://localhost:6379",
    PINECONE_API_KEY: "test-pinecone-key",
    PINECONE_INDEX_NAME: "test-index"
  };

  it("should successfully parse valid environment configuration with defaults", () => {
    const result = parseEnvironment(validBaseConfig);

    expect(result.NODE_ENV).toBe("development");
    expect(result.PORT).toBe(3000);
    expect(result.DATABASE_URL).toBe(validBaseConfig.DATABASE_URL);
    expect(result.REDIS_URL).toBe(validBaseConfig.REDIS_URL);
    expect(result.PINECONE_API_KEY).toBe(validBaseConfig.PINECONE_API_KEY);
    expect(result.PINECONE_INDEX_NAME).toBe(validBaseConfig.PINECONE_INDEX_NAME);
  });

  it("should accept valid postgres:// alternative scheme", () => {
    const config = {
      ...validBaseConfig,
      DATABASE_URL: "postgres://user:pass@localhost:5432/warden"
    };

    const result = parseEnvironment(config);
    expect(result.DATABASE_URL).toBe(config.DATABASE_URL);
  });

  it("should accept rediss:// secure redis scheme", () => {
    const config = {
      ...validBaseConfig,
      REDIS_URL: "rediss://default:token@secure-host:6379"
    };

    const result = parseEnvironment(config);
    expect(result.REDIS_URL).toBe(config.REDIS_URL);
  });

  it("should coerce string port to integer", () => {
    const config = {
      ...validBaseConfig,
      PORT: "8080"
    };

    const result = parseEnvironment(config);
    expect(result.PORT).toBe(8080);
  });

  it("should reject invalid port numbers below range", () => {
    const config = {
      ...validBaseConfig,
      PORT: "0"
    };

    const result = safeParseEnvironment(config);
    expect(result.success).toBe(false);
  });

  it("should reject negative port numbers", () => {
    const config = {
      ...validBaseConfig,
      PORT: "-50"
    };

    const result = safeParseEnvironment(config);
    expect(result.success).toBe(false);
  });

  it("should reject port numbers exceeding 65535", () => {
    const config = {
      ...validBaseConfig,
      PORT: "70000"
    };

    const result = safeParseEnvironment(config);
    expect(result.success).toBe(false);
  });

  it("should reject non-numeric port strings", () => {
    const config = {
      ...validBaseConfig,
      PORT: "not-a-number"
    };

    const result = safeParseEnvironment(config);
    expect(result.success).toBe(false);
  });

  it("should reject invalid database url schemes", () => {
    const config = {
      ...validBaseConfig,
      DATABASE_URL: "mysql://user:pass@localhost:3306/db"
    };

    const result = safeParseEnvironment(config);
    expect(result.success).toBe(false);
  });

  it("should reject invalid redis url schemes", () => {
    const config = {
      ...validBaseConfig,
      REDIS_URL: "http://localhost:6379"
    };

    const result = safeParseEnvironment(config);
    expect(result.success).toBe(false);
  });

  it("should reject missing required fields", () => {
    const missingKeys = ["DATABASE_URL", "REDIS_URL", "PINECONE_API_KEY", "PINECONE_INDEX_NAME"] as const;

    for (const key of missingKeys) {
      const config = { ...validBaseConfig };
      delete config[key];

      const result = safeParseEnvironment(config);
      expect(result.success).toBe(false);
    }
  });

  it("should reject empty string values for required fields", () => {
    const config = {
      ...validBaseConfig,
      PINECONE_API_KEY: ""
    };

    const result = safeParseEnvironment(config);
    expect(result.success).toBe(false);
  });
});
