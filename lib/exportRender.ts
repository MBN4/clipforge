import path from "node:path";
import fs from "node:fs";
import { ffmpeg } from "./ffmpeg";
import { buildAssFromChunks } from "./captions";
import { writeStickerSvg } from "./stickers";
import type { ExportSpec } from "./types";

function escapeForFilterPath(p: string) {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function escapeDrawtext(text: string) {
  return text
    .replace(/\\/g, "\\\\\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\u2019")
    .replace(/%/g, "\\%");
}

/** Shift a [start,end] window into the post-trim timeline, clipping to it. Returns null if fully outside. */
function shiftIntoTrim(start: number, end: number, trimStart: number, trimEnd: number) {
  const s = Math.max(start, trimStart);
  const e = Math.min(end, trimEnd);
  if (e <= s) return null;
  return { start: s - trimStart, end: e - trimStart };
}

const FONT_FILES: Record<string, string> = {
  "DejaVu Sans": "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "Liberation Sans": "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  "DejaVu Serif": "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
  "Liberation Mono": "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf",
};

export interface ExportInput {
  rawPath: string;
  outDir: string;
  baseName: string;
  spec: ExportSpec;
}

export interface ExportOutput {
  videoPath: string;
  thumbPath: string;
}

export async function exportClip({ rawPath, outDir, baseName, spec }: ExportInput): Promise<ExportOutput> {
  const { trim, crop, captions, textOverlays, stickers, filters, music } = spec;
  const duration = Math.max(0.5, trim.end - trim.start);
  const videoPath = path.join(outDir, `${baseName}.mp4`);
  const thumbPath = path.join(outDir, `${baseName}.jpg`);

  const inputs: string[] = ["-ss", String(Math.max(0, trim.start)), "-t", String(duration), "-i", rawPath];
  let nextInputIndex = 1;

  const videoFilters: string[] = [];
  let vLabel = "0:v";

  // --- crop / zoom / pan ---
  const zoom = Math.max(1, crop.zoom || 1);
  const fx = Math.min(1, Math.max(0, crop.x));
  const fy = Math.min(1, Math.max(0, crop.y));
  videoFilters.push(
    `[${vLabel}]scale=1080:1920:force_original_aspect_ratio=increase:force_divisible_by=2,` +
      `scale=trunc(iw*${zoom}/2)*2:trunc(ih*${zoom}/2)*2,` +
      `crop=1080:1920:x='(iw-1080)*${fx}':y='(ih-1920)*${fy}'[cropped]`
  );
  vLabel = "cropped";

  // --- color filters ---
  const b = Math.max(-1, Math.min(1, filters.brightness || 0));
  const c = 1 + Math.max(-1, Math.min(1, filters.contrast || 0));
  const s = 1 + Math.max(-1, Math.min(1, filters.saturation || 0));
  videoFilters.push(`[${vLabel}]eq=brightness=${b}:contrast=${c}:saturation=${s}[graded]`);
  vLabel = "graded";

  // --- stickers ---
  const tmpFiles: string[] = [];
  for (const st of stickers) {
    const win = shiftIntoTrim(st.start, st.end, trim.start, trim.end);
    if (!win) continue;
    const svgPath = writeStickerSvg(st.type, st.color, outDir, `${baseName}-sticker-${st.id}`);
    tmpFiles.push(svgPath);
    const inputIdx = nextInputIndex++;
    inputs.push("-i", svgPath);
    const sizePx = Math.max(20, st.size);
    const outLabel = `stk${inputIdx}`;
    videoFilters.push(`[${inputIdx}:v]scale=${Math.round(sizePx)}:${Math.round(sizePx)}[${outLabel}src]`);
    const nextLabel = `ov${inputIdx}`;
    const x = `(${st.x}*1080-${sizePx / 2})`;
    const y = `(${st.y}*1920-${sizePx / 2})`;
    videoFilters.push(
      `[${vLabel}][${outLabel}src]overlay=x='${x}':y='${y}':enable='between(t,${win.start},${win.end})'[${nextLabel}]`
    );
    vLabel = nextLabel;
  }

  // --- text overlays ---
  textOverlays.forEach((t, i) => {
    const win = shiftIntoTrim(t.start, t.end, trim.start, trim.end);
    if (!win) return;
    const nextLabel = `txt${i}`;
    const x = `(${t.x}*1080-text_w/2)`;
    const y = `(${t.y}*1920-text_h/2)`;
    videoFilters.push(
      `[${vLabel}]drawtext=fontfile=${escapeForFilterPath(FONT_FILES["DejaVu Sans"])}:text='${escapeDrawtext(
        t.text
      )}':fontsize=${Math.round(t.fontSize)}:fontcolor=${t.color}:borderw=3:bordercolor=black@0.6:x='${x}':y='${y}':enable='between(t,${
        win.start
      },${win.end})'[${nextLabel}]`
    );
    vLabel = nextLabel;
  });

  // --- captions ---
  let assPath: string | null = null;
  if (captions.enabled && captions.chunks.length) {
    const shiftedChunks = captions.chunks
      .map((c2) => {
        const win = shiftIntoTrim(c2.start, c2.end, trim.start, trim.end);
        return win ? { text: c2.text, start: win.start, end: win.end } : null;
      })
      .filter((c2): c2 is NonNullable<typeof c2> => !!c2);

    if (shiftedChunks.length) {
      assPath = path.join(outDir, `${baseName}-captions.ass`);
      fs.writeFileSync(assPath, buildAssFromChunks(shiftedChunks, captions.style));
      const nextLabel = "capped";
      videoFilters.push(`[${vLabel}]ass=${escapeForFilterPath(assPath)}[${nextLabel}]`);
      vLabel = nextLabel;
    }
  }

  // --- audio ---
  const audioFilters: string[] = [];
  let aLabel = "0:a?";
  let finalALabel = aLabel;

  if (music) {
    const musicInputIdx = nextInputIndex++;
    inputs.push("-stream_loop", "-1", "-i", music.path);
    audioFilters.push(`[0:a]volume=${Math.max(0, Math.min(1, music.duckOriginal))}[origA]`);
    audioFilters.push(`[${musicInputIdx}:a]atrim=0:${duration},volume=${Math.max(0, Math.min(1, music.volume))}[musicA]`);
    audioFilters.push(`[origA][musicA]amix=inputs=2:duration=first:dropout_transition=0[aout]`);
    finalALabel = "aout";
  }

  const filterComplex = [...videoFilters, ...audioFilters].join(";");

  const args = [
    ...inputs,
    "-filter_complex",
    filterComplex,
    "-map",
    `[${vLabel}]`,
    "-map",
    music ? `[${finalALabel}]` : "0:a?",
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

  for (const f of tmpFiles) {
    try {
      fs.unlinkSync(f);
    } catch {
      // ignore
    }
  }
  if (assPath) {
    try {
      fs.unlinkSync(assPath);
    } catch {
      // ignore
    }
  }

  return { videoPath, thumbPath };
}
