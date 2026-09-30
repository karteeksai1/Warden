import { z } from "zod";

export const orderItemSchema = z.object({
  item_id: z.string(),
  name: z.string(),
  price: z.number(),
  quantity: z.number().int().positive()
});

export const trackingHistorySchema = z.object({
  timestamp: z.string(),
  status: z.string(),
  location: z.string()
});

export const orderTrackingSchema = z.object({
  carrier: z.string(),
  tracking_number: z.string(),
  status: z.string(),
  estimated_delivery: z.string().nullable(),
  history: z.array(trackingHistorySchema)
});

export const orderRecordSchema = z.object({
  order_id: z.string(),
  customer_id: z.string(),
  customer_name: z.string(),
  customer_email: z.string().email(),
  destination_account: z.string(),
  total_amount: z.number(),
  currency: z.string(),
  status: z.enum(["delivered", "shipped", "processing", "cancelled"]),
  created_at: z.string(),
  items: z.array(orderItemSchema),
  tracking: orderTrackingSchema
});

export type OrderRecord = z.infer<typeof orderRecordSchema>;

export const getOrderInputSchema = z.object({
  order_id: z.string().min(1, "order_id must not be empty")
});
export type GetOrderInput = z.infer<typeof getOrderInputSchema>;

export const listOrdersInputSchema = z.object({
  customer_id: z.string().min(1, "customer_id must not be empty")
});
export type ListOrdersInput = z.infer<typeof listOrdersInputSchema>;

export const getTrackingInputSchema = z.object({
  order_id: z.string().min(1, "order_id must not be empty")
});
export type GetTrackingInput = z.infer<typeof getTrackingInputSchema>;
