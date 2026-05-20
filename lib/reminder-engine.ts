import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { readDatabase, updateDatabase } from "@/lib/storage";
import type {
  DashboardStats,
  DispatchSettings,
  DueRecord,
  MasterContact,
  ReminderLog,
  ReminderRule,
  ReminderTemplate
} from "@/lib/types";
import { daysBetween, fillTemplate, formatCurrency, formatDate, normalizeText } from "@/lib/utils";

type ReminderContext = {
  due: DueRecord;
  contact: MasterContact;
  rule: ReminderRule;
  template: ReminderTemplate;
};

type ReminderChannelSelection = Partial<Record<ReminderLog["channel"], boolean>>;

function buildReminderDedupeKey(
  due: DueRecord,
  rule: ReminderRule,
  channel: ReminderLog["channel"]
) {
  return [
    normalizeText(due.customerCode || due.companyName),
    normalizeText(due.invoiceNumber || due.reference || "no-invoice"),
    due.dueDate,
    rule.id,
    channel
  ].join("|");
}

function matchContact(due: DueRecord, contacts: MasterContact[]) {
  const customerCode = normalizeText(due.customerCode || "");

  if (customerCode) {
    const codeMatch = contacts.find(
      (contact) => normalizeText(contact.customerCode || "") === customerCode
    );

    if (codeMatch) {
      return codeMatch;
    }
  }

  const companyKey = normalizeText(due.companyName);
  return contacts.find((contact) => normalizeText(contact.companyName) === companyKey) ?? null;
}

function buildReplacements(context: ReminderContext, senderCompany: string) {
  return {
    amount: formatCurrency(context.due.amount, context.due.currency),
    companyName: context.due.companyName,
    contactName: context.contact.primaryContact || "Accounts Team",
    daysBeforeDue: context.rule.daysBeforeDue,
    dueDate: formatDate(context.due.dueDate),
    invoiceNumber: context.due.invoiceNumber || context.due.reference || "N/A",
    reference: context.due.reference,
    senderCompany
  };
}

function buildChannelEntries(
  rule: ReminderRule,
  template: ReminderTemplate,
  contact: MasterContact,
  channelSelection?: ReminderChannelSelection
): Array<[ReminderLog["channel"], boolean, string, string]> {
  return [
    [
      "email",
      channelSelection?.email ?? rule.channels.email,
      contact.email,
      template.emailBody
    ],
    [
      "whatsapp",
      channelSelection?.whatsapp ?? rule.channels.whatsapp,
      contact.whatsapp,
      template.whatsappBody
    ],
    ["sms", channelSelection?.sms ?? rule.channels.sms, contact.sms, template.smsBody]
  ];
}

function hasExistingLog(
  logs: ReminderLog[],
  dedupeKey: string,
  scheduledFor: string
) {
  return logs.some(
    (log) => (log.dedupeKey || `${log.dueId}|${log.ruleId}|${log.channel}`) === dedupeKey && log.scheduledFor === scheduledFor
  );
}

function toBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === "true";
}

function isE164PhoneNumber(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(value.trim());
}

function normalizePhoneNumberForTwilio(value: string) {
  const trimmed = value.trim().replace(/[\s()-]/g, "");

  if (isE164PhoneNumber(trimmed)) {
    return trimmed;
  }

  if (/^[1-9]\d{7,14}$/.test(trimmed)) {
    return `+${trimmed}`;
  }

  return trimmed;
}

function normalizeWhatsappAddressForTwilio(value: string) {
  const trimmed = value.trim();
  const withoutPrefix = trimmed.toLowerCase().startsWith("whatsapp:")
    ? trimmed.slice("whatsapp:".length)
    : trimmed;

  return `whatsapp:${normalizePhoneNumberForTwilio(withoutPrefix)}`;
}

function resolveDispatchSettings(settings: DispatchSettings): DispatchSettings {
  const savedSmsFromNumber = (settings.smsFromNumber || "").trim();
  const envSmsFromNumber = (process.env.TWILIO_FROM_NUMBER || "").trim();
  const legacySmsSenderId = (settings.smsSenderId || "").trim();
  const smsFromNumber = [
    savedSmsFromNumber,
    envSmsFromNumber,
    isE164PhoneNumber(legacySmsSenderId) ? legacySmsSenderId : ""
  ].find((value) => value !== "") || "";
  const whatsappFromNumber =
    [
      (settings.whatsappFromNumber || "").trim(),
      (process.env.TWILIO_WHATSAPP_FROM_NUMBER || "").trim()
    ].find((value) => value !== "") || "";

  return {
    ...settings,
    simulateMode: toBoolean(process.env.REMINDER_SIMULATE_MODE, settings.simulateMode),
    smtpHost: settings.smtpHost || process.env.SMTP_HOST || "",
    smtpPort: Number(process.env.SMTP_PORT || settings.smtpPort || 587),
    smtpSecure: toBoolean(process.env.SMTP_SECURE, settings.smtpSecure),
    smtpUser: settings.smtpUser || process.env.SMTP_USER || "",
    smtpPass: settings.smtpPass || process.env.SMTP_PASS || "",
    smtpFrom: settings.smtpFrom || process.env.SMTP_FROM || "",
    smsFromNumber,
    whatsappFromNumber,
    whatsappWebhookUrl: settings.whatsappWebhookUrl || process.env.WHATSAPP_WEBHOOK_URL || ""
  };
}

