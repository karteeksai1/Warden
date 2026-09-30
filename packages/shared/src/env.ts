import { z } from "zod";

const postgresUrlValidation = z.string().min(1).refine(
  (value) => value.startsWith("postgres://") || value.startsWith("postgresql://"),
  { message: "Must be a valid PostgreSQL connection string" }
);

export const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NEON_DATABASE_URL: postgresUrlValidation.optional(),
  DATABASE_URL: postgresUrlValidation.optional(),
  REDIS_URL: z.string().min(1).refine(
    (value) => value.startsWith("redis://") || value.startsWith("rediss://"),
    { message: "REDIS_URL must be a valid Redis connection string" }
  ),
  PINECONE_API_KEY: z.string().min(1, "PINECONE_API_KEY is required"),
  PINECONE_INDEX_NAME: z.string().min(1, "PINECONE_INDEX_NAME is required")
}).superRefine((data, context) => {
  const databaseUrl = data.NEON_DATABASE_URL || data.DATABASE_URL;
  if (!databaseUrl) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["NEON_DATABASE_URL"],
      message: "Either NEON_DATABASE_URL or DATABASE_URL must be provided"
    });
  }
}).transform((data) => {
  const databaseUrl = (data.NEON_DATABASE_URL || data.DATABASE_URL)!;
  return {
    ...data,
    DATABASE_URL: databaseUrl,
    NEON_DATABASE_URL: databaseUrl
  };
});

export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(rawEnvironment: Record<string, string | undefined>): Environment {
  return environmentSchema.parse(rawEnvironment);
}

export function safeParseEnvironment(rawEnvironment: Record<string, string | undefined>) {
  return environmentSchema.safeParse(rawEnvironment);
}
