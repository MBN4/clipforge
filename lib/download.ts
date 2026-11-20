import path from "node:path";
import fs from "node:fs";
import { run, trimSource } from "./ffmpeg";
import { cancelRequested } from "./scheduler";
import { downloadSlice, NotSliceable } from "./dashSlice";
import { DEFAULT_SECTION_SECONDS, MAX_SECTION_SECONDS } from "./clipCount";
import type { HeatPoint } from "./peaks";

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
  /** True when the platform publishes a "most replayed" graph for this video (YouTube). */
  hasHeatmap: boolean;
}

function parseHeatmap(raw: unknown): HeatPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p: { start_time?: unknown; end_time?: unknown; value?: unknown } | null) => ({ start: Number(p?.start_time), end: Number(p?.end_time), value: Number(p?.value) }))
    .filter((p) => Number.isFinite(p.start) && Number.isFinite(p.end) && Number.isFinite(p.value) && p.end > p.start);
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
    hasHeatmap: parseHeatmap(data.heatmap).length > 0,
  };
}

/** The video's "most replayed" graph, or [] if the platform doesn't publish one. */
export async function fetchHeatmap(url: string): Promise<HeatPoint[]> {
  const { stdout } = await run("yt-dlp", ["--no-playlist", "--skip-download", "--dump-json", "--no-warnings", url]);
  return parseHeatmap(JSON.parse(stdout.trim().split("\n")[0]).heatmap);
}

function toTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Videos longer than this are never downloaded whole — only a slice of them is. */
export const MAX_WHOLE_DOWNLOAD = MAX_SECTION_SECONDS;
/** How much of a very long video to take when the user didn't choose a range. */
export const AUTO_WINDOW = DEFAULT_SECTION_SECONDS;

export function formatLength(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** The `windowSec`-long stretch with the most "replay" heat — where a long stream's best moments cluster. */
export function bestWindow(heat: HeatPoint[], total: number, windowSec: number): TimeRange | null {
  if (!heat.length || total <= windowSec) return null;
  const STEP = 60;
  let best: TimeRange | null = null;
  let bestScore = -1;
  for (let start = 0; start + windowSec <= total + STEP; start += STEP) {
    const s = Math.min(start, total - windowSec);
    const e = s + windowSec;
    let score = 0;
    for (const p of heat) {
      const overlap = Math.min(e, p.end) - Math.max(s, p.start);
      if (overlap > 0) score += p.value * overlap;
    }
    if (score > bestScore) {
      bestScore = score;
      best = { start: s, end: e };
    }
  }
  return best;
}

/** A readable reason for a failed download, from yt-dlp's own error text. */
export function explainDownloadError(message: string): string {
  const m = message || "";
  if (/stalled/.test(m)) return "The download stalled — no data arrived for over a minute. Check your connection and hit Retry.";
  if (/Sign in to confirm|not a bot/i.test(m)) return "YouTube wants a sign-in (bot check) for this video from your connection. Try again later, or upload the file directly.";
  if (/Private video|members-only|Join this channel/i.test(m)) return "That video is private or members-only, so it can't be downloaded.";
  if (/confirm your age|age-restricted|inappropriate for some users/i.test(m)) return "That video is age-restricted, so it can't be downloaded without signing in.";
  if (/live event will begin|Premieres in|is upcoming|This live event/i.test(m)) return "That stream hasn't started yet. Try again once it's live or finished.";
  if (/is a live stream|live stream recording is not available|currently live/i.test(m)) return "That stream is still live or its recording isn't available yet. Try again after it ends.";
  if (/Video unavailable|has been removed|no longer available|does not exist/i.test(m)) return "That video is unavailable (removed or region-blocked).";
  if (/HTTP Error 4(03|29)/.test(m)) return "The platform blocked or rate-limited the download. Wait a few minutes and hit Retry.";
  if (/Requested format is not available/i.test(m)) return "No downloadable format was found for that video.";
  return "Couldn't fetch that video. The link may be private, age-restricted, or the platform blocked the request — try a direct upload instead.";
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
  /** Never fall back to downloading the whole video if the slice fails (it would be hours long). */
  noFullFallback?: boolean;
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

async function ytdlp(url: string, destDir: string, extra: string[], onProgress?: DownloadOptions["onProgress"], stallMs = STALL_MS) {
  const args = [
    "--no-playlist",
    "-f",
    "bv*[height<=1080][ext=mp4][protocol=https]+ba[ext=m4a][protocol=https]/bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b",
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
    stall: { dir: destDir, ms: stallMs },
    onLine: onProgress
      ? (line) => {
          const m = PCT.exec(line);
          if (m) onProgress(parseFloat(m[1]), SPEED.exec(line)?.[1]);
        }
      : undefined,
  });
}

export async function downloadFromUrl(url: string, destDir: string, opts: DownloadOptions = {}): Promise<string> {
  const { range, useSections, noFullFallback, onProgress } = opts;

  if (range && useSections) {
    // Fast path: fetch only the bytes of the window (see lib/dashSlice.ts). ffmpeg-based slicing crawls on
    // long videos, so it's only the fallback.
    try {
      clearPartials(destDir);
      return await downloadSlice(url, destDir, range, onProgress);
    } catch (e) {
      if (cancelRequested()) throw e;
      console.warn("[download] direct slice failed, trying yt-dlp sections:", e instanceof NotSliceable ? `not sliceable (${e.message})` : e);
    }
    try {
      clearPartials(destDir);
      // ffmpeg may be silent for minutes while it seeks into a long stream, so be patient before calling it stalled
      await ytdlp(url, destDir, ["--download-sections", `*${toTimestamp(range.start)}-${toTimestamp(range.end)}`], onProgress, 6 * 60_000);
      return findSource(destDir);
    } catch (e) {
      if (cancelRequested() || noFullFallback) throw e;
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
