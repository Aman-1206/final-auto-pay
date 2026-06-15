import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canUploadMasterDatabase, requireOperationPassword } from "@/lib/access-control";
import { recordAuditLog } from "@/lib/audit";
import { getCompanyWorkspaceId } from "@/lib/company-workspace";
import { parseWorkbook, readStoredWorkbookRows, writeStoredWorkbookRows } from "@/lib/excel";
import { syncStoredMasterWorkbook } from "@/lib/workbook-sync";

export async function POST(request: Request) {
  const user = await requireUser();
  const workspaceId = getCompanyWorkspaceId(user.companyName);
  const formData = await request.formData();
  const file = formData.get("file");
  const mode = String(formData.get("mode") || "replace");
  const operationPassword = String(formData.get("operationPassword") || "");

  if (!canUploadMasterDatabase(user)) {
    await recordAuditLog(user, "Database Upload", "failed", "Master upload denied by role.");
    return NextResponse.redirect(
      new URL("/dashboard/master?error=Admin%20access%20required.", request.url),
      { status: 303 }
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.redirect(
      new URL("/dashboard/master?error=Please%20upload%20a%20valid%20master%20file.", request.url),
      { status: 303 }
    );
  }

  try {
    await requireOperationPassword(user, "master_upload", operationPassword);
    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseWorkbook(buffer, "master");
    const existingRows =
      mode === "append"
        ? await readStoredWorkbookRows(workspaceId, "master")
            .then((result) => result.rows)
            .catch(() => [])
        : [];

    await writeStoredWorkbookRows(
      workspaceId,
      "master",
      mode === "append" ? [...existingRows, ...rows] : rows
    );

    const result = await syncStoredMasterWorkbook(workspaceId, user.companyName);
    await recordAuditLog(user, "Database Upload", "success", `Master upload saved ${result.recordCount} rows.`);

    return NextResponse.redirect(
      new URL(
        `/dashboard/master?message=${encodeURIComponent(
          `Saved ${result.recordCount} master contact rows. No reminders were generated or sent automatically.`
        )}`,
        request.url
      ),
      { status: 303 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Master import failed.";
    await recordAuditLog(user, "Database Upload", "failed", message);
    return NextResponse.redirect(
      new URL(`/dashboard/master?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    );
  }
}
