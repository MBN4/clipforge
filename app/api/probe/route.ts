import { NextRequest, NextResponse } from "next/server";
import { probeUrl, detectPlatform } from "@/lib/download";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const url = (body.url || "").trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "Please provide a valid video URL" }, { status: 400 });
  }

  try {
    const info = await probeUrl(url);
    return NextResponse.json({ ...info, platform: detectPlatform(url) });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Couldn't read that video. It may be private or the link is unsupported." },
      { status: 422 }
    );
  }
}
