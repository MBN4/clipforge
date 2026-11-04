export interface ClipCountRange {
  min: number;
  max: number;
  default: number;
}

// A clip needs ~18-55s of content, so roughly one usable clip per 20s of
// source is a sane ceiling — but the UI shouldn't ever be limited to a flat
// number regardless of length. Long (1hr+) videos should unlock noticeably
// more options than a 2-minute clip.
const ABSOLUTE_MAX = 40;

export function clipCountRange(durationSeconds: number): ClipCountRange {
  if (!durationSeconds || durationSeconds <= 0) {
    return { min: 1, max: 6, default: 3 };
  }
  const max = Math.max(1, Math.min(ABSOLUTE_MAX, Math.floor(durationSeconds / 20)));
  const def = Math.max(1, Math.min(max, Math.round(durationSeconds / 45)));
  return { min: 1, max, default: def || 1 };
}

export function clampClipCount(count: number, durationSeconds: number): number {
  const { min, max } = clipCountRange(durationSeconds);
  return Math.max(min, Math.min(max, Math.round(count) || min));
}
