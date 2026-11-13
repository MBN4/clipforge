import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { trackChild } from "./scheduler";

export interface RunOptions {
  /** called for every line of stdout (e.g. to parse yt-dlp's progress output) */
  onLine?: (line: string) => void;
  /** kill the process if the total size of files in `dir` stops growing for `ms` — catches silently hung downloads */
  stall?: { dir: string; ms: number };
}

function dirBytes(dir: string): number {
  try {
    let total = 0;
    for (const f of fs.readdirSync(dir)) {
      try {
        total += fs.statSync(path.join(dir, f)).size;
      } catch {}
    }
    return total;
  } catch {
    return 0;
  }
}

export function run(cmd: string, args: string[], opts: RunOptions = {}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], detached: true });
    trackChild(child);
    let stdout = "";
    let stderr = "";
    let pendingLine = "";
    let stalled = false;
    child.stdout.on("data", (d) => {
      const text = d.toString();
      stdout += text;
      if (opts.onLine) {
        const parts = (pendingLine + text).split(/[\r\n]+/);
        pendingLine = parts.pop() ?? "";
        parts.forEach((l) => l && opts.onLine!(l));
      }
    });
    child.stderr.on("data", (d) => (stderr += d.toString()));

    let watchdog: ReturnType<typeof setInterval> | undefined;
    if (opts.stall) {
      const { dir, ms } = opts.stall;
      let last = dirBytes(dir);
      let lastChange = Date.now();
      watchdog = setInterval(() => {
        const now = dirBytes(dir);
        if (now !== last) {
          last = now;
          lastChange = Date.now();
        } else if (Date.now() - lastChange > ms) {
          stalled = true;
          try {
            if (child.pid) process.kill(-child.pid, "SIGKILL");
          } catch {
            child.kill("SIGKILL");
          }
        }
      }, 4000);
    }

    child.on("error", (e) => {
      clearInterval(watchdog);
      reject(e);
    });
    child.on("close", (code) => {
      clearInterval(watchdog);
      if (stalled) reject(new Error(`${cmd} stalled: no download progress for ${Math.round((opts.stall?.ms ?? 0) / 1000)}s`));
      else if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-4000)}`));
    });
  });
}

export interface ProbeInfo {
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

export async function probe(file: string): Promise<ProbeInfo> {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    file,
  ]);
  const data = JSON.parse(stdout);
  const video = data.streams.find((s: any) => s.codec_type === "video");
  const audio = data.streams.find((s: any) => s.codec_type === "audio");
  const duration = parseFloat(data.format?.duration ?? video?.duration ?? "0");
  return {
    duration,
    width: video?.width ?? 1920,
    height: video?.height ?? 1080,
    hasAudio: !!audio,
  };
}

export async function ffmpeg(args: string[]) {
  return run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args]);
}

/** Fast stream-copy trim (no re-encode) — used to scope a long upload down to
 * the range the user asked about before transcription/rendering touch it. */
export async function trimSource(sourcePath: string, start: number, end: number, outPath: string) {
  await ffmpeg([
    "-ss",
    String(Math.max(0, start)),
    "-i",
    sourcePath,
    "-t",
    String(Math.max(end - start, 1)),
    "-c",
    "copy",
    "-avoid_negative_ts",
    "make_zero",
    outPath,
  ]);
}

/** Grab one frame of the source as a small JPEG, used as the video's dashboard thumbnail. */
export async function extractThumb(sourcePath: string, outPath: string, at: number) {
  await ffmpeg(["-ss", String(Math.max(0, at)), "-i", sourcePath, "-frames:v", "1", "-vf", "scale=480:-2", "-q:v", "4", outPath]);
}
