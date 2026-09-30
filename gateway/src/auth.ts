import crypto from "node:crypto";
import { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { DatabaseClient, agents } from "@warden/shared";
import { AuthenticatedAgent, AuthResult } from "./types.js";

export function hashApiKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

export function extractApiKey(req: Request): string | undefined {
  const headerKey = req.headers["x-api-key"] || req.headers["X-API-KEY"];
  if (typeof headerKey === "string" && headerKey.trim().length > 0) {
    return headerKey.trim();
  }

  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice(7).trim();
    if (bearerToken.length > 0) {
      return bearerToken;
    }
  }

  const queryKey = req.query.apiKey || req.query.api_key;
  if (typeof queryKey === "string" && queryKey.trim().length > 0) {
    return queryKey.trim();
  }

  return undefined;
}

export class AuthService {
  private readonly dbClient?: DatabaseClient;
  private readonly inMemoryAgents: Map<string, AuthenticatedAgent> = new Map();

  constructor(dbClient?: DatabaseClient) {
    this.dbClient = dbClient;
  }

  registerInMemoryAgent(agent: AuthenticatedAgent): void {
    this.inMemoryAgents.set(agent.apiKeyHash, agent);
  }

  async registerAgent(name: string, rawApiKey: string): Promise<AuthenticatedAgent> {
    const keyHash = hashApiKey(rawApiKey);

    if (this.dbClient) {
      const [inserted] = await this.dbClient.insert(agents).values({
        name,
        apiKeyHash: keyHash
      }).returning();

      if (!inserted) {
        throw new Error(`Failed to insert agent ${name}`);
      }

      const agentRecord: AuthenticatedAgent = {
        id: inserted.id,
        name: inserted.name,
        apiKeyHash: inserted.apiKeyHash
      };
      this.inMemoryAgents.set(keyHash, agentRecord);
      return agentRecord;
    }

    const localAgent: AuthenticatedAgent = {
      id: crypto.randomUUID(),
      name,
      apiKeyHash: keyHash
    };
    this.inMemoryAgents.set(keyHash, localAgent);
    return localAgent;
  }

  async authenticate(rawApiKey?: string): Promise<AuthResult> {
    if (!rawApiKey || rawApiKey.trim().length === 0) {
      return { authenticated: false, error: "Missing API key in headers or query parameter" };
    }

    const keyHash = hashApiKey(rawApiKey.trim());
    const memoryCached = this.inMemoryAgents.get(keyHash);
    if (memoryCached) {
      return { authenticated: true, agent: memoryCached };
    }

    if (this.dbClient) {
      try {
        const found = await this.dbClient.select().from(agents).where(eq(agents.apiKeyHash, keyHash)).limit(1);
        if (found && found.length > 0 && found[0]) {
          const agentRecord: AuthenticatedAgent = {
            id: found[0].id,
            name: found[0].name,
            apiKeyHash: found[0].apiKeyHash
          };
          this.inMemoryAgents.set(keyHash, agentRecord);
          return { authenticated: true, agent: agentRecord };
        }
      } catch (error) {
        return {
          authenticated: false,
          error: `Database authentication error: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }

    return { authenticated: false, error: "Invalid API key" };
  }

  createMiddleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const apiKey = extractApiKey(req);
      const authResult = await this.authenticate(apiKey);

      if (!authResult.authenticated) {
        res.status(401).json({
          error: "Unauthorized",
          message: authResult.error
        });
        return;
      }

      (req as Request & { agent?: AuthenticatedAgent }).agent = authResult.agent;
      next();
    };
  }
}
