import { NextResponse } from "next/server";
import { canAccessReports, requireOperationPassword } from "@/lib/access-control";
import { requireUser } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { sendDailyActivityReport } from "@/lib/reports";

export async function POST(request: Request) {
  const user = await requireUser();
  const formData = await request.formData();
  const reportDateValue = String(formData.get("reportDate") || "");
  const reportDate = reportDateValue ? new Date(reportDateValue) : new Date();

  try {
    if (!canAccessReports(user)) {
      throw new Error("Report access denied.");
    }
    await requireOperationPassword(user, "report_generation", String(formData.get("operationPassword") || ""));

    const result = await sendDailyActivityReport(user, reportDate);
    await recordAuditLog(
      user,
      "Report Generation",
      "success",
      `Generated report for ${result.report.date}; recipients: ${result.recipientCount}.`
    );

    return NextResponse.redirect(
      new URL(
        `/dashboard/settings/reports?message=${encodeURIComponent(
          result.skipped
            ? `Report generated for ${result.report.date}. Add report recipients in Email Configuration to send it by email.`
            : `Report sent to ${result.recipientCount} recipient${result.recipientCount === 1 ? "" : "s"}.`
        )}`,
        request.url
      ),
      { status: 303 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Report generation failed.";
    await recordAuditLog(user, "Report Generation", "failed", message);
    return NextResponse.redirect(
      new URL(`/dashboard/settings/reports?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    );
  }
}
