import crypto from "node:crypto";
import { EmailAuditRecord, SendConfirmationInput } from "./types.js";

export class EmailService {
  private readonly sentEmails: Map<string, EmailAuditRecord> = new Map();

  sendConfirmation(input: SendConfirmationInput): EmailAuditRecord {
    const emailId = `eml_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    const record: EmailAuditRecord = {
      id: emailId,
      to: input.to,
      subject: input.subject,
      body: input.body,
      order_id: input.order_id,
      sent_at: new Date().toISOString(),
      status: "logged"
    };

    this.sentEmails.set(emailId, record);
    process.stdout.write(`[EMAIL_AUDIT] Email logged: id=${record.id} to=${record.to} subject="${record.subject}"\n`);
    return record;
  }

  getAuditLog(): EmailAuditRecord[] {
    return Array.from(this.sentEmails.values());
  }

  getEmailById(id: string): EmailAuditRecord | undefined {
    return this.sentEmails.get(id);
  }

  clearAuditLog(): void {
    this.sentEmails.clear();
  }
}
