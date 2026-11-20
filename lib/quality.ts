/** Output quality of a clip. The key is the frame WIDTH in px; clips are 9:16, so 1080 means 1080x1920. */
export type Quality = 720 | 1080 | 1440 | 2160;

export const DEFAULT_QUALITY: Quality = 1080;

export interface QualityOption {
  key: Quality;
  label: string;
  /** shown next to the label */
  hint: string;
}

export const QUALITIES: QualityOption[] = [
  { key: 720, label: "720p", hint: "720×1280 · smallest files, fastest" },
  { key: 1080, label: "1080p (Full HD)", hint: "1080×1920 · best for most uses" },
  { key: 1440, label: "2K (1440p)", hint: "1440×2560 · sharper, ~2× the data" },
  { key: 2160, label: "4K (2160p)", hint: "2160×3840 · largest, slowest to make" },
];

export function normalizeQuality(v: unknown): Quality {
  const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : NaN;
  return n === 720 || n === 1080 || n === 1440 || n === 2160 ? n : DEFAULT_QUALITY;
}

/** Output frame size for a quality (even numbers, 9:16). */
export function qualityDims(q: Quality) {
  return { w: q as number, h: Math.round(((q as number) * 16) / 9 / 2) * 2, k: (q as number) / 1080 };
}
