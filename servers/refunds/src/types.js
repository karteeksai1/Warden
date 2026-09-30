import { z } from "zod";
export const refundStatusEnum = z.enum(["issued", "completed", "pending", "failed"]);
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
export const issueRefundInputSchema = z.object({
    order_id: z.string().min(1, "order_id must not be empty"),
    amount: z.number().positive("Refund amount must be greater than zero").max(10000, "Refund amount cannot exceed single transaction cap"),
    destination_account: z.string().min(1, "destination_account must not be empty"),
    reason: z.string().optional()
});
export const getRefundStatusInputSchema = z.object({
    refund_id: z.string().min(1, "refund_id must not be empty")
});
//# sourceMappingURL=types.js.map