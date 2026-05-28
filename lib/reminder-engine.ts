import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import {
  filterSharedCompanyRecords,
  getCompanyWorkspaceContext
} from "@/lib/company-workspace";
import { findMatchingMasterContact } from "@/lib/contact-matching";
import {
  isE164PhoneNumber,
  resolveDispatchSettings
} from "@/lib/dispatch-settings";
import { readDatabase, updateDatabase } from "@/lib/storage";
import type {
  CashDiscountPolicy,
  DashboardStats,
  DispatchSettings,
  DueRecord,
  MasterContact,
  ReminderLog,
  ReminderRule,
  ReminderTemplate
} from "@/lib/types";
import {
  fillTemplate,
  formatCurrency,
  formatDate,
  getDuePartyKey,
  getBillAgeDays,
  normalizeText
} from "@/lib/utils";

type ReminderContext = {
  due: DueRecord;
  contact: MasterContact;
  rule: ReminderRule;
  template: ReminderTemplate;
  cdEvaluation: CashDiscountEvaluation;
  billAgeDays: number;
};

type ReminderChannelSelection = Partial<Record<ReminderLog["channel"], boolean>>;

type CashDiscountEvaluation = {
  eligible: boolean;
  firstBill: boolean;
  policy: CashDiscountPolicy | null;
  reason: string;
};

function buildReminderDedupeKey(
  due: DueRecord,
  rule: ReminderRule,
  channel: ReminderLog["channel"]
) {
  return [
    normalizeText(due.dealerCode || due.customerCode || due.companyName),
    normalizeText(due.invoiceNumber || due.reference || "no-invoice"),
    due.billDate || due.invoiceDate || "no-bill-date",
    rule.id,
    channel
  ].join("|");
}

function buildCashDiscountSummary(evaluation: CashDiscountEvaluation) {
  if (evaluation.eligible && evaluation.policy) {
    return `Cash discount status: eligible for ${evaluation.policy.discountPercent}% if payment clears within ${evaluation.policy.paymentWindowDays} days and no older unpaid invoices exist.`;
  }

  return `Cash discount status: ${evaluation.reason}`;
}

function buildCashDiscountShortSummary(evaluation: CashDiscountEvaluation) {
  if (evaluation.eligible && evaluation.policy) {
    return `Eligible for ${evaluation.policy.discountPercent}% CD within ${evaluation.policy.paymentWindowDays} days.`;
  }

  return evaluation.reason;
}

function buildCashDiscountMessage(evaluation: CashDiscountEvaluation) {
  if (!evaluation.eligible || !evaluation.policy) {
    return "";
  }

  const prefix = evaluation.firstBill
    ? "Since no older unpaid bill is pending for your account,"
    : "Since you have cleared all earlier bills,";

  return `${prefix} we are giving you CD of ${evaluation.policy.discountPercent}% if this invoice is cleared within ${evaluation.policy.paymentWindowDays} days.`;
}

function buildCashDiscountShortMessage(evaluation: CashDiscountEvaluation) {
  if (!evaluation.eligible || !evaluation.policy) {
    return "";
  }

  const prefix = evaluation.firstBill
    ? "Since no older unpaid bill is pending,"
    : "Since you have cleared all earlier bills,";

  return `${prefix} we are giving you CD of ${evaluation.policy.discountPercent}% if paid within ${evaluation.policy.paymentWindowDays} days.`;
}

