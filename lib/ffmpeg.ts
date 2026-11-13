import { spawn } from "node:child_process";
import { trackChild } from "./scheduler";

export function run(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], detached: true });
    trackChild(child);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
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
