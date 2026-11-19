import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { getJob, updateJob } from "@/lib/store";
import { jobDir } from "@/lib/paths";
import { CaptionGenError, transcribeClipWords } from "@/lib/transcribe";
import { TRANSCRIBE_WEIGHT, withSlot } from "@/lib/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

/**
 * "Auto-generate captions": transcribes this clip's audio with word-level timings and stores the
 * words on the clip, so the editor can (re)build captions from them at any time.
 * Body: { language?: "auto" | "en" | …, translate?: boolean, quality?: "fast" | "accurate" }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; index: string }> }) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) {
    return NextResponse.json({ error: "Cross-origin request refused" }, { status: 403 });
  }
  const { id, index } = await params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  const clipIndex = parseInt(index, 10);
  const clip = job.clips.find((c) => c.index === clipIndex);
  if (!clip) return NextResponse.json({ error: "Clip not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const language = typeof body.language === "string" ? body.language : "auto";
  const translate = body.translate === true;
  const quality = body.quality === "accurate" ? "accurate" : "fast";

  try {
    const { words, language: detected } = await withSlot("cpu", TRANSCRIBE_WEIGHT, Date.now(), () =>
      transcribeClipWords(path.join(process.cwd(), clip.rawPath), path.join(jobDir(id), "tmp"), { language, translate, quality })
    );
    if (!words.length) {
      return NextResponse.json(
        { error: "No speech was found in this clip, so there is nothing to caption.", code: "no_speech" },
        { status: 422 }
      );
    }
    updateJob(id, { clips: job.clips.map((c) => (c.index === clipIndex ? { ...c, words } : c)) });
    return NextResponse.json({ words, language: detected });
  } catch (e) {
    if (e instanceof CaptionGenError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.code === "whisper_missing" ? 503 : 500 });
    }
    console.error("[captions] failed", e);
    return NextResponse.json({ error: "Caption generation failed.", code: "failed" }, { status: 500 });
  }
}