function buildReplacements(context: ReminderContext, senderCompany: string) {
  const billDate = context.due.billDate || context.due.invoiceDate;

  return {
    amount: formatCurrency(context.due.amount, context.due.currency),
    billAgeDays: context.billAgeDays,
    billDate: formatDate(billDate),
    companyBillKey: getDuePartyKey(context.due),
    cdDiscountPercent: context.cdEvaluation.policy?.discountPercent ?? 0,
    cdEligible: context.cdEvaluation.eligible ? "Eligible" : "Not eligible",
    cdMessage: buildCashDiscountMessage(context.cdEvaluation),
    cdPolicyWindowDays: context.cdEvaluation.policy?.paymentWindowDays ?? 0,
    cdReason: context.cdEvaluation.reason,
    cdShortMessage: buildCashDiscountShortMessage(context.cdEvaluation),
    cdShortSummary: buildCashDiscountShortSummary(context.cdEvaluation),
    cdSummary: buildCashDiscountSummary(context.cdEvaluation),
    companyName: context.due.companyName,
    contactName:
      context.contact.primaryContact ||
      context.due.matchedContactName ||
      "Accounts Team",
    daysBeforeDue: context.rule.triggerDay,
    dealerCode: context.due.dealerCode || context.due.customerCode,
    dueDate: context.due.dueDate ? formatDate(context.due.dueDate) : "Not available",
    invoiceNumber: context.due.invoiceNumber || context.due.reference || "N/A",
    openingAmount: formatCurrency(context.due.openingAmount, context.due.currency),
    overdueDays: context.due.overdueDays,
    pendingAmount: formatCurrency(context.due.amount, context.due.currency),
    reference: context.due.reference || context.due.invoiceNumber || "N/A",
    reminderDay: context.rule.triggerDay,
    senderCompany
  };
}

function buildChannelEntries(
  rule: ReminderRule,
  template: ReminderTemplate,
  contact: MasterContact,
  due: DueRecord,
  channelSelection?: ReminderChannelSelection
): Array<[ReminderLog["channel"], boolean, string, string]> {
  return [
    [
      "email",
      channelSelection?.email ?? rule.channels.email,
      contact.email || due.matchedEmail,
      template.emailBody
    ],
    [
      "whatsapp",
      channelSelection?.whatsapp ?? rule.channels.whatsapp,
      contact.whatsapp || due.matchedWhatsapp,
      template.whatsappBody
    ],
    [
      "sms",
      channelSelection?.sms ?? rule.channels.sms,
      contact.sms || due.matchedSms,
      template.smsBody
    ]
  ];
}

function hasExistingLog(logs: ReminderLog[], dedupeKey: string, scheduledFor: string) {
  return logs.some(
    (log) =>
      (log.dedupeKey || `${log.dueId}|${log.ruleId}|${log.channel}`) === dedupeKey &&
      log.scheduledFor === scheduledFor
  );
}

