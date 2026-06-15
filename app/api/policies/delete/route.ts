import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireOperationPassword } from "@/lib/access-control";
import { recordAuditLog } from "@/lib/audit";
import { getCompanyWorkspaceContextForUser } from "@/lib/company-workspace";
import { updateDatabase } from "@/lib/storage";

export async function POST(request: Request) {
  const user = await requireAdminUser();
  const formData = await request.formData();
  const policyId = String(formData.get("policyId") || "");

  try {
    await requireOperationPassword(user, "admin_settings", String(formData.get("operationPassword") || ""));
    await updateDatabase((database) => {
    const workspace = getCompanyWorkspaceContextForUser(database, user);
    database.cashDiscountPolicies = database.cashDiscountPolicies.filter(
      (entry) => !(entry.id === policyId && entry.ownerId === workspace.configOwnerId)
    );
    });
    await recordAuditLog(user, "Admin Settings", "success", `Deleted CD policy ${policyId}.`);

    return NextResponse.redirect(
      new URL("/dashboard/settings/reminders?message=Cash%20discount%20policy%20deleted.", request.url),
      { status: 303 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cash discount policy delete failed.";
    await recordAuditLog(user, "Admin Settings", "failed", message);
    return NextResponse.redirect(
      new URL(`/dashboard/settings/reminders?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    );
  }
}
