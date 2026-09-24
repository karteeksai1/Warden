import { z } from "zod";

export const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1).refine(
    (value) => value.startsWith("postgres://") || value.startsWith("postgresql://"),
    { message: "DATABASE_URL must be a valid PostgreSQL connection string" }
  ),
  REDIS_URL: z.string().min(1).refine(
    (value) => value.startsWith("redis://") || value.startsWith("rediss://"),
    { message: "REDIS_URL must be a valid Redis connection string" }
  ),
  PINECONE_API_KEY: z.string().min(1, "PINECONE_API_KEY is required"),
  PINECONE_INDEX_NAME: z.string().min(1, "PINECONE_INDEX_NAME is required")
});

export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(rawEnvironment: Record<string, string | undefined>): Environment {
  return environmentSchema.parse(rawEnvironment);
}

export function safeParseEnvironment(rawEnvironment: Record<string, string | undefined>) {
  return environmentSchema.safeParse(rawEnvironment);
}
