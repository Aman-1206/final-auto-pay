import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { readStoredWorkbookRows } from "@/lib/excel";
import { ensureStoredDueWorkbook } from "@/lib/workbook-sync";

export async function GET(request: Request) {
  const user = await requireUser();

  try {
    await ensureStoredDueWorkbook(user.id);
    const { filePath } = await readStoredWorkbookRows(user.id, "due");
    const buffer = await readFile(filePath);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="due-database.xlsx"'
      }
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("No stored due workbook")
        ? "No dues workbook is available to download yet."
        : error instanceof Error
          ? error.message
          : "Dues workbook download failed.";

    return NextResponse.redirect(
      new URL(`/dashboard/dues?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    );
  }
}
