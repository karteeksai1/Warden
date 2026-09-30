import crypto from "node:crypto";
import { IssueRefundInput, RefundRecord } from "./types.js";

export class RefundService {
  private readonly refunds: Map<string, RefundRecord> = new Map();

  issueRefund(input: IssueRefundInput): RefundRecord {
    const refundId = `ref_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    const record: RefundRecord = {
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

  getRefundStatus(refundId: string): RefundRecord | undefined {
    return this.refunds.get(refundId);
  }

  listRefunds(): RefundRecord[] {
    return Array.from(this.refunds.values());
  }

  seedRefund(record: RefundRecord): void {
    this.refunds.set(record.refund_id, record);
  }
}
