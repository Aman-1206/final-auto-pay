import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { getCompanyWorkspaceContextForUser } from "@/lib/company-workspace";
import { updateDatabase } from "@/lib/storage";

export async function POST(request: Request) {
  const user = await requireAdminUser();
  const formData = await request.formData();
  const policyId = String(formData.get("policyId") || "");

  await updateDatabase((database) => {
    const workspace = getCompanyWorkspaceContextForUser(database, user);
    database.cashDiscountPolicies = database.cashDiscountPolicies.filter(
      (entry) => !(entry.id === policyId && entry.ownerId === workspace.configOwnerId)
    );
  });

  return NextResponse.redirect(
    new URL("/dashboard/settings?message=Cash%20discount%20policy%20deleted.", request.url),
    { status: 303 }
  );
}
