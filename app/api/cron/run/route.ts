import { NextResponse } from "next/server";
import { generateRemindersForUser, sendPendingReminders } from "@/lib/reminder-engine";
import { readDatabase } from "@/lib/storage";

export async function POST(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const providedSecret =
    request.headers.get("x-cron-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (configuredSecret && providedSecret !== configuredSecret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const database = await readDatabase();
  const users = database.users;
  const summary: Array<{ email: string; generated: number; processed: number }> = [];

  for (const user of users) {
    const generated = await generateRemindersForUser(user.id);
    const autoSendRuleIds = database.reminderRules
      .filter((entry) => entry.ownerId === user.id && entry.enabled && entry.autoSend)
      .map((entry) => entry.id);
    const processed =
      autoSendRuleIds.length > 0 ? (await sendPendingReminders(user.id, autoSendRuleIds)).length : 0;

    summary.push({
      email: user.email,
      generated: generated.length,
      processed
    });
  }

  return NextResponse.json({ ok: true, summary });
}
