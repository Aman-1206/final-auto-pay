import type { DispatchSettings } from "@/lib/types";

function toBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === "true";
}

export function isE164PhoneNumber(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(value.trim());
}

type PartialDispatchSettings = Partial<DispatchSettings> & Pick<DispatchSettings, "ownerId">;

export function resolveDispatchSettings(
  settings: PartialDispatchSettings | null | undefined
): DispatchSettings {
  const savedSenderEmail = (settings?.senderEmail || settings?.smtpFrom || "").trim();
  const savedSmsFromNumber = (settings?.smsFromNumber || "").trim();
  const legacySmsSenderId = (settings?.smsSenderId || "").trim();
  const envSmsFromNumber = (process.env.TWILIO_FROM_NUMBER || "").trim();
  const smsFromNumber =
    [
      savedSmsFromNumber,
      envSmsFromNumber,
      isE164PhoneNumber(legacySmsSenderId) ? legacySmsSenderId : ""
    ].find((value) => value !== "") || "";

  return {
    ownerId: settings?.ownerId || "",
    simulateMode: settings?.simulateMode ?? toBoolean(process.env.REMINDER_SIMULATE_MODE, true),
    smtpHost: settings?.smtpHost || process.env.SMTP_HOST || "",
    smtpPort: settings?.smtpPort || Number(process.env.SMTP_PORT || 587),
    smtpSecure: settings?.smtpSecure ?? toBoolean(process.env.SMTP_SECURE, false),
    smtpUser: settings?.smtpUser || process.env.SMTP_USER || "",
    smtpPass: settings?.smtpPass || process.env.SMTP_PASS || "",
    senderEmail: savedSenderEmail || process.env.SMTP_FROM || "",
    senderMobileNumber: settings?.senderMobileNumber || "",
    smtpFrom: savedSenderEmail || process.env.SMTP_FROM || "",
    smsProviderName: settings?.smsProviderName || "Twilio",
    smsApiKey: settings?.smsApiKey || process.env.TWILIO_ACCOUNT_SID || "",
    smsApiSecret: settings?.smsApiSecret || process.env.TWILIO_AUTH_TOKEN || "",
    smsAccountSid:
      settings?.smsAccountSid ||
      settings?.smsApiKey ||
      process.env.TWILIO_ACCOUNT_SID ||
      "",
    smsAuthToken:
      settings?.smsAuthToken ||
      settings?.smsApiSecret ||
      process.env.TWILIO_AUTH_TOKEN ||
      "",
    smsFromNumber,
    smsSenderId: settings?.smsSenderId || "",
    whatsappProviderName: settings?.whatsappProviderName || "Twilio",
    whatsappApiKey: settings?.whatsappApiKey || process.env.TWILIO_ACCOUNT_SID || "",
    whatsappApiSecret: settings?.whatsappApiSecret || process.env.TWILIO_AUTH_TOKEN || "",
    whatsappAccountSid:
      settings?.whatsappAccountSid ||
      settings?.whatsappApiKey ||
      settings?.smsAccountSid ||
      settings?.smsApiKey ||
      process.env.TWILIO_ACCOUNT_SID ||
      "",
    whatsappAuthToken:
      settings?.whatsappAuthToken ||
      settings?.whatsappApiSecret ||
      settings?.smsAuthToken ||
      settings?.smsApiSecret ||
      process.env.TWILIO_AUTH_TOKEN ||
      "",
    whatsappFromNumber:
      settings?.whatsappFromNumber || process.env.TWILIO_WHATSAPP_FROM_NUMBER || "",
    whatsappWebhookUrl: settings?.whatsappWebhookUrl || process.env.WHATSAPP_WEBHOOK_URL || "",
    futureIntegrationNotes: settings?.futureIntegrationNotes || "",
    updatedAt: settings?.updatedAt || new Date().toISOString()
  };
}
