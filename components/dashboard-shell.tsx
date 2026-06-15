import type { ReactNode } from "react";
import { DashboardClientShell } from "@/components/dashboard-client-shell";

export function DashboardShell({
  children,
  title,
  description,
  companyName,
  userName,
  isAdmin,
  userRole = "user",
  canSendManualReminders = false
}: {
  children: ReactNode;
  title: string;
  description: string;
  companyName: string;
  userName: string;
  isAdmin: boolean;
  userRole?: "super_admin" | "admin" | "user";
  canSendManualReminders?: boolean;
}) {
  return (
    <DashboardClientShell
      title={title}
      description={description}
      companyName={companyName}
      userName={userName}
      isAdmin={isAdmin}
      userRole={userRole}
      canSendManualReminders={canSendManualReminders}
    >
      {children}
    </DashboardClientShell>
  );
}
