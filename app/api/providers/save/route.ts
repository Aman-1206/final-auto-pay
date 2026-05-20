import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { updateDatabase } from "@/lib/storage";

export async function POST(request: Request) {
  const user = await requireUser();
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
      smtpFrom: String(formData.get("smtpFrom") || "").trim(),
      smsFromNumber: String(formData.get("smsFromNumber") || "").trim(),
      whatsappFromNumber: String(formData.get("whatsappFromNumber") || "").trim(),
      whatsappWebhookUrl: existing?.whatsappWebhookUrl || "",
      updatedAt: new Date().toISOString()
    };

    if (existing) {
      Object.assign(existing, nextValues);
    } else {
      database.dispatchSettings.push(nextValues);
    }
  });

  return NextResponse.redirect(
    new URL("/dashboard/dispatch?message=Dispatch%20settings%20saved.", request.url),
    { status: 303 }
  );
}