export async function getDashboardStats(ownerId: string): Promise<DashboardStats> {
  const database = await readDatabase();

  return {
    masterCount: database.masterContacts.filter((entry) => entry.ownerId === ownerId).length,
    dueCount: database.dueRecords.filter((entry) => entry.ownerId === ownerId).length,
    pendingReminders: database.reminderLogs.filter(
      (entry) => entry.ownerId === ownerId && entry.status === "pending"
    ).length,
    sentReminders: database.reminderLogs.filter(
      (entry) =>
        entry.ownerId === ownerId &&
        (entry.status === "sent" || entry.status === "simulated")
    ).length
  };
}

export async function generateRemindersForUser(ownerId: string, requestedDate?: string) {
  return updateDatabase((database) => {
    const contacts = database.masterContacts.filter((entry) => entry.ownerId === ownerId);
    const dues = database.dueRecords.filter((entry) => entry.ownerId === ownerId);
    const rules = database.reminderRules.filter((entry) => entry.ownerId === ownerId && entry.enabled);
    const templates = database.templates.filter((entry) => entry.ownerId === ownerId);
    const user = database.users.find((entry) => entry.id === ownerId);
    const today = requestedDate ? new Date(requestedDate) : new Date();
    const scheduledFor = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    ).toISOString();
    const created: ReminderLog[] = [];

    for (const due of dues) {
      const contact = matchContact(due, contacts);
      if (!contact) {
        continue;
      }

      const daysUntilDue = daysBetween(today, new Date(due.dueDate));

      for (const rule of rules) {
        if (daysUntilDue !== rule.daysBeforeDue) {
          continue;
        }

        const template = templates.find((entry) => entry.id === rule.templateId);
        if (!template) {
          continue;
        }

        const replacements = buildReplacements(
          { due, contact, rule, template },
          user?.companyName || "Your Company"
        );

        const channelEntries = buildChannelEntries(rule, template, contact);

        for (const [channel, enabled, recipient, body] of channelEntries) {
          if (!enabled || !recipient) {
            continue;
          }

          const dedupeKey = buildReminderDedupeKey(due, rule, channel);

          if (hasExistingLog(database.reminderLogs, dedupeKey, scheduledFor)) {
            continue;
          }

          created.push({
            id: randomUUID(),
            ownerId,
            dueId: due.id,
            dedupeKey,
            contactId: contact.id,
            ruleId: rule.id,
            templateId: template.id,
            channel,
            recipient,
            scheduledFor,
            status: "pending",
            subject:
              channel === "email"
                ? fillTemplate(template.emailSubject, replacements)
                : `${rule.name} reminder`,
            content: fillTemplate(body, replacements),
            failureReason: "",
            sentAt: "",
            createdAt: new Date().toISOString()
          });
        }
      }
    }

    database.reminderLogs.push(...created);
    return created;
  });
}

export async function createManualRemindersForDue(
  ownerId: string,
  dueId: string,
  ruleId: string,
  channelSelection?: ReminderChannelSelection
) {
  return updateDatabase((database) => {
    const due = database.dueRecords.find((entry) => entry.ownerId === ownerId && entry.id === dueId);
    if (!due) {
      throw new Error("The selected invoice could not be found.");
    }

    const contact = matchContact(
      due,
      database.masterContacts.filter((entry) => entry.ownerId === ownerId)
    );
    if (!contact) {
      throw new Error("No matching master contact was found for that invoice.");
    }

    const rule = database.reminderRules.find((entry) => entry.ownerId === ownerId && entry.id === ruleId);
    if (!rule) {
      throw new Error("The selected reminder rule could not be found.");
    }

    const template = database.templates.find(
      (entry) => entry.ownerId === ownerId && entry.id === rule.templateId
    );
    if (!template) {
      throw new Error("The selected reminder template could not be found.");
    }

    const user = database.users.find((entry) => entry.id === ownerId);
    const scheduledFor = new Date().toISOString();
    const replacements = buildReplacements(
      { due, contact, rule, template },
      user?.companyName || "Your Company"
    );
    const created: ReminderLog[] = [];
    const channelEntries = buildChannelEntries(rule, template, contact, channelSelection);

    for (const [channel, enabled, recipient, body] of channelEntries) {
      if (!enabled || !recipient) {
        continue;
      }

      created.push({
        id: randomUUID(),
        ownerId,
        dueId: due.id,
        dedupeKey: `${buildReminderDedupeKey(due, rule, channel)}|manual|${scheduledFor}`,
        contactId: contact.id,
        ruleId: rule.id,
        templateId: template.id,
        channel,
        recipient,
        scheduledFor,
        status: "pending",
        subject:
          channel === "email"
            ? fillTemplate(template.emailSubject, replacements)
            : `${rule.name} reminder`,
        content: fillTemplate(body, replacements),
        failureReason: "",
        sentAt: "",
        createdAt: scheduledFor
      });
    }

    if (created.length === 0) {
      throw new Error(
        "No reminder could be created. Check the selected channels and matching contact details."
      );
    }

    database.reminderLogs.push(...created);
    return created;
  });
}

