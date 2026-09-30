import { z } from "zod";

export const sendConfirmationInputSchema = z.object({
  to: z.string().email("to must be a valid email address"),
  subject: z.string().min(1, "subject must not be empty"),
  body: z.string().min(1, "body must not be empty"),
  order_id: z.string().optional()
});

export type SendConfirmationInput = z.infer<typeof sendConfirmationInputSchema>;

export const emailAuditRecordSchema = z.object({
  id: z.string(),
  to: z.string().email(),
  subject: z.string(),
  body: z.string(),
  order_id: z.string().optional(),
  sent_at: z.string(),
  status: z.literal("logged")
});

export type EmailAuditRecord = z.infer<typeof emailAuditRecordSchema>;
