import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { ffmpeg, run } from "./ffmpeg";
import type { Transcript, TranscriptSegment } from "./types";

function runPython(args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("python3", args, { stdio: ["ignore", "ignore", "pipe"] });
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

export async function transcribe(sourcePath: string, workDir: string): Promise<Transcript> {
  const audioPath = path.join(workDir, "audio.wav");
  await extractAudio(sourcePath, audioPath);

  const { probe } = await import("./ffmpeg");
  const info = await probe(sourcePath);

  const outJson = path.join(workDir, "transcript.raw.json");
  const scriptPath = path.join(process.cwd(), "scripts", "transcribe.py");
  const { code, stderr } = await runPython([scriptPath, audioPath, outJson]);

  if (code === 0 && fs.existsSync(outJson)) {
    const parsed = JSON.parse(fs.readFileSync(outJson, "utf-8"));
    return {
      method: "whisper",
      language: parsed.language,
      duration: parsed.duration || info.duration,
      segments: parsed.segments,
    };
  }

  console.warn("[transcribe] falling back to heuristic segmentation:", stderr.slice(-500));
  const segments = await heuristicSegments(sourcePath, info.duration);
  return { method: "heuristic", duration: info.duration, segments };
}
