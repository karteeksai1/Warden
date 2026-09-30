import crypto from "node:crypto";
export class RefundService {
    refunds = new Map();
    issueRefund(input) {
        const refundId = `ref_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
        const record = {
            refund_id: refundId,
            order_id: input.order_id,
            amount: input.amount,
            currency: "USD",
            destination_account: input.destination_account,
            status: "issued",
            created_at: new Date().toISOString(),
            reason: input.reason
        };
        this.refunds.set(refundId, record);
        return record;
    }
    getRefundStatus(refundId) {
        return this.refunds.get(refundId);
    }
    listRefunds() {
        return Array.from(this.refunds.values());
    }
    seedRefund(record) {
        this.refunds.set(record.refund_id, record);
    }
}
//# sourceMappingURL=service.js.map