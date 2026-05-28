import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { getCompanyWorkspaceId } from "@/lib/company-workspace";
import { readStoredWorkbookRows } from "@/lib/excel";
import { ensureStoredMasterWorkbook } from "@/lib/workbook-sync";

export async function GET(request: Request) {
  const user = await requireAdminUser();
  const workspaceId = getCompanyWorkspaceId(user.companyName);

  try {
    await ensureStoredMasterWorkbook(workspaceId, user.companyName);
    const { filePath } = await readStoredWorkbookRows(workspaceId, "master");
    const buffer = await readFile(filePath);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="master-database.xlsx"'
      }
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("No stored master workbook")
        ? "No master workbook is available to download yet."
        : error instanceof Error
          ? error.message
          : "Master workbook download failed.";

    return NextResponse.redirect(
      new URL(`/dashboard/master?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    );
  }
}
