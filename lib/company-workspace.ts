import type { AppDatabase, User } from "@/lib/types";
import { slugify } from "@/lib/utils";

export function getCompanyWorkspaceId(companyName: string) {
  const slug = slugify(companyName || "");
  return `company:${slug || "workspace"}`;
}

export function getCompanyUsers(database: AppDatabase, companyName: string) {
  const normalized = companyName.trim().toLowerCase();
  return database.users.filter((entry) => entry.companyName.trim().toLowerCase() === normalized);
}

export function getCompanyWorkspaceContext(database: AppDatabase, companyName: string) {
  const workspaceId = getCompanyWorkspaceId(companyName);
  const companyUsers = getCompanyUsers(database, companyName).sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt)
  );
  const adminUser =
    companyUsers.find((entry) => entry.role === "admin") ||
    companyUsers[0] ||
    null;
  const sharedOwnerIds = new Set<string>([workspaceId, ...companyUsers.map((entry) => entry.id)]);
  const configOwnerId = adminUser?.id || workspaceId;

  return {
    workspaceId,
    companyUsers,
    adminUser,
    configOwnerId,
    sharedOwnerIds
  };
}

export function isSharedCompanyRecord(ownerId: string, sharedOwnerIds: Set<string>) {
  return sharedOwnerIds.has(ownerId);
}

export function filterSharedCompanyRecords<T extends { ownerId: string }>(
  entries: T[],
  sharedOwnerIds: Set<string>
) {
  return entries.filter((entry) => isSharedCompanyRecord(entry.ownerId, sharedOwnerIds));
}

export function getCompanyWorkspaceContextForUser(database: AppDatabase, user: Pick<User, "companyName">) {
  return getCompanyWorkspaceContext(database, user.companyName);
}
