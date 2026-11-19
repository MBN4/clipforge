import path from "node:path";
import fs from "node:fs";
import { ffmpeg, probe } from "./ffmpeg";
import { buildAssFromChunks, dropCutWords, normalizeCaptionStyle, normalizeChunks } from "./captions";
import { CAPTION_FONTS_DIR } from "./paths";
import { writeStickerSvg } from "./stickers";
import { buildTimeline } from "./timeline";
import { normalizeAudio, normalizeFilters, normalizeLayout, normalizePolish } from "./editSpec";
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

// Text overlays need a bold font file for ffmpeg's drawtext. Use whichever common system font exists
// (Linux / macOS / Windows), and fall back to a bundled font so the export never depends on the host.
const OVERLAY_FONT_CANDIDATES = [
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  "/usr/share/fonts/liberation/LiberationSans-Bold.ttf",
  "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
  "/Library/Fonts/Arial Bold.ttf",
  "C:/Windows/Fonts/arialbd.ttf",
];
let overlayFont: string | undefined;
function overlayFontFile(): string {
  if (!overlayFont) {
    overlayFont =
      OVERLAY_FONT_CANDIDATES.find((f) => fs.existsSync(f)) ?? path.join(CAPTION_FONTS_DIR, "Poppins-ExtraBold.ttf");
  }
  return overlayFont;
}

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

const sec = (n: number) => n.toFixed(3);
const hex0x = (c: string) => `0x${c.replace("#", "")}`;

