import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OrderRecord, orderRecordSchema } from "./types.js";
import { z } from "zod";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const dataFilePath = path.resolve(currentDirectory, "../src/data/orders.json");
const fallbackDataFilePath = path.resolve(currentDirectory, "./data/orders.json");

function loadOrdersData(): OrderRecord[] {
  const targetPath = fs.existsSync(dataFilePath) ? dataFilePath : fallbackDataFilePath;
  const rawData = fs.readFileSync(targetPath, "utf-8");
  const parsed = JSON.parse(rawData);
  return z.array(orderRecordSchema).parse(parsed);
}

export class OrderService {
  private readonly orders: Map<string, OrderRecord>;

  constructor(initialOrders?: OrderRecord[]) {
    const records = initialOrders ?? loadOrdersData();
    this.orders = new Map(records.map((order) => [order.order_id, order]));
  }

  getOrder(orderId: string): OrderRecord | undefined {
    return this.orders.get(orderId);
  }

  listOrders(customerId: string): OrderRecord[] {
    return Array.from(this.orders.values()).filter(
      (order) => order.customer_id === customerId
    );
  }

  getTracking(orderId: string): OrderRecord["tracking"] | undefined {
    return this.orders.get(orderId)?.tracking;
  }
}
