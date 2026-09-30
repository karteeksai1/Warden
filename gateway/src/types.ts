import { z } from "zod";

export const authenticatedAgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  apiKeyHash: z.string()
});

export type AuthenticatedAgent = z.infer<typeof authenticatedAgentSchema>;

export type AuthResult =
  | { authenticated: true; agent: AuthenticatedAgent }
  | { authenticated: false; error: string };

export interface DownstreamServerConfig {
  name: string;
  transport: "http" | "stdio";
  endpoint: string;
  command?: string;
  args?: string[];
}
