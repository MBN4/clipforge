// Edit timeline maths shared by the export (server) and the live preview (browser).
//
// A clip is edited in *source time* (seconds into the clip's raw file). The final video
// may drop ranges (silences, filler words) and play faster or slower, so anything placed
// by time — captions, text, stickers, the progress bar — has to be mapped from source time
// to output time. Keeping that in one pure module means the editor and ffmpeg agree.

export interface Range {
  start: number;
  end: number;
}

export interface Segment {
  /** kept range in source time */
  src0: number;
  src1: number;
  /** where this segment starts in the output timeline (seconds, after speed) */
  out0: number;
}

export interface Timeline {
  segments: Segment[];
  /** output length in seconds (after cuts and speed) */
  duration: number;
  speed: number;
  /** true when nothing is cut (a single segment covering the whole trim) */
  untouched: boolean;
  /** Source time -> output time. Times inside a removed range collapse to its start. */
  map(t: number): number;
  /** Source window -> output window, or null if it vanishes. */
  mapWindow(start: number, end: number): Range | null;
  /** Is this source time inside a removed range (within the trim)? */
  isRemoved(t: number): boolean;
  /** If t is inside a removed range, the source time where playback should resume. */
  skipTo(t: number): number | null;
}

export const MIN_SEGMENT = 0.08;
export const MAX_RANGES = 300;

/** Clamp, sort and merge ranges. Accepts untrusted input. */
export function normalizeRanges(input: unknown, min = 0, max = 1e6): Range[] {
  if (!Array.isArray(input)) return [];
  const out: Range[] = [];
  for (const raw of input.slice(0, MAX_RANGES * 2)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const a = typeof r.start === "number" ? r.start : NaN;
    const b = typeof r.end === "number" ? r.end : NaN;
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const start = Math.max(min, Math.min(max, a));
    const end = Math.max(min, Math.min(max, b));
    if (end - start > 0.01) out.push({ start, end });
  }
  out.sort((x, y) => x.start - y.start);
  const merged: Range[] = [];
  for (const r of out) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end + 0.001) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }
  return merged.slice(0, MAX_RANGES);
}

export function clampSpeed(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (!Number.isFinite(n)) return 1;
  return Math.min(2, Math.max(0.5, Math.round(n * 100) / 100));
}

export function buildTimeline(trim: Range, removedInput: Range[] = [], speedInput = 1): Timeline {
  const speed = clampSpeed(speedInput);
  const removed = normalizeRanges(removedInput, trim.start, trim.end);

  let kept: Range[] = [];
  let cursor = trim.start;
  for (const r of removed) {
    if (r.start > cursor) kept.push({ start: cursor, end: r.start });
    cursor = Math.max(cursor, r.end);
  }
  if (cursor < trim.end) kept.push({ start: cursor, end: trim.end });
  kept = kept.filter((k) => k.end - k.start >= MIN_SEGMENT);
  // cutting everything would leave nothing to export; fall back to the plain trim
  if (!kept.length) kept = [{ start: trim.start, end: trim.end }];

  const segments: Segment[] = [];
  let out = 0;
  for (const k of kept) {
    segments.push({ src0: k.start, src1: k.end, out0: out });
    out += (k.end - k.start) / speed;
  }
  const duration = Math.max(0.1, out);
  const untouched = segments.length === 1 && segments[0].src0 <= trim.start + 1e-6 && segments[0].src1 >= trim.end - 1e-6;

  const map = (t: number) => {
    for (const s of segments) {
      if (t < s.src0) return s.out0;
      if (t <= s.src1) return s.out0 + (t - s.src0) / speed;
    }
    return duration;
  };

  return {
    segments,
    duration,
    speed,
    untouched,
    map,
    mapWindow(start, end) {
      const a = map(start);
      const b = map(end);
      return b - a < 0.02 ? null : { start: a, end: b };
    },
    isRemoved(t) {
      if (untouched || t < trim.start || t > trim.end) return false;
      return !segments.some((s) => t >= s.src0 - 1e-6 && t < s.src1);
    },
    skipTo(t) {
      if (untouched || t < trim.start || t >= trim.end) return null;
      if (segments.some((s) => t >= s.src0 - 1e-6 && t < s.src1)) return null;
      const next = segments.find((s) => s.src0 > t);
      return next ? next.src0 : trim.end;
    },
  };
}
