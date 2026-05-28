import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { getCompanyWorkspaceId } from "@/lib/company-workspace";
import { ensureStoredMasterWorkbook, syncStoredMasterWorkbook } from "@/lib/workbook-sync";

export async function POST(request: Request) {
  const user = await requireAdminUser();
  const workspaceId = getCompanyWorkspaceId(user.companyName);

  try {
    await ensureStoredMasterWorkbook(workspaceId, user.companyName);
    const result = await syncStoredMasterWorkbook(workspaceId, user.companyName);

    return NextResponse.redirect(
      new URL(
        `/dashboard/master?message=${encodeURIComponent(
          `Re-synced ${result.recordCount} master contact rows from the stored workbook. No reminders were generated or sent automatically.`
        )}`,
        request.url
      ),
      { status: 303 }
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("No stored master workbook")
        ? "No master workbook is available to refresh yet."
        : error instanceof Error
          ? error.message
          : "Master workbook refresh failed.";

    return NextResponse.redirect(
      new URL(`/dashboard/master?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    );
  }
}
