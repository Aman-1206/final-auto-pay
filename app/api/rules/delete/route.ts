import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { updateDatabase } from "@/lib/storage";

export async function POST(request: Request) {
  const user = await requireAdminUser();
  const formData = await request.formData();
  const ruleId = String(formData.get("ruleId") || "");

  await updateDatabase((database) => {
    const rule = database.reminderRules.find(
      (entry) => entry.id === ruleId && entry.ownerId === user.id
    );

    database.reminderRules = database.reminderRules.filter(
      (entry) => !(entry.id === ruleId && entry.ownerId === user.id)
    );

    if (rule) {
      database.templates = database.templates.filter(
        (entry) => !(entry.id === rule.templateId && entry.ownerId === user.id)
      );
    }
  });

  return NextResponse.redirect(
    new URL("/dashboard/settings?message=Reminder%20rule%20deleted.", request.url),
    { status: 303 }
  );
}
