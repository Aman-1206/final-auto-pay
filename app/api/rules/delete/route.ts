import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { getCompanyWorkspaceContextForUser } from "@/lib/company-workspace";
import { updateDatabase } from "@/lib/storage";

export async function POST(request: Request) {
  const user = await requireAdminUser();
  const formData = await request.formData();
  const ruleId = String(formData.get("ruleId") || "");

  await updateDatabase((database) => {
    const workspace = getCompanyWorkspaceContextForUser(database, user);
    const rule = database.reminderRules.find(
      (entry) => entry.id === ruleId && entry.ownerId === workspace.configOwnerId
    );

    database.reminderRules = database.reminderRules.filter(
      (entry) => !(entry.id === ruleId && entry.ownerId === workspace.configOwnerId)
    );

    if (rule) {
      database.templates = database.templates.filter(
        (entry) => !(entry.id === rule.templateId && entry.ownerId === workspace.configOwnerId)
      );
    }
  });

  return NextResponse.redirect(
    new URL("/dashboard/settings?message=Reminder%20rule%20deleted.", request.url),
    { status: 303 }
  );
}
