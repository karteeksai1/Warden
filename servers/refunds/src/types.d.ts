import { z } from "zod";
export declare const refundStatusEnum: z.ZodEnum<["issued", "completed", "pending", "failed"]>;
export type RefundStatus = z.infer<typeof refundStatusEnum>;
export declare const refundRecordSchema: z.ZodObject<{
    refund_id: z.ZodString;
    order_id: z.ZodString;
    amount: z.ZodNumber;
    currency: z.ZodDefault<z.ZodString>;
    destination_account: z.ZodString;
    status: z.ZodEnum<["issued", "completed", "pending", "failed"]>;
    created_at: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "completed" | "failed" | "issued";
    created_at: string;
    order_id: string;
    destination_account: string;
    currency: string;
    refund_id: string;
    amount: number;
    reason?: string | undefined;
}, {
    status: "pending" | "completed" | "failed" | "issued";
    created_at: string;
    order_id: string;
    destination_account: string;
    refund_id: string;
    amount: number;
    currency?: string | undefined;
    reason?: string | undefined;
}>;
export type RefundRecord = z.infer<typeof refundRecordSchema>;
export declare const issueRefundInputSchema: z.ZodObject<{
    order_id: z.ZodString;
    amount: z.ZodNumber;
    destination_account: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    order_id: string;
    destination_account: string;
    amount: number;
    reason?: string | undefined;
}, {
    order_id: string;
    destination_account: string;
    amount: number;
    reason?: string | undefined;
}>;
export type IssueRefundInput = z.infer<typeof issueRefundInputSchema>;
export declare const getRefundStatusInputSchema: z.ZodObject<{
    refund_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refund_id: string;
}, {
    refund_id: string;
}>;
export type GetRefundStatusInput = z.infer<typeof getRefundStatusInputSchema>;
//# sourceMappingURL=types.d.ts.map