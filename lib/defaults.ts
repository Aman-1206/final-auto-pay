import { randomUUID } from "node:crypto";
import type { DispatchSettings, ReminderRule, ReminderTemplate } from "@/lib/types";

const defaultRuleBlueprints = [
  { name: "90 Day Follow Up", daysBeforeDue: 90 },
  { name: "45 Day Follow Up", daysBeforeDue: 45 },
  { name: "30 Day Follow Up", daysBeforeDue: 30 }
];

function buildBody(daysBeforeDue: number) {
  return `Dear {{contactName}},

This is a reminder that invoice {{invoiceNumber}} for {{companyName}} amounting to {{amount}} is due on {{dueDate}}.

We are reaching out {{daysBeforeDue}} days before the due date so your team has enough time to process the payment.

If payment is already scheduled, please ignore this note. Otherwise, feel free to reply if you need any supporting documents.

Regards,
{{senderCompany}}`;
}

export function createDefaultRuleSet(ownerId: string) {
  const generatedAt = new Date().toISOString();

  const templates: ReminderTemplate[] = defaultRuleBlueprints.map((rule) => {
    const templateId = randomUUID();
    return {
      id: templateId,
      ownerId,
      ruleId: "",
      name: rule.name,
      emailSubject: `Payment reminder: invoice {{invoiceNumber}} due on {{dueDate}}`,
      emailBody: buildBody(rule.daysBeforeDue),
      whatsappBody: `Hello {{contactName}}, invoice {{invoiceNumber}} for {{companyName}} worth {{amount}} is due on {{dueDate}}. This is your {{daysBeforeDue}} day reminder.`,
      smsBody: `Reminder: invoice {{invoiceNumber}} for {{companyName}} amount {{amount}} is due on {{dueDate}}.`,
      updatedAt: generatedAt
    };
  });

  const rules: ReminderRule[] = defaultRuleBlueprints.map((rule, index) => {
    const ruleId = randomUUID();
    templates[index].ruleId = ruleId;

    return {
      id: ruleId,
      ownerId,
      name: rule.name,
      daysBeforeDue: rule.daysBeforeDue,
      enabled: true,
      autoSend: false,
      channels: {
        email: true,
        whatsapp: true,
        sms: false
      },
      templateId: templates[index].id,
      createdAt: generatedAt,
      updatedAt: generatedAt
    };
  });

  const dispatchSettings: DispatchSettings = {
    ownerId,
    simulateMode: true,
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: "",
    smtpPass: "",
    smtpFrom: "",
    smsFromNumber: "",
    whatsappFromNumber: "",
    whatsappWebhookUrl: "",
    updatedAt: generatedAt
  };

  return { rules, templates, dispatchSettings };
}
