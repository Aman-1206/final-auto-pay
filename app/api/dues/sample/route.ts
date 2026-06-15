import { requireUser } from "@/lib/auth";
import { buildSampleWorkbookResponse } from "@/lib/sample-workbooks";

export async function GET() {
  await requireUser();
  return buildSampleWorkbookResponse("due");
}
