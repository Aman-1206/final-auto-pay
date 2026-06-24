import { randomUUID } from "node:crypto";
import { resolveDispatchSettings } from "@/lib/dispatch-settings";
import type {
  CashDiscountPolicy,
  DispatchSettings,
  ReminderRule,
  ReminderTemplate
} from "@/lib/types";

const defaultRuleBlueprints = [
  { name: "21 Day Reminder", triggerDay: 21 },
  { name: "25 Day Reminder", triggerDay: 25 },
  { name: "30 Day Reminder", triggerDay: 30 },
  { name: "35 Day Reminder", triggerDay: 35 },
  { name: "60 Day Reminder", triggerDay: 60 }
];

const defaultCashDiscountBlueprints = [
  { name: "30 Day CD", paymentWindowDays: 30, discountPercent: 2 },
  { name: "60 Day CD", paymentWindowDays: 60, discountPercent: 1 }
];

function buildBody(triggerDay: number) {
  return `Dear {{contactName}},

This is a reminder for invoice {{invoiceNumber}} dated {{billDate}} for {{companyName}} with pending amount {{pendingAmount}}.
Reference number: {{reference}}.

Current invoice due: {{currentInvoiceDueAmount}}.
Previous due: {{previousDueAmount}}.
Total due: {{totalDueAmount}}.

The bill has now aged {{billAgeDays}} days, and this reminder was triggered by your day {{reminderDay}} rule.

{{cdMessage}}

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
      emailSubject: `Payment reminder: invoice {{invoiceNumber}} now at {{billAgeDays}} days`,
      emailBody: buildBody(rule.triggerDay),
      whatsappBody: `Hello {{contactName}}, invoice {{invoiceNumber}} for {{companyName}} has pending amount {{pendingAmount}}. Previous due: {{previousDueAmount}}. Total due: {{totalDueAmount}}. Ref: {{reference}}. The bill is now {{billAgeDays}} days old. {{cdShortMessage}}`,
      smsBody: `Reminder: invoice {{invoiceNumber}} for {{companyName}} has pending amount {{pendingAmount}}. Previous due: {{previousDueAmount}}. Total due: {{totalDueAmount}}. Ref: {{reference}}. {{cdShortMessage}}`,
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
      triggerDay: rule.triggerDay,
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

  const cashDiscountPolicies: CashDiscountPolicy[] = defaultCashDiscountBlueprints.map((policy) => ({
    id: randomUUID(),
    ownerId,
    name: policy.name,
    paymentWindowDays: policy.paymentWindowDays,
    discountPercent: policy.discountPercent,
    enabled: true,
    description: `Customer remains eligible for ${policy.discountPercent}% cash discount when payment is cleared within ${policy.paymentWindowDays} days and no older unpaid invoices exist.`,
    createdAt: generatedAt,
    updatedAt: generatedAt
  }));

  const dispatchSettings: DispatchSettings = resolveDispatchSettings({
    ownerId,
    senderMobileNumber: "",
    smsProviderName: "Twilio",
    smsSenderId: "",
    whatsappProviderName: "Interakt",
    futureIntegrationNotes: "",
    reportRecipients: [],
    reportFrequency: "daily",
    reportTime: "18:00",
    updatedAt: generatedAt
  });

  return { rules, templates, dispatchSettings, cashDiscountPolicies };
}