function normalizePhoneNumberForTwilio(value: string) {
  const trimmed = value.trim().replace(/[\s()-]/g, "");

  if (isE164PhoneNumber(trimmed)) {
    return trimmed;
  }

  if (/^[6-9]\d{9}$/.test(trimmed)) {
    return `+91${trimmed}`;
  }

  if (/^91\d{10}$/.test(trimmed)) {
    return `+${trimmed}`;
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

function templateIncludesCashDiscountToken(template: string) {
  return /\{\{\s*cd(?:Message|ShortMessage|Summary|ShortSummary|Eligible|DiscountPercent|PolicyWindowDays|Reason)\s*\}\}/i.test(
    template
  );
}

function composeReminderContent(
  channel: ReminderLog["channel"],
  template: string,
  replacements: Record<string, string | number>,
  evaluation: CashDiscountEvaluation
) {
  const filledTemplate = fillTemplate(template, replacements).trim();

  if (templateIncludesCashDiscountToken(template) || !evaluation.eligible) {
    return filledTemplate;
  }

  const appendedCashDiscountMessage =
    channel === "email"
      ? buildCashDiscountMessage(evaluation)
      : buildCashDiscountShortMessage(evaluation);

  if (!appendedCashDiscountMessage) {
    return filledTemplate;
  }

  return channel === "email"
    ? `${filledTemplate}\n\n${appendedCashDiscountMessage}`.trim()
    : `${filledTemplate} ${appendedCashDiscountMessage}`.trim();
}

function evaluateCashDiscountEligibility(
  due: DueRecord,
  allDuesForDealer: DueRecord[],
  policies: CashDiscountPolicy[],
  referenceDate: Date
): CashDiscountEvaluation {
  const billAgeDays = getBillAgeDays(due.billDate || due.invoiceDate, referenceDate);

  if (billAgeDays === null) {
    return {
      eligible: false,
      firstBill: false,
      policy: null,
      reason: "Bill date is missing, so CD eligibility could not be evaluated."
    };
  }

  const olderBills = allDuesForDealer
    .filter((entry) => entry.id !== due.id)
    .filter((entry) => {
      const otherBillDate = new Date(entry.billDate || entry.invoiceDate || "");
      const currentBillDate = new Date(due.billDate || due.invoiceDate || "");

      return (
        !Number.isNaN(otherBillDate.getTime()) &&
        !Number.isNaN(currentBillDate.getTime()) &&
        otherBillDate.getTime() < currentBillDate.getTime()
      );
    })
    .sort((left, right) => (left.billDate || left.invoiceDate).localeCompare(right.billDate || right.invoiceDate));

  const olderUnpaidBills = olderBills
    .filter((entry) => entry.amount > 0)
    .sort((left, right) => (left.billDate || left.invoiceDate).localeCompare(right.billDate || right.invoiceDate));

  if (olderUnpaidBills.length > 0) {
    const oldestPending = olderUnpaidBills[0];
    return {
      eligible: false,
      firstBill: false,
      policy: null,
      reason: `Older unpaid invoice ${oldestPending.invoiceNumber || oldestPending.reference || "N/A"} is still open.`
    };
  }

  const eligiblePolicy =
    policies
      .filter((policy) => policy.enabled)
      .sort((left, right) => left.paymentWindowDays - right.paymentWindowDays)
      .find((policy) => billAgeDays <= policy.paymentWindowDays) || null;

  if (!eligiblePolicy) {
    return {
      eligible: false,
      firstBill: olderBills.length === 0,
      policy: null,
      reason: "Bill age is outside every configured cash discount window."
    };
  }

  const firstBill = olderBills.length === 0;
  return {
    eligible: true,
    firstBill,
    policy: eligiblePolicy,
    reason: firstBill
      ? `Eligible for ${eligiblePolicy.discountPercent}% CD under the ${eligiblePolicy.paymentWindowDays}-day policy because this is the first active bill on record.`
      : `Eligible for ${eligiblePolicy.discountPercent}% CD under the ${eligiblePolicy.paymentWindowDays}-day policy because no older unpaid invoices remain open.`
  };
}

export async function getDashboardStats(ownerId: string): Promise<DashboardStats> {
  const database = await readDatabase();
  const user = database.users.find((entry) => entry.id === ownerId);

  if (!user) {
    return {
      masterCount: 0,
      dueCount: 0,
      pendingReminders: 0,
      sentReminders: 0
    };
  }

  const workspace = getCompanyWorkspaceContext(database, user.companyName);
  const reminderLogs = filterSharedCompanyRecords(database.reminderLogs, workspace.sharedOwnerIds);

  return {
    masterCount: filterSharedCompanyRecords(database.masterContacts, workspace.sharedOwnerIds).length,
    dueCount: filterSharedCompanyRecords(database.dueRecords, workspace.sharedOwnerIds).length,
    pendingReminders: reminderLogs.filter((entry) => entry.status === "pending").length,
    sentReminders: reminderLogs.filter(
      (entry) => entry.status === "sent" || entry.status === "simulated"
    ).length
  };
}

export async function generateRemindersForUser(ownerId: string, requestedDate?: string) {
  return updateDatabase(async (database) => {
    const user = database.users.find((entry) => entry.id === ownerId);
    if (!user) {
      throw new Error("The current user could not be found.");
    }

    const workspace = getCompanyWorkspaceContext(database, user.companyName);
    const contacts = filterSharedCompanyRecords(database.masterContacts, workspace.sharedOwnerIds);
    const dues = filterSharedCompanyRecords(database.dueRecords, workspace.sharedOwnerIds);
    const rules = database.reminderRules
      .filter((entry) => entry.ownerId === workspace.configOwnerId && entry.enabled)
      .sort((left, right) => left.triggerDay - right.triggerDay);
    const templates = database.templates.filter(
      (entry) => entry.ownerId === workspace.configOwnerId
    );
    const policies = database.cashDiscountPolicies.filter(
      (entry) => entry.ownerId === workspace.configOwnerId
    );
    const today = requestedDate ? new Date(requestedDate) : new Date();
    const scheduledFor = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    ).toISOString();
    const created: ReminderLog[] = [];

    for (const due of dues) {
      const contact = findMatchingMasterContact(due, contacts);
      if (!contact) {
        continue;
      }

      const billAgeDays = getBillAgeDays(due.billDate || due.invoiceDate, today);
      if (billAgeDays === null) {
        continue;
      }

      const cdEvaluation = evaluateCashDiscountEligibility(
        due,
        dues.filter(
          (entry) => getDuePartyKey(entry) === getDuePartyKey(due)
        ),
        policies,
        today
      );

      for (const rule of rules) {
        if (billAgeDays !== rule.triggerDay) {
          continue;
        }

        const template = templates.find((entry) => entry.id === rule.templateId);
        if (!template) {
          continue;
        }

        const replacements = buildReplacements(
          { due, contact, rule, template, cdEvaluation, billAgeDays },
          user?.companyName || "Your Company"
        );
        const channelEntries = buildChannelEntries(rule, template, contact, due);

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
            ownerId: workspace.workspaceId,
            dueId: due.id,
            dedupeKey,
            contactId: contact.id,
            ruleId: rule.id,
            templateId: template.id,
            dealerCode: due.dealerCode || due.customerCode,
            invoiceNumber: due.invoiceNumber || due.reference || "",
            reminderDay: rule.triggerDay,
            billAgeDays,
            cdEligible: cdEvaluation.eligible,
            cdPolicyId: cdEvaluation.policy?.id || "",
            cdDiscountPercent: cdEvaluation.policy?.discountPercent ?? 0,
            cdReason: cdEvaluation.reason,
            channel,
            recipient,
            scheduledFor,
            status: "pending",
            subject:
              channel === "email"
                ? fillTemplate(template.emailSubject, replacements)
                : `${rule.name} reminder`,
            content: composeReminderContent(channel, body, replacements, cdEvaluation),
            failureReason: "",
            sentAt: "",
            createdAt: new Date().toISOString()
          });
        }
      }
    }

    database.reminderLogs.push(...created);
    const autoSendRuleIds = Array.from(
      new Set(created.map((entry) => entry.ruleId).filter((ruleId) => rules.find((rule) => rule.id === ruleId && rule.autoSend)))
    );

    if (autoSendRuleIds.length > 0) {
      const settings = database.dispatchSettings.find(
        (entry) => entry.ownerId === workspace.configOwnerId
      );

      if (!settings) {
        throw new Error("Dispatch settings are missing.");
      }

      const resolvedSettings = resolveDispatchSettings(settings);
      const autoSendLogs = created.filter((entry) => autoSendRuleIds.includes(entry.ruleId));

      for (const log of autoSendLogs) {
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
    }

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
    const user = database.users.find((entry) => entry.id === ownerId);
    if (!user) {
      throw new Error("The current user could not be found.");
    }

    const workspace = getCompanyWorkspaceContext(database, user.companyName);
    const due = database.dueRecords.find(
      (entry) => workspace.sharedOwnerIds.has(entry.ownerId) && entry.id === dueId
    );
    if (!due) {
      throw new Error("The selected invoice could not be found.");
    }

    const contact = findMatchingMasterContact(
      due,
      filterSharedCompanyRecords(database.masterContacts, workspace.sharedOwnerIds)
    );
    if (!contact) {
      throw new Error("No matching master contact was found for that invoice.");
    }

    const rule = database.reminderRules.find(
      (entry) => entry.ownerId === workspace.configOwnerId && entry.id === ruleId
    );
    if (!rule) {
      throw new Error("The selected reminder rule could not be found.");
    }

    const template = database.templates.find(
      (entry) => entry.ownerId === workspace.configOwnerId && entry.id === rule.templateId
    );
    if (!template) {
      throw new Error("The selected reminder template could not be found.");
    }

    const billAgeDays = getBillAgeDays(due.billDate || due.invoiceDate, new Date());
    if (billAgeDays === null) {
      throw new Error("The selected invoice does not have a valid bill date.");
    }

    const policies = database.cashDiscountPolicies.filter(
      (entry) => entry.ownerId === workspace.configOwnerId
    );
    const cdEvaluation = evaluateCashDiscountEligibility(
      due,
      filterSharedCompanyRecords(database.dueRecords, workspace.sharedOwnerIds).filter(
        (entry) => getDuePartyKey(entry) === getDuePartyKey(due)
      ),
      policies,
      new Date()
    );
    const scheduledFor = new Date().toISOString();
    const replacements = buildReplacements(
      { due, contact, rule, template, cdEvaluation, billAgeDays },
      user?.companyName || "Your Company"
    );
    const created: ReminderLog[] = [];
    const channelEntries = buildChannelEntries(rule, template, contact, due, channelSelection);

    for (const [channel, enabled, recipient, body] of channelEntries) {
      if (!enabled || !recipient) {
        continue;
      }

      created.push({
        id: randomUUID(),
        ownerId: workspace.workspaceId,
        dueId: due.id,
        dedupeKey: `${buildReminderDedupeKey(due, rule, channel)}|manual|${scheduledFor}`,
        contactId: contact.id,
        ruleId: rule.id,
        templateId: template.id,
        dealerCode: due.dealerCode || due.customerCode,
        invoiceNumber: due.invoiceNumber || due.reference || "",
        reminderDay: rule.triggerDay,
        billAgeDays,
        cdEligible: cdEvaluation.eligible,
        cdPolicyId: cdEvaluation.policy?.id || "",
        cdDiscountPercent: cdEvaluation.policy?.discountPercent ?? 0,
        cdReason: cdEvaluation.reason,
        channel,
        recipient,
        scheduledFor,
        status: "pending",
        subject:
          channel === "email"
            ? fillTemplate(template.emailSubject, replacements)
            : `${rule.name} reminder`,
        content: composeReminderContent(channel, body, replacements, cdEvaluation),
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
    from: settings.senderEmail || settings.smtpFrom,
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
      channel: log.channel,
      dealerCode: log.dealerCode,
      billAgeDays: log.billAgeDays
    })
  });

  if (!response.ok) {
    throw new Error(`Webhook failed with status ${response.status}.`);
  }
}

