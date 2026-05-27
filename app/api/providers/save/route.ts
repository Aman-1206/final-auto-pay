import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { updateDatabase } from "@/lib/storage";

export async function POST(request: Request) {
  const user = await requireAdminUser();
  const formData = await request.formData();

  await updateDatabase((database) => {
    const existing = database.dispatchSettings.find((entry) => entry.ownerId === user.id);
    const nextValues = {
      ownerId: user.id,
      simulateMode: formData.get("simulateMode") === "on",
      smtpHost: String(formData.get("smtpHost") || "").trim(),
      smtpPort: Number(formData.get("smtpPort") || 587),
      smtpSecure: formData.get("smtpSecure") === "on",
      smtpUser: String(formData.get("smtpUser") || "").trim(),
      smtpPass: String(formData.get("smtpPass") || ""),
      senderEmail: String(formData.get("senderEmail") || "").trim(),
      senderMobileNumber: String(formData.get("senderMobileNumber") || "").trim(),
      smtpFrom: String(formData.get("senderEmail") || "").trim(),
      smsProviderName: String(formData.get("smsProviderName") || "Twilio").trim(),
      smsApiKey: String(formData.get("smsApiKey") || "").trim(),
      smsApiSecret: String(formData.get("smsApiSecret") || "").trim(),
      smsAccountSid: String(formData.get("smsAccountSid") || "").trim(),
      smsAuthToken: String(formData.get("smsAuthToken") || "").trim(),
      smsFromNumber: String(formData.get("smsFromNumber") || "").trim(),
      smsSenderId: String(formData.get("smsSenderId") || "").trim(),
      whatsappProviderName: String(formData.get("whatsappProviderName") || "Twilio").trim(),
      whatsappApiKey: String(formData.get("whatsappApiKey") || "").trim(),
      whatsappApiSecret: String(formData.get("whatsappApiSecret") || "").trim(),
      whatsappAccountSid: String(formData.get("whatsappAccountSid") || "").trim(),
      whatsappAuthToken: String(formData.get("whatsappAuthToken") || "").trim(),
      whatsappFromNumber: String(formData.get("whatsappFromNumber") || "").trim(),
      whatsappWebhookUrl: String(formData.get("whatsappWebhookUrl") || "").trim(),
      futureIntegrationNotes: String(formData.get("futureIntegrationNotes") || "").trim(),
      updatedAt: new Date().toISOString()
    };

    if (existing) {
      Object.assign(existing, nextValues);
    } else {
      database.dispatchSettings.push(nextValues);
    }
  });

  return NextResponse.redirect(
    new URL("/dashboard/settings?message=Communication%20settings%20saved.", request.url),
    { status: 303 }
  );
}
