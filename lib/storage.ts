import { readFile } from "node:fs/promises";
import path from "node:path";
import { getMongoDatabase } from "@/lib/mongodb";
import type { AppDatabase } from "@/lib/types";

const dbPath = path.join(process.cwd(), "data", "app-db.json");
const collectionName = process.env.MONGODB_COLLECTION || "app_state";
const documentId = "primary";

const defaultDatabase: AppDatabase = {
  users: [],
  sessions: [],
  authEvents: [],
  masterContacts: [],
  dueRecords: [],
  reminderRules: [],
  templates: [],
  dispatchSettings: [],
  cashDiscountPolicies: [],
  reminderLogs: []
};

type StoredDatabaseDocument = AppDatabase & {
  _id: string;
  migratedFromFileAt?: string;
  updatedAt: string;
};

function toStringValue(value: unknown) {
  return typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
}

function toNumberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBooleanValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : value === "true" ? true : value === "false" ? false : fallback;
}

function normalizeDatabase(input: Partial<AppDatabase> | null | undefined): AppDatabase {
  const source = input || {};

  return {
    users: Array.isArray(source.users)
      ? source.users.map((user, index) => ({
          id: toStringValue(user?.id),
          name: toStringValue(user?.name),
          email: toStringValue(user?.email).toLowerCase(),
          companyName: toStringValue(user?.companyName),
          passwordHash: toStringValue(user?.passwordHash),
          role: user?.role === "user" ? "user" : user?.role === "admin" ? "admin" : index === 0 ? "admin" : "user",
          createdAt: toStringValue(user?.createdAt)
        }))
      : [],
    sessions: Array.isArray(source.sessions)
      ? source.sessions.map((session) => ({
          token: toStringValue(session?.token),
          userId: toStringValue(session?.userId),
          ipAddress: toStringValue(session?.ipAddress),
          userAgent: toStringValue(session?.userAgent),
          lastSeenAt: toStringValue(session?.lastSeenAt || session?.createdAt),
          createdAt: toStringValue(session?.createdAt),
          expiresAt: toStringValue(session?.expiresAt)
        }))
      : [],
    authEvents: Array.isArray(source.authEvents)
      ? source.authEvents.map((event) => ({
          id: toStringValue(event?.id),
          userId: toStringValue(event?.userId),
          userEmail: toStringValue(event?.userEmail),
          userName: toStringValue(event?.userName),
          companyName: toStringValue(event?.companyName),
          userRole: event?.userRole === "admin" ? "admin" : "user",
          type: event?.type === "logout" ? "logout" : "login",
          sessionTokenSuffix: toStringValue(event?.sessionTokenSuffix),
          ipAddress: toStringValue(event?.ipAddress),
          userAgent: toStringValue(event?.userAgent),
          createdAt: toStringValue(event?.createdAt)
        }))
      : [],
    masterContacts: Array.isArray(source.masterContacts)
      ? source.masterContacts.map((contact) => {
          const dealerCode = toStringValue(contact?.dealerCode || contact?.customerCode);
          return {
            id: toStringValue(contact?.id),
            ownerId: toStringValue(contact?.ownerId),
            dealerCode,
            customerCode: dealerCode,
            companyName: toStringValue(contact?.companyName),
            primaryContact: toStringValue(contact?.primaryContact),
            email: toStringValue(contact?.email),
            whatsapp: toStringValue(contact?.whatsapp),
            sms: toStringValue(contact?.sms),
            alternateContact: toStringValue(contact?.alternateContact),
            notes: toStringValue(contact?.notes),
            importedAt: toStringValue(contact?.importedAt),
            raw:
              contact?.raw && typeof contact.raw === "object"
                ? Object.fromEntries(
                    Object.entries(contact.raw as Record<string, unknown>).map(([key, value]) => [
                      key,
                      toStringValue(value)
                    ])
                  )
                : {}
          };
        })
      : [],
        dueRecords: Array.isArray(source.dueRecords)
      ? source.dueRecords.map((record) => {
          const dealerCode = toStringValue(record?.dealerCode || record?.customerCode);
          const billDate = toStringValue(record?.billDate || record?.invoiceDate);
          return {
            id: toStringValue(record?.id),
            ownerId: toStringValue(record?.ownerId),
            dealerCode,
            customerCode: dealerCode,
            companyName: toStringValue(record?.companyName),
            billDate,
            invoiceNumber: toStringValue(record?.invoiceNumber),
            invoiceDate: billDate,
            dueDate: toStringValue(record?.dueDate),
            openingAmount: toNumberValue((record as Record<string, unknown>)?.openingAmount),
            amount: toNumberValue(record?.amount),
            currency: toStringValue(record?.currency) || "INR",
            overdueDays: toNumberValue((record as Record<string, unknown>)?.overdueDays, 0),
            reference: toStringValue(record?.reference),
            notes: toStringValue(record?.notes),
            matchedContactId: toStringValue(record?.matchedContactId),
            matchedContactName: toStringValue(record?.matchedContactName),
            matchedEmail: toStringValue(record?.matchedEmail),
            matchedWhatsapp: toStringValue(record?.matchedWhatsapp),
            matchedSms: toStringValue(record?.matchedSms),
            contactMatchStatus: record?.contactMatchStatus === "matched" ? "matched" : "missing",
            importedAt: toStringValue(record?.importedAt),
            raw:
              record?.raw && typeof record.raw === "object"
                ? Object.fromEntries(
                    Object.entries(record.raw as Record<string, unknown>).map(([key, value]) => [
                      key,
                      toStringValue(value)
                    ])
                  )
                : {}
          };
        })
      : [],
    reminderRules: Array.isArray(source.reminderRules)
      ? source.reminderRules.map((rule) => {
          const legacyRule = rule as Record<string, unknown>;
          return ({
          id: toStringValue(rule?.id),
          ownerId: toStringValue(rule?.ownerId),
          name: toStringValue(rule?.name),
          triggerDay: toNumberValue(rule?.triggerDay ?? legacyRule.daysBeforeDue),
          enabled: toBooleanValue(rule?.enabled, true),
          autoSend: toBooleanValue(rule?.autoSend, false),
          channels: {
            email: toBooleanValue(rule?.channels?.email, true),
            whatsapp: toBooleanValue(rule?.channels?.whatsapp, true),
            sms: toBooleanValue(rule?.channels?.sms, false)
          },
          templateId: toStringValue(rule?.templateId),
          createdAt: toStringValue(rule?.createdAt),
          updatedAt: toStringValue(rule?.updatedAt)
          });
        })
      : [],
    templates: Array.isArray(source.templates)
      ? source.templates.map((template) => ({
          id: toStringValue(template?.id),
          ownerId: toStringValue(template?.ownerId),
          ruleId: toStringValue(template?.ruleId),
          name: toStringValue(template?.name),
          emailSubject: toStringValue(template?.emailSubject),
          emailBody: toStringValue(template?.emailBody),
          whatsappBody: toStringValue(template?.whatsappBody),
          smsBody: toStringValue(template?.smsBody),
          updatedAt: toStringValue(template?.updatedAt)
        }))
      : [],
    dispatchSettings: Array.isArray(source.dispatchSettings)
      ? source.dispatchSettings.map((settings) => ({
          ownerId: toStringValue(settings?.ownerId),
          simulateMode: toBooleanValue(settings?.simulateMode, true),
          smtpHost: toStringValue(settings?.smtpHost),
          smtpPort: toNumberValue(settings?.smtpPort, 587),
          smtpSecure: toBooleanValue(settings?.smtpSecure, false),
          smtpUser: toStringValue(settings?.smtpUser),
          smtpPass: toStringValue(settings?.smtpPass),
          senderEmail: toStringValue(settings?.senderEmail || settings?.smtpFrom),
          senderMobileNumber: toStringValue(settings?.senderMobileNumber),
          smtpFrom: toStringValue(settings?.smtpFrom || settings?.senderEmail),
          smsProviderName: toStringValue(settings?.smsProviderName) || "Twilio",
          smsApiKey: toStringValue(settings?.smsApiKey),
          smsApiSecret: toStringValue(settings?.smsApiSecret),
          smsAccountSid: toStringValue(settings?.smsAccountSid),
          smsAuthToken: toStringValue(settings?.smsAuthToken),
          smsFromNumber: toStringValue(settings?.smsFromNumber),
          smsSenderId: toStringValue(settings?.smsSenderId),
          whatsappProviderName: toStringValue(settings?.whatsappProviderName) || "Twilio",
          whatsappApiKey: toStringValue(settings?.whatsappApiKey),
          whatsappApiSecret: toStringValue(settings?.whatsappApiSecret),
          whatsappAccountSid: toStringValue(settings?.whatsappAccountSid),
          whatsappAuthToken: toStringValue(settings?.whatsappAuthToken),
          whatsappFromNumber: toStringValue(settings?.whatsappFromNumber),
          whatsappWebhookUrl: toStringValue(settings?.whatsappWebhookUrl),
          futureIntegrationNotes: toStringValue(settings?.futureIntegrationNotes),
          updatedAt: toStringValue(settings?.updatedAt)
        }))
      : [],
    cashDiscountPolicies: Array.isArray(source.cashDiscountPolicies)
      ? source.cashDiscountPolicies.map((policy) => ({
          id: toStringValue(policy?.id),
          ownerId: toStringValue(policy?.ownerId),
          name: toStringValue(policy?.name),
          paymentWindowDays: toNumberValue(policy?.paymentWindowDays),
          discountPercent: toNumberValue(policy?.discountPercent),
          enabled: toBooleanValue(policy?.enabled, true),
          description: toStringValue(policy?.description),
          createdAt: toStringValue(policy?.createdAt),
          updatedAt: toStringValue(policy?.updatedAt)
        }))
      : [],
    reminderLogs: Array.isArray(source.reminderLogs)
      ? source.reminderLogs.map((log) => ({
          id: toStringValue(log?.id),
          ownerId: toStringValue(log?.ownerId),
          dueId: toStringValue(log?.dueId),
          dedupeKey: toStringValue(log?.dedupeKey),
          contactId: toStringValue(log?.contactId),
          ruleId: toStringValue(log?.ruleId),
          templateId: toStringValue(log?.templateId),
          dealerCode: toStringValue(log?.dealerCode),
          invoiceNumber: toStringValue(log?.invoiceNumber),
          reminderDay: toNumberValue(log?.reminderDay),
          billAgeDays: toNumberValue(log?.billAgeDays),
          cdEligible: toBooleanValue(log?.cdEligible, false),
          cdPolicyId: toStringValue(log?.cdPolicyId),
          cdDiscountPercent: toNumberValue(log?.cdDiscountPercent),
          cdReason: toStringValue(log?.cdReason),
          channel:
            log?.channel === "sms" || log?.channel === "whatsapp" ? log.channel : "email",
          recipient: toStringValue(log?.recipient),
          scheduledFor: toStringValue(log?.scheduledFor),
          status:
            log?.status === "sent" ||
            log?.status === "failed" ||
            log?.status === "simulated"
              ? log.status
              : "pending",
          subject: toStringValue(log?.subject),
          content: toStringValue(log?.content),
          failureReason: toStringValue(log?.failureReason),
          sentAt: toStringValue(log?.sentAt),
          createdAt: toStringValue(log?.createdAt)
        }))
      : []
  };
}

