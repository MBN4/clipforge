import type { CaptionChunk, CaptionStyle } from "./captions";

export type JobStage =
  | "queued"
  | "downloading"
  | "transcribing"
  | "analyzing"
  | "rendering"
  | "done"
  | "error"
  | "cancelled";

/** "auto": score the transcript. "peaks": cut around the most-watched / most intense moments. */
export type ClipMode = "auto" | "peaks";

export interface Word {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
  words: Word[];
}

export interface Transcript {
  method: "whisper" | "heuristic";
  language?: string;
  duration: number;
  segments: TranscriptSegment[];
}

export interface ClipResult {
  id: string;
  index: number;
  start: number;
  end: number;
  duration: number;
  title: string;
  hook: string;
  score: number;
  reason: string;
  videoPath: string;
  thumbPath: string;
  /** Uncropped, unedited stream-copy trim of the source — the editor's working source. */
  rawPath: string;
  /** Word timings relative to the clip's own start (0 = clip start), for caption editing. */
  words: Word[];
}

/** Seconds of footage clipped per automatic part, and per batch before the user is asked to continue. */
export const SERIES_PART_SEC = 30 * 60;
export const SERIES_BATCH_SEC = 2 * 3600;

/**
 * A long video clipped in consecutive parts. Part N+1 starts by itself when part N finishes; after
 * `batchSec` of footage the series pauses and asks the user whether to continue, skip some of the
 * video, or stop. The same record is kept on every job of the series (see lib/series.ts).
 */
export interface SeriesInfo {
  id: string;
  /** shown as "<baseTitle> · Part N" */
  baseTitle: string;
  /** length of the whole source video, seconds */
  videoEnd: number;
  partSec: number;
  batchSec: number;
  /** this job's part number, 1-based */
  index: number;
  /** source time where the next part would start (end of the newest part) */
  cursor: number;
  /** seconds clipped since the user last said "continue" */
  batchDone: number;
  /** parts the user chose not to clip */
  skipped: { start: number; end: number }[];
  /** running: next part starts by itself · paused: waiting for the user (batch done / a part failed) ·
   * stopped: user stopped it · complete: reached the end of the video */
  status: "running" | "paused" | "stopped" | "complete";
  /** why it is paused */
  pausedFor?: "batch" | "error";
}

export interface Job {
  id: string;
  createdAt: number;
  updatedAt: number;
  source: {
    type: "url" | "upload";
    url?: string;
    filename?: string;
    platform?: string;
  };
  stage: JobStage;
  progress: number;
  message: string;
  error?: string;
  sourceDuration?: number;
  transcriptMethod?: "whisper" | "heuristic";
  clips: ClipResult[];
  /** Display name — the video title, or the uploaded filename. */
  title?: string;
  thumbnail?: string;
  /** What the user asked for; kept so a failed job can be retried as-is. */
  request?: { clipCount?: number; range?: { start: number; end: number }; mode?: ClipMode; quality?: number };
  /** How the clips were actually chosen (peaks mode falls back from heatmap to audio to transcript). */
  pickMethod?: "heatmap" | "audio" | "transcript";
  /** When the pipeline actually began / ended (createdAt is when it was submitted). */
  startedAt?: number;
  finishedAt?: number;
  /** Time spent blocked waiting for a free slot behind other jobs. */
  waitedMs?: number;
  /** True while the job is queued behind other work. */
  waiting?: boolean;
  /** set when this job is one part of a long video clipped automatically in sections */
  series?: SeriesInfo;
  /** Milliseconds spent in each stage (includes any waiting inside it). */
  timings?: Partial<Record<JobStage, number>>;
}

// ---- Editor / export ----

export type StickerType = "star" | "heart" | "fire" | "bolt" | "check" | "laugh" | "arrow" | "sparkle";

export interface TextOverlaySpec {
  id: string;
  text: string;
  x: number; // 0..1, center position
  y: number; // 0..1
  fontSize: number; // reference px at 1080 output width
  color: string; // "#rrggbb"
  bold: boolean;
  start: number; // seconds, relative to the (post-trim) clip timeline
  end: number;
}

export interface StickerSpec {
  id: string;
  type: StickerType;
  x: number; // 0..1, center position
  y: number; // 0..1
  size: number; // reference px at 1080 output width
  color: string;
  start: number;
  end: number;
}

export interface CropSpec {
  x: number; // 0..1 normalized focal point
  y: number; // 0..1
  zoom: number; // >=1
}

export interface FilterSpec {
  brightness: number; // -1..1
  contrast: number; // -1..1 (mapped to ffmpeg's 0..2 range)
  saturation: number; // -1..1 (mapped to ffmpeg's 0..3 range)
  /** -1 (cool/blue) .. 1 (warm/orange). Optional so older saved edits still load. */
  warmth?: number;
  /** 0 (off) .. 1 (strong) edge darkening. */
  vignette?: number;
  /** 0 (off) .. 1 sharpening. */
  sharpen?: number;
}

export interface TimeRange {
  start: number;
  end: number;
}

/** Audio clean-up applied to the clip's own sound. */
export interface AudioSpec {
  /** high-pass + FFT noise reduction */
  denoise: boolean;
  /** EBU R128 loudness normalisation (-16 LUFS, the short-form standard) */
  normalize: boolean;
}

export interface ProgressBarSpec {
  enabled: boolean;
  color: string; // "#rrggbb"
  position: "top" | "bottom";
  height: number; // px at 1080 width
}

export interface PolishSpec {
  fadeIn: number; // seconds, 0 = off
  fadeOut: number; // seconds, 0 = off
  progressBar: ProgressBarSpec;
}

/** "fill" crops to 9:16; "fit" shows the whole frame over a blurred copy of itself. */
export type LayoutMode = "fill" | "fit";

export interface MusicSpec {
  path: string;
  volume: number; // 0..1
  duckOriginal: number; // 0..1 multiplier applied to the clip's own audio
}

export interface CaptionsSpec {
  enabled: boolean;
  chunks: CaptionChunk[];
  style: CaptionStyle;
}

export interface ExportSpec {
  trim: { start: number; end: number };
  crop: CropSpec;
  captions: CaptionsSpec;
  textOverlays: TextOverlaySpec[];
  stickers: StickerSpec[];
  filters: FilterSpec;
  music: MusicSpec | null;
  /** Ranges (source time) to cut out, e.g. silences and filler words. */
  removed?: TimeRange[];
  /** Playback speed, 0.5..2. */
  speed?: number;
  audio?: AudioSpec;
  polish?: PolishSpec;
  layout?: LayoutMode;
  /** output width in px: 720, 1080 (default), 1440 or 2160 */
  quality?: number;
}
