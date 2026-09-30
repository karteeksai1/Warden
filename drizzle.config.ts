import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("NEON_DATABASE_URL or DATABASE_URL must be defined for migrations");
}

export default defineConfig({
  schema: "./packages/shared/src/db/schema.ts",
  out: "./packages/shared/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString
  }
});