async function readLegacyFileDatabase() {
  try {
    const raw = await readFile(dbPath, "utf8");
    return JSON.parse(raw) as AppDatabase;
  } catch {
    return null;
  }
}

async function ensureDatabaseDocument() {
  const database = await getMongoDatabase();
  const collection = database.collection<StoredDatabaseDocument>(collectionName);
  const existing = await collection.findOne({ _id: documentId });

  if (existing) {
    return collection;
  }

  const legacyDatabase = await readLegacyFileDatabase();

  await collection.insertOne({
    _id: documentId,
    ...(legacyDatabase || defaultDatabase),
    migratedFromFileAt: legacyDatabase ? new Date().toISOString() : undefined,
    updatedAt: new Date().toISOString()
  });

  return collection;
}

export async function readDatabase() {
  const collection = await ensureDatabaseDocument();
  const document = await collection.findOne({ _id: documentId });

  if (!document) {
    throw new Error("MongoDB app state document was not found.");
  }

  const { _id, migratedFromFileAt, updatedAt, ...appDatabase } = document;
  return normalizeDatabase(appDatabase);
}

export async function writeDatabase(database: AppDatabase) {
  const collection = await ensureDatabaseDocument();
  const normalized = normalizeDatabase(database);

  await collection.updateOne(
    { _id: documentId },
    {
      $set: {
        ...normalized,
        updatedAt: new Date().toISOString()
      }
    },
    { upsert: true }
  );
}

export async function updateDatabase<T>(updater: (database: AppDatabase) => T | Promise<T>) {
  const database = await readDatabase();
  const result = await updater(database);
  await writeDatabase(database);
  return result;
}
