import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { updateDatabase } from "@/lib/storage";

export async function POST(request: Request) {
  const user = await requireAdminUser();
  const formData = await request.formData();
  const policyId = String(formData.get("policyId") || "");

  await updateDatabase((database) => {
    database.cashDiscountPolicies = database.cashDiscountPolicies.filter(
      (entry) => !(entry.id === policyId && entry.ownerId === user.id)
    );
  });

  return NextResponse.redirect(
    new URL("/dashboard/settings?message=Cash%20discount%20policy%20deleted.", request.url),
    { status: 303 }
  );
}