function resolveTwilioCredentials(
  settings: DispatchSettings,
  channel: "sms" | "whatsapp"
) {
  if (channel === "whatsapp") {
    return {
      accountSid:
        settings.whatsappAccountSid ||
        settings.whatsappApiKey ||
        settings.smsAccountSid ||
        settings.smsApiKey ||
        process.env.TWILIO_ACCOUNT_SID ||
        "",
      authToken:
        settings.whatsappAuthToken ||
        settings.whatsappApiSecret ||
        settings.smsAuthToken ||
        settings.smsApiSecret ||
        process.env.TWILIO_AUTH_TOKEN ||
        ""
    };
  }

  return {
    accountSid:
      settings.smsAccountSid ||
      settings.smsApiKey ||
      settings.whatsappAccountSid ||
      settings.whatsappApiKey ||
      process.env.TWILIO_ACCOUNT_SID ||
      "",
    authToken:
      settings.smsAuthToken ||
      settings.smsApiSecret ||
      settings.whatsappAuthToken ||
      settings.whatsappApiSecret ||
      process.env.TWILIO_AUTH_TOKEN ||
      ""
  };
}

async function sendTwilioMessage(
  from: string,
  to: string,
  body: string,
  channelLabel: string,
  settings: DispatchSettings,
  channel: "sms" | "whatsapp"
) {
  const { accountSid, authToken } = resolveTwilioCredentials(settings, channel);

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
    "SMS",
    settings,
    "sms"
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
    "WhatsApp",
    settings,
    "whatsapp"
  );
}

async function deliverReminder(log: ReminderLog, settings: DispatchSettings) {
  if (settings.simulateMode) {
    return "simulated" as const;
  }

  if (log.channel === "email") {
    if (!settings.smtpHost || !(settings.senderEmail || settings.smtpFrom)) {
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
    const user = database.users.find((entry) => entry.id === ownerId);
    if (!user) {
      throw new Error("The current user could not be found.");
    }

    const workspace = getCompanyWorkspaceContext(database, user.companyName);
    const settings = database.dispatchSettings.find(
      (entry) => entry.ownerId === workspace.configOwnerId
    );
    if (!settings) {
      throw new Error("Dispatch settings are missing.");
    }
    const resolvedSettings = resolveDispatchSettings(settings);

    const logs = database.reminderLogs.filter(
      (entry) =>
        workspace.sharedOwnerIds.has(entry.ownerId) &&
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
