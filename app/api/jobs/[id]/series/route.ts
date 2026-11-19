import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/store";
import { applyAction } from "@/lib/series";
import { startSeriesPart } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

/**
 * The user's decision for a long video that's being clipped in parts.
 * Body: { action: "stop" } or { action: "continue", skip?: { start, end } } (seconds of the source video).
 * `id` is any job of the series.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) {
    return NextResponse.json({ error: "Cross-origin request refused" }, { status: 403 });
  }
  const { id } = await params;
  const series = getJob(id)?.series;
  if (!series) return NextResponse.json({ error: "That video isn't part of a series" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { action?: unknown; skip?: { start?: unknown; end?: unknown } };
  let error: string | null;
  if (body.action === "stop") {
    error = applyAction(series.id, { action: "stop" }, startSeriesPart);
  } else if (body.action === "continue") {
    const s = body.skip;
    const skip = s && typeof s.start === "number" && typeof s.end === "number" ? { start: s.start, end: s.end } : undefined;
    if (s && !skip) return NextResponse.json({ error: "That skip range isn't valid" }, { status: 400 });
    error = applyAction(series.id, { action: "continue", skip }, startSeriesPart);
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  if (error) return NextResponse.json({ error }, { status: 409 });
  return NextResponse.json({ ok: true });
}
