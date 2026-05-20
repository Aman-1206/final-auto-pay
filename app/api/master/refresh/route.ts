import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { ensureStoredMasterWorkbook, syncStoredMasterWorkbook } from "@/lib/workbook-sync";

export async function POST(request: Request) {
  const user = await requireUser();

  try {
    await ensureStoredMasterWorkbook(user.id);
    const result = await syncStoredMasterWorkbook(user.id);

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
