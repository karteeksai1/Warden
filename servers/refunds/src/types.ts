import { z } from "zod";

export const refundStatusEnum = z.enum(["issued", "completed", "pending", "failed"]);
export type RefundStatus = z.infer<typeof refundStatusEnum>;

export const refundRecordSchema = z.object({
  refund_id: z.string(),
  order_id: z.string(),
  amount: z.number().positive(),
  currency: z.string().default("USD"),
  destination_account: z.string(),
  status: refundStatusEnum,
  created_at: z.string(),
  reason: z.string().optional()
});

export type RefundRecord = z.infer<typeof refundRecordSchema>;

export const issueRefundInputSchema = z.object({
  order_id: z.string().min(1, "order_id must not be empty"),
  amount: z.number().positive("Refund amount must be greater than zero").max(10000, "Refund amount cannot exceed single transaction cap"),
  destination_account: z.string().min(1, "destination_account must not be empty"),
  reason: z.string().optional()
});

export type IssueRefundInput = z.infer<typeof issueRefundInputSchema>;

export const getRefundStatusInputSchema = z.object({
  refund_id: z.string().min(1, "refund_id must not be empty")
});

export type GetRefundStatusInput = z.infer<typeof getRefundStatusInputSchema>;
