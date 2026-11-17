// "Most-watched moment" clip picking.
//
// YouTube publishes a "most replayed" graph per video — the spiky curve above the
// seek bar. yt-dlp exposes it as `heatmap`. We turn it (or, for sources without one,
// the loudness of the audio) into a per-second interest curve, then cut a clip around
// each of the tallest spikes. A clip is as wide as its spike, so lengths differ.
import fs from "node:fs";
import type { Transcript, Word } from "./types";
import { flattenWords, titleFromText, type SelectedClip } from "./highlights";

/** One bucket of YouTube's most-replayed graph: `value` is 0..1 relative to the video's busiest moment. */
export interface HeatPoint {
  start: number;
  end: number;
  value: number;
}

export type PeakSource = "heatmap" | "audio";

const MIN_CLIP = 15;
const MAX_CLIP = 60;
const LEAD_IN = 2; // start a little before the spike builds
const LEAD_OUT = 1;
const SNAP = 5; // how far a cut may move to land on a sentence boundary
/** Spikes below this share of the tallest one aren't worth a clip. */
const MIN_PEAK_SHARE = 0.25;

/**
 * Sample the heatmap into one value per second of the (possibly trimmed) video.
 * `offset` is where the video starts in the original timeline, so a user-picked section lines up.
 */
export function heatmapToCurve(points: HeatPoint[], duration: number, offset = 0): number[] {
  const n = Math.max(1, Math.ceil(duration));
  const sorted = [...points].sort((a, b) => a.start - b.start);
  const curve = new Array<number>(n).fill(0);
  let p = 0;
  for (let i = 0; i < n; i++) {
    const t = offset + i + 0.5;
    while (p < sorted.length - 1 && sorted[p].end <= t) p++;
    const hit = sorted[p];
    curve[i] = hit && t >= hit.start && t < hit.end ? hit.value : 0;
  }
  return curve;
}

/** Locate the PCM payload of a WAV file, skipping any LIST/other chunks ffmpeg adds. */
function findWavData(fd: number): { offset: number; length: number } | null {
  const head = Buffer.alloc(4096);
  const read = fs.readSync(fd, head, 0, head.length, 0);
  if (read < 12 || head.toString("ascii", 0, 4) !== "RIFF") return null;
  let pos = 12;
  while (pos + 8 <= read) {
    const id = head.toString("ascii", pos, pos + 4);
    const size = head.readUInt32LE(pos + 4);
    if (id === "data") return { offset: pos + 8, length: size };
    pos += 8 + size + (size % 2);
  }
  return null;
}

/**
 * Loudness per second of a 16 kHz mono 16-bit WAV (what transcribe.ts extracts), scaled 0..1.
 * Used when a source has no most-replayed graph: bursts of energy are where the video peaks.
 */
export function audioEnergyCurve(wavPath: string, duration: number): number[] | null {
  let fd: number | undefined;
  try {
    fd = fs.openSync(wavPath, "r");
    const data = findWavData(fd);
    if (!data) return null;
    const BYTES_PER_SEC = 16000 * 2;
    const seconds = Math.min(Math.ceil(duration), Math.floor(data.length / BYTES_PER_SEC) || Math.ceil(duration));
    const buf = Buffer.alloc(BYTES_PER_SEC);
    const rms: number[] = [];
    for (let s = 0; s < seconds; s++) {
      const got = fs.readSync(fd, buf, 0, BYTES_PER_SEC, data.offset + s * BYTES_PER_SEC);
      const samples = got >> 1;
      if (samples <= 0) {
        rms.push(0);
        continue;
      }
      let sum = 0;
      for (let i = 0; i < samples; i++) {
        const v = buf.readInt16LE(i * 2) / 32768;
        sum += v * v;
      }
      rms.push(Math.sqrt(sum / samples));
    }
    if (!rms.length) return null;
    // loudness is perceived on a log scale; then stretch the 10th–98th percentile to 0..1
    const db = rms.map((r) => 20 * Math.log10(Math.max(r, 1e-5)));
    const sorted = [...db].sort((a, b) => a - b);
    const lo = sorted[Math.floor(sorted.length * 0.1)];
    const hi = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.98))];
    if (hi - lo < 3) return null; // essentially flat audio — nothing stands out
    return db.map((v) => Math.min(1, Math.max(0, (v - lo) / (hi - lo))));
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function smooth(curve: number[], radius: number): number[] {
  return curve.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - radius); j <= Math.min(curve.length - 1, i + radius); j++) {
      sum += curve[j];
      n++;
    }
    return sum / n;
  });
}

