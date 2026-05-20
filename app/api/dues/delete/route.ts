import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { deleteStoredWorkbook } from "@/lib/excel";
import { updateDatabase } from "@/lib/storage";

export async function POST(request: Request) {
  const user = await requireUser();

  try {
    await deleteStoredWorkbook(user.id, "due");

    await updateDatabase((database) => {
      database.dueRecords = database.dueRecords.filter((entry) => entry.ownerId !== user.id);
      database.reminderLogs = database.reminderLogs.filter((entry) => entry.ownerId !== user.id);
    });

    return NextResponse.redirect(
      new URL(
        "/dashboard/dues?message=Due%20workbook%20deleted.%20You%20can%20upload%20a%20fresh%20file%20now.",
        request.url
      ),
      { status: 303 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Due workbook deletion failed.";
    return NextResponse.redirect(
      new URL(`/dashboard/dues?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    );
  }
}
