import path from "node:path";
import fs from "node:fs";
import { ffmpeg } from "./ffmpeg";
import { buildAssFromWords } from "./captions";
import type { Word } from "./types";

export interface RenderClipInput {
  sourcePath: string;
  start: number;
  end: number;
  words: Word[];
  outDir: string;
  baseName: string;
}

export interface RenderClipOutput {
  videoPath: string;
  thumbPath: string;
}

function escapeForFilter(p: string) {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

export async function renderClip(input: RenderClipInput): Promise<RenderClipOutput> {
  const { sourcePath, start, end, words, outDir, baseName } = input;
  const duration = Math.max(1, end - start);
  const videoPath = path.join(outDir, `${baseName}.mp4`);
  const thumbPath = path.join(outDir, `${baseName}.jpg`);
  const assPath = path.join(outDir, `${baseName}.ass`);

  const hasCaptions = words.length > 2;
  if (hasCaptions) {
    fs.writeFileSync(assPath, buildAssFromWords(words, start));
  }

  const filters = [
    "[0:v]split=2[bgsrc][fgsrc]",
    "[bgsrc]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=35:4,eq=brightness=-0.08:saturation=1.15[bg]",
    "[fgsrc]scale=1080:1920:force_original_aspect_ratio=decrease[fg]",
    "[bg][fg]overlay=(W-w)/2:(H-h)/2[base]",
  ];

  let videoOut = "[base]";
  if (hasCaptions) {
    filters.push(`[base]ass=${escapeForFilter(assPath)}[capped]`);
    videoOut = "[capped]";
  }

  const args = [
    "-ss",
    String(Math.max(0, start)),
    "-i",
    sourcePath,
    "-t",
    String(duration),
    "-filter_complex",
    filters.join(";"),
    "-map",
    videoOut,
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "superfast",
    "-crf",
    "21",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-movflags",
    "+faststart",
    videoPath,
  ];

  await ffmpeg(args);

  await ffmpeg(["-ss", String(Math.min(duration / 2, 1)), "-i", videoPath, "-frames:v", "1", "-q:v", "3", thumbPath]);

  return { videoPath, thumbPath };
}
