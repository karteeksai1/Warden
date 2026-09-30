import { z } from "zod";
export declare const orderItemSchema: z.ZodObject<{
    item_id: z.ZodString;
    name: z.ZodString;
    price: z.ZodNumber;
    quantity: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    item_id: string;
    price: number;
    quantity: number;
}, {
    name: string;
    item_id: string;
    price: number;
    quantity: number;
}>;
export declare const trackingHistorySchema: z.ZodObject<{
    timestamp: z.ZodString;
    status: z.ZodString;
    location: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: string;
    timestamp: string;
    location: string;
}, {
    status: string;
    timestamp: string;
    location: string;
}>;
export declare const orderTrackingSchema: z.ZodObject<{
    carrier: z.ZodString;
    tracking_number: z.ZodString;
    status: z.ZodString;
    estimated_delivery: z.ZodNullable<z.ZodString>;
    history: z.ZodArray<z.ZodObject<{
        timestamp: z.ZodString;
        status: z.ZodString;
        location: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: string;
        timestamp: string;
        location: string;
    }, {
        status: string;
        timestamp: string;
        location: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    status: string;
    carrier: string;
    tracking_number: string;
    estimated_delivery: string | null;
    history: {
        status: string;
        timestamp: string;
        location: string;
    }[];
}, {
    status: string;
    carrier: string;
    tracking_number: string;
    estimated_delivery: string | null;
    history: {
        status: string;
        timestamp: string;
        location: string;
    }[];
}>;
export declare const orderRecordSchema: z.ZodObject<{
    order_id: z.ZodString;
    customer_id: z.ZodString;
    customer_name: z.ZodString;
    customer_email: z.ZodString;
    destination_account: z.ZodString;
    total_amount: z.ZodNumber;
    currency: z.ZodString;
    status: z.ZodEnum<["delivered", "shipped", "processing", "cancelled"]>;
    created_at: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        item_id: z.ZodString;
        name: z.ZodString;
        price: z.ZodNumber;
        quantity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        item_id: string;
        price: number;
        quantity: number;
    }, {
        name: string;
        item_id: string;
        price: number;
        quantity: number;
    }>, "many">;
    tracking: z.ZodObject<{
        carrier: z.ZodString;
        tracking_number: z.ZodString;
        status: z.ZodString;
        estimated_delivery: z.ZodNullable<z.ZodString>;
        history: z.ZodArray<z.ZodObject<{
            timestamp: z.ZodString;
            status: z.ZodString;
            location: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            status: string;
            timestamp: string;
            location: string;
        }, {
            status: string;
            timestamp: string;
            location: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        status: string;
        carrier: string;
        tracking_number: string;
        estimated_delivery: string | null;
        history: {
            status: string;
            timestamp: string;
            location: string;
        }[];
    }, {
        status: string;
        carrier: string;
        tracking_number: string;
        estimated_delivery: string | null;
        history: {
            status: string;
            timestamp: string;
            location: string;
        }[];
    }>;
}, "strip", z.ZodTypeAny, {
    status: "delivered" | "shipped" | "processing" | "cancelled";
    created_at: string;
    order_id: string;
    customer_id: string;
    customer_name: string;
    customer_email: string;
    destination_account: string;
    total_amount: number;
    currency: string;
    items: {
        name: string;
        item_id: string;
        price: number;
        quantity: number;
    }[];
    tracking: {
        status: string;
        carrier: string;
        tracking_number: string;
        estimated_delivery: string | null;
        history: {
            status: string;
            timestamp: string;
            location: string;
        }[];
    };
}, {
    status: "delivered" | "shipped" | "processing" | "cancelled";
    created_at: string;
    order_id: string;
    customer_id: string;
    customer_name: string;
    customer_email: string;
    destination_account: string;
    total_amount: number;
    currency: string;
    items: {
        name: string;
        item_id: string;
        price: number;
        quantity: number;
    }[];
    tracking: {
        status: string;
        carrier: string;
        tracking_number: string;
        estimated_delivery: string | null;
        history: {
            status: string;
            timestamp: string;
            location: string;
        }[];
    };
}>;
export type OrderRecord = z.infer<typeof orderRecordSchema>;
export declare const getOrderInputSchema: z.ZodObject<{
    order_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    order_id: string;
}, {
    order_id: string;
}>;
export type GetOrderInput = z.infer<typeof getOrderInputSchema>;
export declare const listOrdersInputSchema: z.ZodObject<{
    customer_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    customer_id: string;
}, {
    customer_id: string;
}>;
export type ListOrdersInput = z.infer<typeof listOrdersInputSchema>;
export declare const getTrackingInputSchema: z.ZodObject<{
    order_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    order_id: string;
}, {
    order_id: string;
}>;
export type GetTrackingInput = z.infer<typeof getTrackingInputSchema>;
//# sourceMappingURL=types.d.ts.map