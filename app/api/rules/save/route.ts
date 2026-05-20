import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { updateDatabase } from "@/lib/storage";

export async function POST(request: Request) {
  const user = await requireUser();
  const formData = await request.formData();
  const ruleId = String(formData.get("ruleId") || "");
  const templateId = String(formData.get("templateId") || "");
  const now = new Date().toISOString();

  const payload = {
    name: String(formData.get("name") || "").trim(),
    daysBeforeDue: Number(formData.get("daysBeforeDue") || 0),
    enabled: formData.get("enabled") === "on",
    autoSend: formData.get("autoSend") === "on",
    channels: {
      email: formData.get("channelEmail") === "on",
      whatsapp: formData.get("channelWhatsapp") === "on",
      sms: formData.get("channelSms") === "on"
    },
    emailSubject: String(formData.get("emailSubject") || "").trim(),
    emailBody: String(formData.get("emailBody") || "").trim(),
    whatsappBody: String(formData.get("whatsappBody") || "").trim(),
    smsBody: String(formData.get("smsBody") || "").trim()
  };

  if (!payload.name || !payload.daysBeforeDue || !payload.emailSubject) {
    return NextResponse.redirect(
      new URL("/dashboard/rules?error=Please%20fill%20the%20rule%20details.", request.url),
      { status: 303 }
    );
  }

  await updateDatabase((database) => {
    const finalRuleId = ruleId || randomUUID();
    const finalTemplateId = templateId || randomUUID();

    const rule = database.reminderRules.find(
      (entry) => entry.id === finalRuleId && entry.ownerId === user.id
    );

    if (rule) {
      rule.name = payload.name;
      rule.daysBeforeDue = payload.daysBeforeDue;
      rule.enabled = payload.enabled;
      rule.autoSend = payload.autoSend;
      rule.channels = payload.channels;
      rule.updatedAt = now;
    } else {
      database.reminderRules.push({
        id: finalRuleId,
        ownerId: user.id,
        name: payload.name,
        daysBeforeDue: payload.daysBeforeDue,
        enabled: payload.enabled,
        autoSend: payload.autoSend,
        channels: payload.channels,
        templateId: finalTemplateId,
        createdAt: now,
        updatedAt: now
      });
    }

    const template = database.templates.find(
      (entry) => entry.id === finalTemplateId && entry.ownerId === user.id
    );

    if (template) {
      template.name = payload.name;
      template.emailSubject = payload.emailSubject;
      template.emailBody = payload.emailBody;
      template.whatsappBody = payload.whatsappBody;
      template.smsBody = payload.smsBody;
      template.updatedAt = now;
    } else {
      database.templates.push({
        id: finalTemplateId,
        ownerId: user.id,
        ruleId: finalRuleId,
        name: payload.name,
        emailSubject: payload.emailSubject,
        emailBody: payload.emailBody,
        whatsappBody: payload.whatsappBody,
        smsBody: payload.smsBody,
        updatedAt: now
      });
    }
  });

  return NextResponse.redirect(
    new URL("/dashboard/rules?message=Reminder%20rule%20saved%20successfully.", request.url),
    { status: 303 }
  );
}
