import { z } from "zod";

export const policyDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  content: z.string(),
  keywords: z.array(z.string())
});

export type PolicyDocument = z.infer<typeof policyDocumentSchema>;

export const searchPolicyInputSchema = z.object({
  query: z.string().min(1, "query must not be empty")
});

export type SearchPolicyInput = z.infer<typeof searchPolicyInputSchema>;

export const policySearchResultSchema = policyDocumentSchema.extend({
  relevance_score: z.number()
});

export type PolicySearchResult = z.infer<typeof policySearchResultSchema>;