/** Move a cut to the closest sentence boundary within SNAP seconds, if the transcript has one. */
function snapTo(t: number, boundaries: number[]): number {
  let best = t;
  let dist = SNAP;
  for (const b of boundaries) {
    const d = Math.abs(b - t);
    if (d < dist) {
      best = b;
      dist = d;
    }
  }
  return best;
}

export interface PeakPick {
  start: number;
  end: number;
  /** 0..1 height of the spike this clip was cut around */
  strength: number;
}

/**
 * Cut one clip around each of the tallest spikes. A spike's width decides the clip's length:
 * grow outward from the peak while the curve stays above 60% of the peak's height.
 * Returns fewer than `count` picks if the curve runs out of real spikes, and none if it's flat.
 */
export function pickPeaks(curve: number[], count: number, boundaries: number[] = []): PeakPick[] {
  const n = curve.length;
  if (n < MIN_CLIP || count < 1) return [];
  const s = smooth(curve, 2);
  const max = Math.max(...s);
  const min = Math.min(...s);
  if (max <= 0 || max - min < 0.12) return []; // flat — no spike to follow

  const claimed = new Array<boolean>(n).fill(false);
  const picks: PeakPick[] = [];

  while (picks.length < count) {
    let peak = -1;
    for (let i = 0; i < n; i++) if (!claimed[i] && (peak < 0 || s[i] > s[peak])) peak = i;
    if (peak < 0 || s[peak] < max * MIN_PEAK_SHARE) break;

    const level = s[peak] * 0.6;
    let lo = peak;
    let hi = peak;
    while (lo > 0 && !claimed[lo - 1] && s[lo - 1] >= level && hi - lo + 1 < MAX_CLIP) lo--;
    while (hi < n - 1 && !claimed[hi + 1] && s[hi + 1] >= level && hi - lo + 1 < MAX_CLIP) hi++;
    // a narrow spike still needs enough room to be a watchable clip: grow toward the busier side
    while (hi - lo + 1 < MIN_CLIP) {
      const canL = lo > 0 && !claimed[lo - 1];
      const canR = hi < n - 1 && !claimed[hi + 1];
      if (!canL && !canR) break;
      if (canL && (!canR || s[lo - 1] >= s[hi + 1])) lo--;
      else hi++;
    }

    // pad the cut, but never into a neighbouring clip's territory
    let start = lo;
    for (let k = 0; k < LEAD_IN && start > 0 && !claimed[start - 1]; k++) start--;
    let end = hi + 1;
    for (let k = 0; k < LEAD_OUT && end < n && !claimed[end]; k++) end++;
    if (boundaries.length) {
      const ss = snapTo(start, boundaries);
      const ee = Math.min(n, snapTo(end, boundaries));
      const free = !claimed.slice(Math.floor(ss), Math.ceil(ee)).some(Boolean);
      if (free && ee - ss >= MIN_CLIP && ee - ss <= MAX_CLIP + SNAP) {
        start = ss;
        end = ee;
      }
    }
    // reserve this clip plus a 3s gap so the next pick can't overlap or touch it
    for (let i = Math.max(0, Math.floor(start) - 3); i < Math.min(n, Math.ceil(end) + 3); i++) claimed[i] = true;
    if (end - start >= 6) picks.push({ start, end, strength: curve[peak] });
  }

  return picks.sort((a, b) => a.start - b.start);
}

/** Turn peak picks into clips, with transcript words/titles when there is a real transcript. */
export function peaksToClips(picks: PeakPick[], transcript: Transcript, source: PeakSource): SelectedClip[] {
  const words: Word[] = transcript.method === "whisper" ? flattenWords(transcript.segments) : [];
  const ranks = [...picks].sort((a, b) => b.strength - a.strength).map((p) => p.start);
  return picks.map((p, i) => {
    const inside = words.filter((w) => w.start >= p.start && w.end <= p.end);
    const text = inside.map((w) => w.word).join(" ");
    const { title, hook } = titleFromText(text, i);
    const rank = ranks.indexOf(p.start) + 1;
    return {
      start: p.start,
      end: p.end,
      text,
      words: inside,
      score: Math.round(p.strength * 100) / 10,
      reason:
        source === "heatmap"
          ? `#${rank} most-replayed moment — viewers rewatch this part the most`
          : `#${rank} energy spike — the loudest, most intense stretch of the video`,
      title,
      hook,
    };
  });
}

/** Sentence-ending timestamps from the transcript, used to land cuts between sentences. */
export function sentenceBoundaries(transcript: Transcript): number[] {
  if (transcript.method !== "whisper") return [];
  const out: number[] = [];
  for (const seg of transcript.segments) {
    out.push(seg.start, seg.end);
  }
  return out;
}
