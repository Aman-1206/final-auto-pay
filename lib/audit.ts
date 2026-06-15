import { randomUUID } from "node:crypto";
import { getCompanyWorkspaceContextForUser } from "@/lib/company-workspace";
import { updateDatabase } from "@/lib/storage";
import type { AuditLog, User } from "@/lib/types";

export async function recordAuditLog(
  user: Pick<User, "id" | "name" | "email" | "role" | "companyName">,
  action: string,
  status: AuditLog["status"],
  details = ""
) {
  await updateDatabase((database) => {
    const workspace = getCompanyWorkspaceContextForUser(database, user);

    database.auditLogs.push({
      id: randomUUID(),
      ownerId: workspace.workspaceId,
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      role: user.role,
      action,
      status,
      details
    });
  });
}
