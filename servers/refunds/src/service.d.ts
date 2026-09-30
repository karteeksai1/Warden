import { IssueRefundInput, RefundRecord } from "./types.js";
export declare class RefundService {
    private readonly refunds;
    issueRefund(input: IssueRefundInput): RefundRecord;
    getRefundStatus(refundId: string): RefundRecord | undefined;
    listRefunds(): RefundRecord[];
    seedRefund(record: RefundRecord): void;
}
//# sourceMappingURL=service.d.ts.map