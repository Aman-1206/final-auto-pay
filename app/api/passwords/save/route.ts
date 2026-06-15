import { NextResponse } from "next/server";
import {
  operationPasswordLabels,
  requireOperationPassword,
  requireSuperAdminUser,
  saveOperationPasswords
} from "@/lib/access-control";
import { recordAuditLog } from "@/lib/audit";
import type { OperationPasswordKey } from "@/lib/types";

export async function POST(request: Request) {
  const user = await requireSuperAdminUser();
  const formData = await request.formData();

  try {
    await requireOperationPassword(user, "admin_settings", String(formData.get("operationPassword") || ""));
    const values = Object.keys(operationPasswordLabels).reduce((payload, key) => {
      payload[key as OperationPasswordKey] = String(formData.get(key) || "");
      return payload;
    }, {} as Partial<Record<OperationPasswordKey, string>>);

    await saveOperationPasswords(user, values);
    await recordAuditLog(user, "Password Changes", "success", "Operation passwords updated.");

    return NextResponse.redirect(
      new URL("/dashboard/settings/passwords?message=Passwords%20updated.", request.url),
      { status: 303 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Password update failed.";
    await recordAuditLog(user, "Password Changes", "failed", message);
    return NextResponse.redirect(
      new URL(`/dashboard/settings/passwords?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    );
  }
}
