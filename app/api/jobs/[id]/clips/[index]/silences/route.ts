import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { getJob } from "@/lib/store";
import { run } from "@/lib/ffmpeg";

export const dynamic = "force-dynamic";

/**
 * Finds the silent stretches of a clip (for the editor's "Remove silences").
 * Body: { noiseDb?: number (-60..-15), minSilence?: number (0.15..3 seconds) }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; index: string }> }) {
  const { id, index } = await params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  const clip = job.clips.find((c) => c.index === parseInt(index, 10));
  if (!clip) return NextResponse.json({ error: "Clip not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const clampNum = (v: unknown, fallback: number, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
  const noiseDb = clampNum(body.noiseDb, -32, -60, -15);
  const minSilence = clampNum(body.minSilence, 0.45, 0.15, 3);

  try {
    // silencedetect reports at info level, so this can't use the quiet ffmpeg() wrapper
    const { stderr } = await run("ffmpeg", [
      "-hide_banner",
      "-nostats",
      "-i",
      path.join(process.cwd(), clip.rawPath),
      "-vn",
      "-af",
      `silencedetect=noise=${noiseDb}dB:d=${minSilence}`,
      "-f",
      "null",
      "-",
    ]);
    const starts = [...stderr.matchAll(/silence_start:\s*(-?[\d.]+)/g)].map((m) => Math.max(0, parseFloat(m[1])));
    const ends = [...stderr.matchAll(/silence_end:\s*(-?[\d.]+)/g)].map((m) => parseFloat(m[1]));
    // a silence that runs to the end of the clip has a start but no end
    const silences = starts.map((start, i) => ({ start, end: ends[i] ?? clip.duration })).filter((s) => s.end > s.start);
    return NextResponse.json({ silences, duration: clip.duration });
  } catch (e) {
    console.error("[silences] failed", e);
    return NextResponse.json({ error: "Couldn't analyse this clip's audio." }, { status: 500 });
  }
}
