import { NextRequest, NextResponse } from "next/server";
import { getSystemReport } from "@/lib/system";

export const dynamic = "force-dynamic";

/** Which of the programs Clipforge needs are installed on this machine. `?refresh=1` re-checks immediately. */
export async function GET(req: NextRequest) {
  return NextResponse.json(getSystemReport(req.nextUrl.searchParams.get("refresh") === "1"));
}
