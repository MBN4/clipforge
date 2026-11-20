import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { ffmpeg, run } from "./ffmpeg";
import { trackChild } from "./scheduler";
import { resolvePython } from "./systemChecks.mjs";
import type { Transcript, TranscriptSegment, Word } from "./types";

function runPython(args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(/* turbopackIgnore: true */ resolvePython(), args, { stdio: ["ignore", "ignore", "pipe"], detached: process.platform !== "win32", windowsHide: true });
    trackChild(child);
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (e) => resolve({ code: 1, stderr: String(e) }));
    child.on("close", (code) => resolve({ code: code ?? 1, stderr }));
  });
}

async function extractAudio(sourcePath: string, outWav: string) {
  await ffmpeg(["-i", sourcePath, "-ar", "16000", "-ac", "1", "-vn", outWav]);
}

async function heuristicSegments(sourcePath: string, duration: number): Promise<TranscriptSegment[]> {
  // Use silencedetect to find speech-dense regions; fall back to even windows.
  let silences: Array<{ start: number; end: number }> = [];
  try {
    const { stderr } = await run("ffmpeg", [
      "-i",
      sourcePath,
      "-af",
      "silencedetect=noise=-30dB:d=0.5",
      "-f",
      "null",
      "-",
    ]);
    const starts = [...stderr.matchAll(/silence_start:\s*([\d.]+)/g)].map((m) => parseFloat(m[1]));
    const ends = [...stderr.matchAll(/silence_end:\s*([\d.]+)/g)].map((m) => parseFloat(m[1]));
    silences = starts.map((s, i) => ({ start: s, end: ends[i] ?? duration }));
  } catch {
    // ignore, use even windows below
  }

  const speechSpans: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (const s of silences) {
    if (s.start - cursor > 1) speechSpans.push({ start: cursor, end: s.start });
    cursor = s.end;
  }
  if (duration - cursor > 1) speechSpans.push({ start: cursor, end: duration });

  const usable = speechSpans.filter((s) => s.end - s.start >= 3);
  const spans = usable.length ? usable : [{ start: 0, end: duration }];

  return spans.map((s) => ({ text: "", start: s.start, end: s.end, words: [] }));
}

export async function transcribe(sourcePath: string, workDir: string, duration: number): Promise<Transcript> {
  const audioPath = path.join(workDir, "audio.wav");
  await extractAudio(sourcePath, audioPath);

  const outJson = path.join(workDir, "transcript.raw.json");
  const scriptPath = path.join(process.cwd(), "scripts", "transcribe.py");
  // Long videos get the tiny model: ~3-4x faster than base, plenty to find highlights (captions can be
  // regenerated per clip at higher accuracy in the editor). Override with TRANSCRIBE_MODEL.
  const model = process.env.TRANSCRIBE_MODEL || (duration > 20 * 60 ? "tiny" : "base");
  const { code, stderr } = await runPython([scriptPath, audioPath, outJson, model]);

  if (code === 0 && fs.existsSync(outJson)) {
    const parsed = JSON.parse(fs.readFileSync(outJson, "utf-8"));
    return {
      method: "whisper",
      language: parsed.language,
      duration: parsed.duration || duration,
      segments: parsed.segments,
    };
  }

  console.warn("[transcribe] falling back to heuristic segmentation:", stderr.slice(-500));
  const segments = await heuristicSegments(sourcePath, duration);
  return { method: "heuristic", duration, segments };
}


export interface CaptionGenOptions {
  /** ISO code ("en", "es", "ur"…) or "auto" to detect. */
  language?: string;
  /** Whisper's "translate" task turns any language into English captions. */
  translate?: boolean;
  /** "fast" = base model, "accurate" = small model with a wider beam search. */
  quality?: "fast" | "accurate";
}

export class CaptionGenError extends Error {
  constructor(
    message: string,
    public code: "whisper_missing" | "failed"
  ) {
    super(message);
  }
}

const LANG = /^[a-z]{2,3}$/;
const MIN_WORD = 0.05;

/**
 * Word-level transcript of one clip, for the editor's "Auto-generate captions". Unlike the
 * pipeline's transcribe() this never falls back to guessing: if speech-to-text isn't available
 * the caller needs to know so it can tell the user how to install it.
 */
export async function transcribeClipWords(
  clipPath: string,
  workDir: string,
  opts: CaptionGenOptions = {}
): Promise<{ words: Word[]; language?: string }> {
  fs.mkdirSync(workDir, { recursive: true });
  const audioPath = path.join(workDir, `capgen-${Date.now()}.wav`);
  const outJson = `${audioPath}.json`;
  try {
    await extractAudio(clipPath, audioPath);
  } catch {
    throw new CaptionGenError("This clip has no audio track to caption.", "failed");
  }
  const quality = opts.quality === "accurate";
  const language = opts.language && LANG.test(opts.language) ? opts.language : "auto";
  const scriptPath = path.join(process.cwd(), "scripts", "transcribe.py");
  try {
    const { code, stderr } = await runPython([
      scriptPath,
      audioPath,
      outJson,
      quality ? "small" : "base",
      language,
      opts.translate ? "translate" : "transcribe",
      quality ? "5" : "1",
    ]);
    if (code !== 0 || !fs.existsSync(outJson)) {
      if (/faster-whisper not available/i.test(stderr)) {
        throw new CaptionGenError("Speech-to-text (faster-whisper) isn't installed on this machine.", "whisper_missing");
      }
      console.warn("[captions] transcription failed:", stderr.slice(-500));
      throw new CaptionGenError(
        "Couldn't transcribe this clip. The speech model may still be downloading (needs internet the first time) — try again in a minute.",
        "failed"
      );
    }
    const parsed = JSON.parse(fs.readFileSync(outJson, "utf-8"));
    const words: Word[] = (parsed.segments as TranscriptSegment[])
      .flatMap((s) => s.words ?? [])
      .filter((w) => w.word)
      .map((w) => ({ ...w }));
    // Whisper sometimes returns zero-length words (often the first one) or words that overlap the
    // next. Word effects need every word to occupy its own slice of time, in order.
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const next = words[i + 1];
      if (w.end < w.start + MIN_WORD) w.end = w.start + MIN_WORD;
      if (next && next.start < w.end) {
        next.start = w.end;
        if (next.end < next.start + MIN_WORD) next.end = next.start + MIN_WORD;
      }
    }
    return { words, language: parsed.language };
  } finally {
    for (const f of [audioPath, outJson]) fs.rmSync(f, { force: true });
  }
}
