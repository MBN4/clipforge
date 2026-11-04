import path from "node:path";
import fs from "node:fs";
import { run } from "./ffmpeg";

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

export async function downloadFromUrl(url: string, destDir: string): Promise<string> {
  const outTemplate = path.join(destDir, "source.%(ext)s");
  await run("yt-dlp", [
    "--no-playlist",
    "-f",
    "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b",
    "--merge-output-format",
    "mp4",
    "--no-warnings",
    "-o",
    outTemplate,
    url,
  ]);
  const files = fs.readdirSync(destDir).filter((f) => f.startsWith("source."));
  if (files.length === 0) throw new Error("Download produced no file");
  return path.join(destDir, files[0]);
}
