import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/access-control";
import { recordAuditLog } from "@/lib/audit";
import { updateDatabase } from "@/lib/storage";

export async function POST(request: Request) {
  const user = await requireSuperAdminUser();
  const formData = await request.formData();
  const userId = String(formData.get("userId") || "");

  try {
    if (userId === user.id) {
      throw new Error("You cannot delete your own account.");
    }

    await updateDatabase((database) => {
      const target = database.users.find(
        (entry) => entry.id === userId && entry.companyName === user.companyName
      );

      if (!target) {
        throw new Error("User was not found.");
      }

      const companySuperAdmins = database.users.filter(
        (entry) => entry.companyName === user.companyName && entry.role === "super_admin"
      );

      if (target.role === "super_admin" && companySuperAdmins.length <= 1) {
        throw new Error("At least one Super Admin is required.");
      }

      database.users = database.users.filter(
        (entry) => !(entry.id === userId && entry.companyName === user.companyName)
      );
      database.sessions = database.sessions.filter((entry) => entry.userId !== userId);
    });
    await recordAuditLog(user, "User Deletion", "success", userId);

    return NextResponse.redirect(
      new URL("/dashboard/settings/users?message=User%20deleted.", request.url),
      { status: 303 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "User delete failed.";
    await recordAuditLog(user, "User Deletion", "failed", message);
    return NextResponse.redirect(
      new URL(`/dashboard/settings/users?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    );
  }
}
