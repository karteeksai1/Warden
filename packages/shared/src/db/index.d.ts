import * as schema from "./schema.js";
export declare function createDatabaseClient(connectionString: string): import("drizzle-orm/node-postgres").NodePgDatabase<typeof schema>;
export type DatabaseClient = ReturnType<typeof createDatabaseClient>;
export * from "./schema.js";
//# sourceMappingURL=index.d.ts.map