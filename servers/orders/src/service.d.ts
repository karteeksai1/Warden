import { OrderRecord } from "./types.js";
export declare class OrderService {
    private readonly orders;
    constructor(initialOrders?: OrderRecord[]);
    getOrder(orderId: string): OrderRecord | undefined;
    listOrders(customerId: string): OrderRecord[];
    getTracking(orderId: string): OrderRecord["tracking"] | undefined;
}
//# sourceMappingURL=service.d.ts.map