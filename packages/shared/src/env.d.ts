import { z } from "zod";
export declare const environmentSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "production", "test"]>>;
    PORT: z.ZodDefault<z.ZodNumber>;
    NEON_DATABASE_URL: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    DATABASE_URL: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    REDIS_URL: z.ZodEffects<z.ZodString, string, string>;
    PINECONE_API_KEY: z.ZodString;
    PINECONE_INDEX_NAME: z.ZodString;
}, "strip", z.ZodTypeAny, {
    NODE_ENV: "development" | "production" | "test";
    PORT: number;
    REDIS_URL: string;
    PINECONE_API_KEY: string;
    PINECONE_INDEX_NAME: string;
    NEON_DATABASE_URL?: string | undefined;
    DATABASE_URL?: string | undefined;
}, {
    REDIS_URL: string;
    PINECONE_API_KEY: string;
    PINECONE_INDEX_NAME: string;
    NEON_DATABASE_URL?: string | undefined;
    DATABASE_URL?: string | undefined;
    NODE_ENV?: "development" | "production" | "test" | undefined;
    PORT?: number | undefined;
}>, {
    NODE_ENV: "development" | "production" | "test";
    PORT: number;
    REDIS_URL: string;
    PINECONE_API_KEY: string;
    PINECONE_INDEX_NAME: string;
    NEON_DATABASE_URL?: string | undefined;
    DATABASE_URL?: string | undefined;
}, {
    REDIS_URL: string;
    PINECONE_API_KEY: string;
    PINECONE_INDEX_NAME: string;
    NEON_DATABASE_URL?: string | undefined;
    DATABASE_URL?: string | undefined;
    NODE_ENV?: "development" | "production" | "test" | undefined;
    PORT?: number | undefined;
}>, {
    DATABASE_URL: string;
    NEON_DATABASE_URL: string;
    NODE_ENV: "development" | "production" | "test";
    PORT: number;
    REDIS_URL: string;
    PINECONE_API_KEY: string;
    PINECONE_INDEX_NAME: string;
}, {
    REDIS_URL: string;
    PINECONE_API_KEY: string;
    PINECONE_INDEX_NAME: string;
    NEON_DATABASE_URL?: string | undefined;
    DATABASE_URL?: string | undefined;
    NODE_ENV?: "development" | "production" | "test" | undefined;
    PORT?: number | undefined;
}>;
export type Environment = z.infer<typeof environmentSchema>;
export declare function parseEnvironment(rawEnvironment: Record<string, string | undefined>): Environment;
export declare function safeParseEnvironment(rawEnvironment: Record<string, string | undefined>): z.SafeParseReturnType<{
    REDIS_URL: string;
    PINECONE_API_KEY: string;
    PINECONE_INDEX_NAME: string;
    NEON_DATABASE_URL?: string | undefined;
    DATABASE_URL?: string | undefined;
    NODE_ENV?: "development" | "production" | "test" | undefined;
    PORT?: number | undefined;
}, {
    DATABASE_URL: string;
    NEON_DATABASE_URL: string;
    NODE_ENV: "development" | "production" | "test";
    PORT: number;
    REDIS_URL: string;
    PINECONE_API_KEY: string;
    PINECONE_INDEX_NAME: string;
}>;
//# sourceMappingURL=env.d.ts.map