async function sendEmail(log: ReminderLog, settings: DispatchSettings) {
  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpSecure,
    auth: settings.smtpUser
      ? {
          user: settings.smtpUser,
          pass: settings.smtpPass
        }
      : undefined
  });

  await transporter.sendMail({
    from: settings.smtpFrom,
    to: log.recipient,
    subject: log.subject,
    text: log.content
  });
}

async function postWebhook(url: string, log: ReminderLog) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      recipient: log.recipient,
      subject: log.subject,
      message: log.content,
      channel: log.channel
    })
  });

  if (!response.ok) {
    throw new Error(`Webhook failed with status ${response.status}.`);
  }
}

async function sendTwilioMessage(from: string, to: string, body: string, channelLabel: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();

  if (!accountSid) {
    throw new Error("Twilio Account SID is missing.");
  }

  if (!authToken) {
    throw new Error("Twilio Auth Token is missing.");
  }

  const form = new URLSearchParams({
    From: from,
    To: to,
    Body: body
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form.toString()
    }
  );

  const rawResponse = await response.text();
  let errorMessage = `Twilio ${channelLabel} failed with status ${response.status}.`;

  if (rawResponse) {
    try {
      const payload = JSON.parse(rawResponse) as {
        message?: string;
        error_message?: string;
      };
      errorMessage = payload.message || payload.error_message || errorMessage;
    } catch {
      errorMessage = rawResponse;
    }
  }

  if (!response.ok) {
    throw new Error(errorMessage);
  }
}

async function sendTwilioSms(log: ReminderLog, settings: DispatchSettings) {
  if (!settings.smsFromNumber) {
    throw new Error("Twilio sender number is missing.");
  }

  await sendTwilioMessage(
    normalizePhoneNumberForTwilio(settings.smsFromNumber),
    normalizePhoneNumberForTwilio(log.recipient),
    log.content,
    "SMS"
  );
}

async function sendTwilioWhatsapp(log: ReminderLog, settings: DispatchSettings) {
  if (!settings.whatsappFromNumber) {
    throw new Error("Twilio WhatsApp sender is missing.");
  }

  await sendTwilioMessage(
    normalizeWhatsappAddressForTwilio(settings.whatsappFromNumber),
    normalizeWhatsappAddressForTwilio(log.recipient),
    log.content,
    "WhatsApp"
  );
}

async function deliverReminder(log: ReminderLog, settings: DispatchSettings) {
  if (settings.simulateMode) {
    return "simulated" as const;
  }

  if (log.channel === "email") {
    if (!settings.smtpHost || !settings.smtpFrom) {
      throw new Error("SMTP settings are incomplete.");
    }

    await sendEmail(log, settings);
    return "sent" as const;
  }

  if (log.channel === "sms") {
    await sendTwilioSms(log, settings);
    return "sent" as const;
  }

  if (settings.whatsappFromNumber) {
    await sendTwilioWhatsapp(log, settings);
    return "sent" as const;
  }

  if (settings.whatsappWebhookUrl) {
    await postWebhook(settings.whatsappWebhookUrl, log);
    return "sent" as const;
  }

  throw new Error("Twilio WhatsApp sender is missing.");
}

export async function sendPendingReminders(ownerId: string, ruleIds?: string[], logIds?: string[]) {
  return updateDatabase(async (database) => {
    const settings = database.dispatchSettings.find((entry) => entry.ownerId === ownerId);
    if (!settings) {
      throw new Error("Dispatch settings are missing.");
    }
    const resolvedSettings = resolveDispatchSettings(settings);

    const logs = database.reminderLogs.filter(
      (entry) =>
        entry.ownerId === ownerId &&
        entry.status === "pending" &&
        (!ruleIds || ruleIds.includes(entry.ruleId)) &&
        (!logIds || logIds.includes(entry.id))
    );

    for (const log of logs) {
      try {
        const status = await deliverReminder(log, resolvedSettings);
        log.status = status;
        log.sentAt = new Date().toISOString();
        log.failureReason = "";
      } catch (error) {
        log.status = "failed";
        log.failureReason =
          error instanceof Error ? error.message : "Unknown sending error occurred.";
      }
    }

    return logs;
  });
}
