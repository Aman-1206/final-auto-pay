import { requireAdminUser } from "@/lib/auth";
import { buildSampleWorkbookResponse } from "@/lib/sample-workbooks";

export async function GET() {
  await requireAdminUser();
  return buildSampleWorkbookResponse("salesperson");
}
