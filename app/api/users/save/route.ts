import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/access-control";
import { hashPassword, isSuperAdminAccessEmail } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { updateDatabase } from "@/lib/storage";
import type { UserRole } from "@/lib/types";

function normalizeRole(value: FormDataEntryValue | null): UserRole {
  return value === "super_admin" || value === "admin" ? value : "user";
}

export async function POST(request: Request) {
  const user = await requireSuperAdminUser();
  const formData = await request.formData();
  const userId = String(formData.get("userId") || "");
  const password = String(formData.get("password") || "");
  const payload = {
    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim().toLowerCase(),
    role: normalizeRole(formData.get("role")),
    canSendManualReminders: formData.get("canSendManualReminders") === "on"
  };

  if (isSuperAdminAccessEmail(payload.email)) {
    payload.role = "super_admin";
    payload.canSendManualReminders = true;
  }

  if (!payload.name || !payload.email) {
    return NextResponse.redirect(
      new URL("/dashboard/settings/users?error=Name%20and%20email%20are%20required.", request.url),
      { status: 303 }
    );
  }

  try {
    await updateDatabase((database) => {
      const duplicate = database.users.find(
        (entry) => entry.email === payload.email && entry.id !== userId
      );

      if (duplicate) {
        throw new Error("A user with this email already exists.");
      }

      const existing = database.users.find(
        (entry) => entry.id === userId && entry.companyName === user.companyName
      );
      const now = new Date().toISOString();

      if (password.trim() && password.trim().length < 8) {
        throw new Error("Password must be at least 8 characters long.");
      }

      if (existing) {
        const companySuperAdmins = database.users.filter(
          (entry) => entry.companyName === user.companyName && entry.role === "super_admin"
        );

        if (
          existing.role === "super_admin" &&
          payload.role !== "super_admin" &&
          companySuperAdmins.length <= 1
        ) {
          throw new Error("At least one Super Admin is required.");
        }

        existing.name = payload.name;
        existing.email = payload.email;
        existing.role = payload.role;
        existing.canSendManualReminders = payload.canSendManualReminders;
        existing.updatedAt = now;
        if (password.trim()) {
          existing.passwordHash = hashPassword(password);
        }
        return;
      }

      if (!password.trim()) {
        throw new Error("Password is required for new users.");
      }

      database.users.push({
        id: randomUUID(),
        name: payload.name,
        email: payload.email,
        companyName: user.companyName,
        passwordHash: hashPassword(password),
        role: payload.role,
        canSendManualReminders: payload.canSendManualReminders,
        createdAt: now,
        updatedAt: now
      });
    });
    await recordAuditLog(user, userId ? "User Update" : "User Creation", "success", payload.email);

    return NextResponse.redirect(
      new URL("/dashboard/settings/users?message=User%20saved.", request.url),
      { status: 303 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "User save failed.";
    await recordAuditLog(user, userId ? "User Update" : "User Creation", "failed", message);
    return NextResponse.redirect(
      new URL(`/dashboard/settings/users?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    );
  }
}
