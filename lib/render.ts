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
    // Blur a quarter-resolution copy, then scale back up, instead of
    // blurring the full 1080x1920 frame — boxblur's cost scales with pixel
    // count, so this is ~3x faster per clip with no visible quality loss
    // (the result is blurred anyway; upscaling a blurred image doesn't
    // reveal the lower source resolution).
    "[bgsrc]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=8:2,eq=brightness=-0.08:saturation=1.15,scale=1080:1920[bg]",
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
    "-t",
    String(duration),
    "-i",
    sourcePath,
    "-filter_complex",
    filters.join(";"),
    "-map",
    videoOut,
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
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
