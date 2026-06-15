import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireOperationPassword } from "@/lib/access-control";
import { recordAuditLog } from "@/lib/audit";
import { getCompanyWorkspaceContextForUser } from "@/lib/company-workspace";
import { updateDatabase } from "@/lib/storage";

export async function POST(request: Request) {
  const user = await requireAdminUser();
  const formData = await request.formData();
  const ruleId = String(formData.get("ruleId") || "");

  try {
    await requireOperationPassword(user, "admin_settings", String(formData.get("operationPassword") || ""));
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
    await recordAuditLog(user, "Template Changes", "success", `Deleted reminder rule ${ruleId}.`);

    return NextResponse.redirect(
      new URL("/dashboard/settings/templates?message=Reminder%20rule%20deleted.", request.url),
      { status: 303 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reminder rule delete failed.";
    await recordAuditLog(user, "Template Changes", "failed", message);
    return NextResponse.redirect(
      new URL(`/dashboard/settings/templates?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    );
  }
}
