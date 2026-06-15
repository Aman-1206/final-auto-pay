import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canUploadDueDatabase, requireOperationPassword } from "@/lib/access-control";
import { recordAuditLog } from "@/lib/audit";
import { getCompanyWorkspaceId } from "@/lib/company-workspace";
import { parseWorkbook, readStoredWorkbookRows, writeStoredWorkbookRows } from "@/lib/excel";
import { syncStoredDueWorkbook } from "@/lib/workbook-sync";

export async function POST(request: Request) {
  const user = await requireUser();
  const workspaceId = getCompanyWorkspaceId(user.companyName);
  const formData = await request.formData();
  const file = formData.get("file");
  const mode = String(formData.get("mode") || "replace");
  const operationPassword = String(formData.get("operationPassword") || "");

  if (!canUploadDueDatabase(user)) {
    await recordAuditLog(user, "Database Upload", "failed", "Due upload denied by role.");
    return NextResponse.redirect(
      new URL("/dashboard/dues?error=Due%20upload%20access%20denied.", request.url),
      { status: 303 }
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.redirect(
      new URL("/dashboard/dues?error=Please%20upload%20a%20valid%20dues%20file.", request.url),
      { status: 303 }
    );
  }

  try {
    await requireOperationPassword(user, "due_upload", operationPassword);
    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseWorkbook(buffer, "due");
    const existingRows =
      mode === "append"
        ? await readStoredWorkbookRows(workspaceId, "due")
            .then((result) => result.rows)
            .catch(() => [])
        : [];

    await writeStoredWorkbookRows(
      workspaceId,
      "due",
      mode === "append" ? [...existingRows, ...rows] : rows
    );

    const result = await syncStoredDueWorkbook(workspaceId, user.companyName);
    await recordAuditLog(user, "Database Upload", "success", `Due upload saved ${result.recordCount} rows.`);

    return NextResponse.redirect(
      new URL(
        `/dashboard/dues?message=${encodeURIComponent(
          `Saved ${result.recordCount} due records. No reminders were sent automatically. Generate and send eligible reminders when you are ready.`
        )}`,
        request.url
      ),
      { status: 303 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dues import failed.";
    await recordAuditLog(user, "Database Upload", "failed", message);
    return NextResponse.redirect(
      new URL(`/dashboard/dues?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    );
  }
}
