import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { ensureStoredDueWorkbook, syncStoredDueWorkbook } from "@/lib/workbook-sync";

export async function POST(request: Request) {
  const user = await requireUser();

  try {
    await ensureStoredDueWorkbook(user.id);
    const result = await syncStoredDueWorkbook(user.id);

    return NextResponse.redirect(
      new URL(
        `/dashboard/dues?message=${encodeURIComponent(
          `Re-synced ${result.recordCount} due rows from the stored workbook. No reminders were sent automatically. Generate and send eligible reminders when you are ready.`
        )}`,
        request.url
      ),
      { status: 303 }
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("No stored due workbook")
        ? "No dues workbook is available to refresh yet."
        : error instanceof Error
          ? error.message
          : "Dues workbook refresh failed.";

    return NextResponse.redirect(
      new URL(`/dashboard/dues?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    );
  }
}
