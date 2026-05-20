import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createManualRemindersForDue, sendPendingReminders } from "@/lib/reminder-engine";

export async function POST(request: Request) {
  const user = await requireUser();
  const formData = await request.formData();
  const dueId = String(formData.get("dueId") || "").trim();
  const ruleId = String(formData.get("ruleId") || "").trim();
  const selectedChannels = {
    email: formData.get("channelEmail") === "on",
    whatsapp: formData.get("channelWhatsapp") === "on",
    sms: formData.get("channelSms") === "on"
  };
  const hasChannelOverride =
    selectedChannels.email || selectedChannels.whatsapp || selectedChannels.sms;

  try {
    if (dueId && ruleId) {
      const created = await createManualRemindersForDue(
        user.id,
        dueId,
        ruleId,
        hasChannelOverride ? selectedChannels : undefined
      );
      const logs = await sendPendingReminders(
        user.id,
        undefined,
        created.map((entry) => entry.id)
      );

      return NextResponse.redirect(
        new URL(
          `/dashboard/dispatch?message=${encodeURIComponent(
            `Sent ${logs.length} manual reminder${logs.length === 1 ? "" : "s"} for the selected invoice.`
          )}`,
          request.url
        ),
        { status: 303 }
      );
    }

    const logs = await sendPendingReminders(user.id);
    return NextResponse.redirect(
      new URL(
        `/dashboard/dispatch?message=${encodeURIComponent(`Processed ${logs.length} pending reminders.`)}`,
        request.url
      ),
      { status: 303 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sending reminders failed.";
    return NextResponse.redirect(
      new URL(`/dashboard/dispatch?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    );
  }
}
