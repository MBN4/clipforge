import { NextRequest, NextResponse } from "next/server";
import { installYtDlp } from "@/lib/systemChecks.mjs";
import { getSystemReport } from "@/lib/system";

export const dynamic = "force-dynamic";

/**
 * One-click install of yt-dlp (the only tool Clipforge can fetch for you — ffmpeg comes from your OS package manager).
 * Downloads the official release into ./bin, checksum-verified. Same-origin requests only.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) {
    return NextResponse.json({ error: "Cross-origin request refused" }, { status: 403 });
  }
  try {
    const version = await installYtDlp();
    return NextResponse.json({ ok: true, version, report: getSystemReport(true) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Install failed" }, { status: 500 });
  }
}
