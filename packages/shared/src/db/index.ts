import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

const { Pool } = pg;

export function createDatabaseClient(connectionString: string) {
  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined
  });

  return drizzle(pool, { schema });
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;
export * from "./schema.js";
