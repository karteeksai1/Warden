import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { orderRecordSchema } from "./types.js";
import { z } from "zod";
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const dataFilePath = path.resolve(currentDirectory, "../src/data/orders.json");
const fallbackDataFilePath = path.resolve(currentDirectory, "./data/orders.json");
function loadOrdersData() {
    const targetPath = fs.existsSync(dataFilePath) ? dataFilePath : fallbackDataFilePath;
    const rawData = fs.readFileSync(targetPath, "utf-8");
    const parsed = JSON.parse(rawData);
    return z.array(orderRecordSchema).parse(parsed);
}
export class OrderService {
    orders;
    constructor(initialOrders) {
        const records = initialOrders ?? loadOrdersData();
        this.orders = new Map(records.map((order) => [order.order_id, order]));
    }
    getOrder(orderId) {
        return this.orders.get(orderId);
    }
    listOrders(customerId) {
        return Array.from(this.orders.values()).filter((order) => order.customer_id === customerId);
    }
    getTracking(orderId) {
        return this.orders.get(orderId)?.tracking;
    }
}
//# sourceMappingURL=service.js.map