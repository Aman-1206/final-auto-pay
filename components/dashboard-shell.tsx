import type { ReactNode } from "react";
import { DashboardClientShell } from "@/components/dashboard-client-shell";

export function DashboardShell({
  children,
  title,
  description,
  companyName,
  userName
}: {
  children: ReactNode;
  title: string;
  description: string;
  companyName: string;
  userName: string;
}) {
  return (
    <DashboardClientShell
      title={title}
      description={description}
      companyName={companyName}
      userName={userName}
    >
      {children}
    </DashboardClientShell>
  );
}
