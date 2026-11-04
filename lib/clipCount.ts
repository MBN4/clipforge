export interface ClipCountRange {
  min: number;
  max: number;
  default: number;
}

export function clipCountRange(durationSeconds: number): ClipCountRange {
  if (!durationSeconds || durationSeconds <= 0) {
    return { min: 1, max: 6, default: 3 };
  }
  const max = Math.max(1, Math.min(10, Math.floor(durationSeconds / 20)));
  const def = Math.max(1, Math.min(max, Math.round(durationSeconds / 45)));
  return { min: 1, max, default: def || 1 };
}

export function clampClipCount(count: number, durationSeconds: number): number {
  const { min, max } = clipCountRange(durationSeconds);
  return Math.max(min, Math.min(max, Math.round(count) || min));
}
