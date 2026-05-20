import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { parseWorkbook, readStoredWorkbookRows, writeStoredWorkbookRows } from "@/lib/excel";
import { syncStoredDueWorkbook } from "@/lib/workbook-sync";

export async function POST(request: Request) {
  const user = await requireUser();
  const formData = await request.formData();
  const file = formData.get("file");
  const mode = String(formData.get("mode") || "replace");

  if (!(file instanceof File)) {
    return NextResponse.redirect(
      new URL("/dashboard/dues?error=Please%20upload%20a%20valid%20dues%20file.", request.url),
      { status: 303 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseWorkbook(buffer, "due");
    const existingRows =
      mode === "append"
        ? await readStoredWorkbookRows(user.id, "due")
            .then((result) => result.rows)
            .catch(() => [])
        : [];

    await writeStoredWorkbookRows(
      user.id,
      "due",
      mode === "append" ? [...existingRows, ...rows] : rows
    );

    const result = await syncStoredDueWorkbook(user.id);

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
    return NextResponse.redirect(
      new URL(`/dashboard/dues?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    );
  }
}
