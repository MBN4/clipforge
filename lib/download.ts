import path from "node:path";
import fs from "node:fs";
import { run, trimSource } from "./ffmpeg";
import { cancelRequested } from "./scheduler";

export function detectPlatform(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "YouTube";
  if (u.includes("instagram.com")) return "Instagram";
  if (u.includes("tiktok.com")) return "TikTok";
  if (u.includes("facebook.com") || u.includes("fb.watch")) return "Facebook";
  return "Video";
}

export interface UrlInfo {
  duration: number;
  title: string;
  thumbnail?: string;
}

export async function probeUrl(url: string): Promise<UrlInfo> {
  const { stdout } = await run("yt-dlp", [
    "--no-playlist",
    "--skip-download",
    "--dump-json",
    "--no-warnings",
    url,
  ]);
  const data = JSON.parse(stdout.trim().split("\n")[0]);
  return {
    duration: Number(data.duration) || 0,
    title: data.title || "Untitled video",
    thumbnail: data.thumbnail,
  };
}

function toTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export interface TimeRange {
  start: number;
  end: number;
}

export interface DownloadOptions {
  range?: TimeRange;
  /**
   * Fetch only the requested window with yt-dlp's --download-sections. That path reads the stream
   * through ffmpeg, which is slow and can hang, so it's only worth it for a small slice of a very long video.
   */
  useSections?: boolean;
  /** download progress: percent of the current stream, and the transfer speed (e.g. "4.2MiB/s") */
  onProgress?: (pct: number, speed?: string) => void;
}

const STALL_MS = 75_000; // a download that stops growing for this long is considered hung

const PCT = /\[download\]\s+([\d.]+)%/;
const SPEED = /at\s+([\d.]+\s?[KMG]?i?B\/s)/;

function clearPartials(destDir: string) {
  for (const f of fs.readdirSync(destDir)) if (f.startsWith("source.")) fs.rmSync(path.join(destDir, f), { force: true });
}

/** The finished download — never a leftover .part / .ytdl file from an interrupted attempt. */
function findSource(destDir: string): string {
  const files = fs.readdirSync(destDir).filter((f) => /^source\.[a-z0-9]+$/i.test(f) && !/\.(part|ytdl|temp)$/i.test(f));
  if (files.length === 0) throw new Error("Download produced no file");
  return path.join(destDir, files[0]);
}

async function ytdlp(url: string, destDir: string, extra: string[], onProgress?: DownloadOptions["onProgress"]) {
  const args = [
    "--no-playlist",
    "-f",
    "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b",
    "--merge-output-format",
    "mp4",
    "--no-warnings",
    "--newline",
    "-N",
    "4", // fetch fragments in parallel — much faster than the default single connection
    "--socket-timeout",
    "20",
    "--retries",
    "5",
    "--fragment-retries",
    "5",
    ...extra,
    "-o",
    path.join(destDir, "source.%(ext)s"),
    url,
  ];
  await run("yt-dlp", args, {
    stall: { dir: destDir, ms: STALL_MS },
    onLine: onProgress
      ? (line) => {
          const m = PCT.exec(line);
          if (m) onProgress(parseFloat(m[1]), SPEED.exec(line)?.[1]);
        }
      : undefined,
  });
}

export async function downloadFromUrl(url: string, destDir: string, opts: DownloadOptions = {}): Promise<string> {
  const { range, useSections, onProgress } = opts;

  if (range && useSections) {
    try {
      clearPartials(destDir);
      await ytdlp(url, destDir, ["--download-sections", `*${toTimestamp(range.start)}-${toTimestamp(range.end)}`], onProgress);
      return findSource(destDir);
    } catch (e) {
      if (cancelRequested()) throw e;
      console.warn("[download] section download failed, falling back to the full video:", e instanceof Error ? e.message : e);
    }
  }

  // The reliable path: download the whole video with the native downloader, then trim locally.
  clearPartials(destDir);
  await ytdlp(url, destDir, [], onProgress);
  const full = findSource(destDir);
  if (!range) return full;
  const trimmed = path.join(destDir, `trimmed${path.extname(full) || ".mp4"}`);
  await trimSource(full, range.start, range.end, trimmed);
  return trimmed;
}
