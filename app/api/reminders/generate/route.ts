import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { generateRemindersForUser } from "@/lib/reminder-engine";

export async function POST(request: Request) {
  const user = await requireUser();
  const formData = await request.formData();
  const generationDate = String(formData.get("generationDate") || "").trim();

  try {
    const generated = await generateRemindersForUser(user.id, generationDate || undefined);

    return NextResponse.redirect(
      new URL(
        `/dashboard/dispatch?message=${encodeURIComponent(
          `Generated ${generated.length} eligible reminders based on the selected date. Review the queue, then send when ready.`
        )}`,
        request.url
      ),
      { status: 303 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reminder generation failed.";
    return NextResponse.redirect(
      new URL(`/dashboard/dispatch?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    );
  }
}