export async function exportClip({ rawPath, outDir, baseName, spec }: ExportInput): Promise<ExportOutput> {
  const { trim, crop, captions, textOverlays, stickers, music } = spec;
  const filters = normalizeFilters(spec.filters);
  const audio = normalizeAudio(spec.audio);
  const polish = normalizePolish(spec.polish);
  const layout = normalizeLayout(spec.layout);

  // everything time-based is placed on the OUTPUT timeline (after cuts and speed changes)
  const tl = buildTimeline(trim, spec.removed ?? [], spec.speed ?? 1);
  const D = tl.duration;
  const inputLen = Math.max(0.5, trim.end - trim.start);
  const hasAudio = (await probe(rawPath)).hasAudio;

  const videoPath = path.join(outDir, `${baseName}.mp4`);
  const thumbPath = path.join(outDir, `${baseName}.jpg`);

  const inputs: string[] = ["-ss", String(Math.max(0, trim.start)), "-t", String(inputLen), "-i", rawPath];
  let nextInputIndex = 1;

  const videoFilters: string[] = [];
  const audioFilters: string[] = [];
  let vLabel = "0:v";
  let aLabel: string | null = hasAudio ? "0:a" : null;

  // --- cuts (silences / filler words): keep only the surviving segments and join them ---
  if (!tl.untouched) {
    const n = tl.segments.length;
    const rel = tl.segments.map((sg) => ({ a: sg.src0 - trim.start, b: sg.src1 - trim.start }));
    const vIn = (i: number) => (n > 1 ? `sv${i}` : "0:v");
    const aIn = (i: number) => (n > 1 ? `sa${i}` : "0:a");
    if (n > 1) {
      videoFilters.push(`[0:v]split=${n}${rel.map((_, i) => `[sv${i}]`).join("")}`);
      if (hasAudio) audioFilters.push(`[0:a]asplit=${n}${rel.map((_, i) => `[sa${i}]`).join("")}`);
    }
    rel.forEach((r, i) => {
      videoFilters.push(`[${vIn(i)}]trim=start=${sec(r.a)}:end=${sec(r.b)},setpts=PTS-STARTPTS[tv${i}]`);
      if (hasAudio) audioFilters.push(`[${aIn(i)}]atrim=start=${sec(r.a)}:end=${sec(r.b)},asetpts=PTS-STARTPTS[ta${i}]`);
    });
    if (n > 1) {
      const pads = rel.map((_, i) => `[tv${i}]${hasAudio ? `[ta${i}]` : ""}`).join("");
      videoFilters.push(`${pads}concat=n=${n}:v=1:a=${hasAudio ? 1 : 0}[cv]${hasAudio ? "[ca]" : ""}`);
      vLabel = "cv";
      if (hasAudio) aLabel = "ca";
    } else {
      vLabel = "tv0";
      if (hasAudio) aLabel = "ta0";
    }
  }

  // --- speed ---
  if (tl.speed !== 1) {
    videoFilters.push(`[${vLabel}]setpts=PTS/${tl.speed}[spd]`);
    vLabel = "spd";
    if (aLabel) {
      audioFilters.push(`[${aLabel}]atempo=${tl.speed}[spa]`);
      aLabel = "spa";
    }
  }

  // --- layout: fill (crop / zoom / pan) or fit (whole frame over a blurred copy) ---
  if (layout === "fit") {
    videoFilters.push(`[${vLabel}]split=2[fbg][ffg]`);
    videoFilters.push(
      `[fbg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=36,eq=brightness=-0.1:saturation=1.2[fbgb]`
    );
    videoFilters.push(`[ffg]scale=1080:-2[ffgs]`);
    videoFilters.push(`[fbgb][ffgs]overlay=x=(W-w)/2:y=(H-h)/2[cropped]`);
  } else {
    const zoom = Math.max(1, crop.zoom || 1);
    const fx = Math.min(1, Math.max(0, crop.x));
    const fy = Math.min(1, Math.max(0, crop.y));
    videoFilters.push(
      `[${vLabel}]scale=1080:1920:force_original_aspect_ratio=increase,` +
        `scale=trunc(iw*${zoom}/2)*2:trunc(ih*${zoom}/2)*2,` +
        `crop=1080:1920:x='(iw-1080)*${fx}':y='(ih-1920)*${fy}'[cropped]`
    );
  }
  vLabel = "cropped";

  // --- color grade ---
  const grade = [
    `eq=brightness=${filters.brightness}:contrast=${1 + filters.contrast}:saturation=${1 + filters.saturation}`,
  ];
  if (Math.abs(filters.warmth) > 0.01) {
    const w = filters.warmth;
    grade.push(`colorbalance=rs=${(w * 0.12).toFixed(3)}:rm=${(w * 0.2).toFixed(3)}:bs=${(-w * 0.12).toFixed(3)}:bm=${(-w * 0.2).toFixed(3)}`);
  }
  if (filters.vignette > 0.01) {
    const angle = Math.PI / 2.5 - filters.vignette * (Math.PI / 2.5 - Math.PI / 7);
    grade.push(`vignette=angle=${angle.toFixed(4)}`);
  }
  if (filters.sharpen > 0.01) grade.push(`unsharp=5:5:${(filters.sharpen * 1.2).toFixed(2)}:5:5:0`);
  videoFilters.push(`[${vLabel}]${grade.join(",")}[graded]`);
  vLabel = "graded";

  // --- stickers ---
  const tmpFiles: string[] = [];
  for (const st of stickers) {
    const win = tl.mapWindow(st.start, st.end);
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
      `[${vLabel}][${outLabel}src]overlay=x='${x}':y='${y}':enable='between(t,${sec(win.start)},${sec(win.end)})'[${nextLabel}]`
    );
    vLabel = nextLabel;
  }

  // --- text overlays ---
  textOverlays.forEach((t, i) => {
    const win = tl.mapWindow(t.start, t.end);
    if (!win) return;
    const nextLabel = `txt${i}`;
    const x = `(${t.x}*1080-text_w/2)`;
    const y = `(${t.y}*1920-text_h/2)`;
    videoFilters.push(
      `[${vLabel}]drawtext=fontfile=${escapeForFilterPath(overlayFontFile())}:text='${escapeDrawtext(
        t.text
      )}':fontsize=${Math.round(t.fontSize)}:fontcolor=${t.color}:borderw=3:bordercolor=black@0.6:x='${x}':y='${y}':enable='between(t,${sec(
        win.start
      )},${sec(win.end)})'[${nextLabel}]`
    );
    vLabel = nextLabel;
  });

  // --- captions ---
  let assPath: string | null = null;
  const captionChunks = dropCutWords(normalizeChunks(captions?.chunks), tl);
  if (captions?.enabled && captionChunks.length) {
    const shiftedChunks = captionChunks
      .map((c2) => {
        const win = tl.mapWindow(c2.start, c2.end);
        if (!win) return null;
        const words = c2.words?.map((w) => ({ word: w.word, start: tl.map(w.start), end: tl.map(w.end) }));
        return { text: c2.text, start: win.start, end: win.end, words };
      })
      .filter((c2): c2 is NonNullable<typeof c2> => !!c2);

    if (shiftedChunks.length) {
      assPath = path.join(outDir, `${baseName}-captions.ass`);
      fs.writeFileSync(assPath, buildAssFromChunks(shiftedChunks, normalizeCaptionStyle(captions.style)));
      const nextLabel = "capped";
      videoFilters.push(
        `[${vLabel}]ass=${escapeForFilterPath(assPath)}:fontsdir=${escapeForFilterPath(CAPTION_FONTS_DIR)}[${nextLabel}]`
      );
      vLabel = nextLabel;
    }
  }

  // --- progress bar (sweeps left to right over the whole output) ---
  if (polish.progressBar.enabled) {
    const pb = polish.progressBar;
    const inputIdx = nextInputIndex++;
    inputs.push("-f", "lavfi", "-i", `color=c=${hex0x(pb.color)}:s=1080x${pb.height}:r=30`);
    const y = pb.position === "top" ? "0" : "H-h";
    videoFilters.push(`[${vLabel}][${inputIdx}:v]overlay=x='-w+w*t/${sec(D)}':y=${y}:shortest=1[pbar]`);
    vLabel = "pbar";
  }

  // --- fades ---
  const fades: string[] = [];
  if (polish.fadeIn > 0) fades.push(`fade=t=in:st=0:d=${polish.fadeIn}`);
  if (polish.fadeOut > 0) fades.push(`fade=t=out:st=${sec(Math.max(0, D - polish.fadeOut))}:d=${polish.fadeOut}`);
  if (fades.length) {
    videoFilters.push(`[${vLabel}]${fades.join(",")}[faded]`);
    vLabel = "faded";
  }

  // --- audio: clean-up, background music, fades ---
  if (aLabel) {
    const clean: string[] = [];
    if (audio.denoise) clean.push("highpass=f=80", "afftdn=nf=-28");
    if (audio.normalize) clean.push("loudnorm=I=-16:TP=-1.5:LRA=11", "aresample=48000");
    if (clean.length) {
      audioFilters.push(`[${aLabel}]${clean.join(",")}[aclean]`);
      aLabel = "aclean";
    }
  }
  if (music) {
    const musicInputIdx = nextInputIndex++;
    inputs.push("-stream_loop", "-1", "-i", music.path);
    const musicChain = `[${musicInputIdx}:a]atrim=0:${sec(D)},asetpts=PTS-STARTPTS,volume=${Math.max(0, Math.min(1, music.volume))}[musicA]`;
    if (aLabel) {
      audioFilters.push(`[${aLabel}]volume=${Math.max(0, Math.min(1, music.duckOriginal))}[origA]`);
      audioFilters.push(musicChain);
      audioFilters.push(`[origA][musicA]amix=inputs=2:duration=first:dropout_transition=0[aout]`);
    } else {
      audioFilters.push(musicChain.replace("[musicA]", "[aout]"));
    }
    aLabel = "aout";
  }
  const audioFades: string[] = [];
  if (polish.fadeIn > 0) audioFades.push(`afade=t=in:st=0:d=${polish.fadeIn}`);
  if (polish.fadeOut > 0) audioFades.push(`afade=t=out:st=${sec(Math.max(0, D - polish.fadeOut))}:d=${polish.fadeOut}`);
  if (aLabel && audioFades.length) {
    audioFilters.push(`[${aLabel}]${audioFades.join(",")}[afaded]`);
    aLabel = "afaded";
  }

  // map the audio: a filter-graph output, the untouched input stream, or nothing
  const audioMap: string[] =
    aLabel === null ? ["-an"] : aLabel === "0:a" ? ["-map", "0:a?"] : ["-map", `[${aLabel}]`];

  const filterComplex = [...videoFilters, ...audioFilters].join(";");

  const args = [
    ...inputs,
    "-filter_complex",
    filterComplex,
    "-map",
    `[${vLabel}]`,
    ...audioMap,
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "21",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-t",
    sec(D),
    "-movflags",
    "+faststart",
    videoPath,
  ];

  await ffmpeg(args);
  await ffmpeg(["-ss", String(Math.min(D / 2, 1)), "-i", videoPath, "-frames:v", "1", "-q:v", "3", thumbPath]);

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
