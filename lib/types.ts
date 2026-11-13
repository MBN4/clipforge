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
  request?: { clipCount?: number; range?: { start: number; end: number } };
  /** When the pipeline actually began / ended (createdAt is when it was submitted). */
  startedAt?: number;
  finishedAt?: number;
  /** Time spent blocked waiting for a free slot behind other jobs. */
  waitedMs?: number;
  /** True while the job is queued behind other work. */
  waiting?: boolean;
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
}

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
}
