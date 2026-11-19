import { NextRequest, NextResponse } from "next/server";
import { installWhisper, installYtDlp } from "@/lib/systemChecks.mjs";
import { getSystemReport } from "@/lib/system";

export const dynamic = "force-dynamic";

/**
 * One-click installs of the tools Clipforge can fetch for you (ffmpeg comes from your OS package manager):
 *  - yt-dlp (default): the official release into ./bin, checksum-verified
 *  - { tool: "whisper" }: pip-installs faster-whisper for captions
 * Same-origin requests only.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) {
    return NextResponse.json({ error: "Cross-origin request refused" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { tool?: string };
  try {
    // allow-list: only these two installs exist
    const version = body.tool === "whisper" ? await installWhisper() : await installYtDlp();
    return NextResponse.json({ ok: true, version, report: getSystemReport(true) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Install failed" }, { status: 500 });
  }
}
