import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { getCompanyWorkspaceId } from "@/lib/company-workspace";
import { parseWorkbook, readStoredWorkbookRows, writeStoredWorkbookRows } from "@/lib/excel";
import { syncStoredMasterWorkbook } from "@/lib/workbook-sync";

export async function POST(request: Request) {
  const user = await requireAdminUser();
  const workspaceId = getCompanyWorkspaceId(user.companyName);
  const formData = await request.formData();
  const file = formData.get("file");
  const mode = String(formData.get("mode") || "replace");

  if (!(file instanceof File)) {
    return NextResponse.redirect(
      new URL("/dashboard/master?error=Please%20upload%20a%20valid%20master%20file.", request.url),
      { status: 303 }
    );
  }

  try {
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
    return NextResponse.redirect(
      new URL(`/dashboard/master?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    );
  }
}
