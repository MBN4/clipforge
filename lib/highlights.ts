import type { Transcript, TranscriptSegment, Word } from "./types";

export interface Window {
  start: number;
  end: number;
  text: string;
  words: Word[];
  score: number;
  reason: string;
}

const HOOK_WORDS = [
  "never", "secret", "mistake", "honestly", "literally", "insane", "crazy",
  "wait", "important", "truth", "nobody", "everyone", "wrong", "right",
  "biggest", "worst", "best", "actually", "shocking", "finally", "stop",
  "listen", "number one", "rule", "hack", "lesson", "fail", "win", "lie",
  "problem", "reason", "because", "key", "love", "hate", "amazing", "wild",
];

const MIN_CLIP = 18;
const MAX_CLIP = 55;
const DEFAULT_TARGET_COUNT = 5;

export function flattenWords(segments: TranscriptSegment[]): Word[] {
  const words: Word[] = [];
  for (const seg of segments) {
    if (seg.words && seg.words.length) {
      words.push(...seg.words);
    } else if (seg.text) {
      // no word timings, approximate even spacing across the segment
      const parts = seg.text.split(/\s+/).filter(Boolean);
      const span = (seg.end - seg.start) / Math.max(parts.length, 1);
      parts.forEach((w, i) => {
        words.push({ word: w, start: seg.start + i * span, end: seg.start + (i + 1) * span });
      });
    }
  }
  return words;
}

// A window's keyword/punctuation hits add up with its length, so raw sums always crown the
// longest window (nearly every clip came out ~55s). Hits are therefore counted per 25s of
// speech: windows of 25s or more compete on equal terms, and only a genuinely better moment wins.
const LENGTH_NEUTRAL_SECS = 25;

function scoreText(text: string, wordsPerSec: number, duration: number): { score: number; reason: string } {
  const lower = text.toLowerCase();
  let hitScore = 0;
  const hits: string[] = [];
  for (const kw of HOOK_WORDS) {
    if (lower.includes(kw)) {
      hitScore += 1.4;
      hits.push(kw);
    }
  }
  const exclam = (text.match(/!/g) || []).length;
  const question = (text.match(/\?/g) || []).length;
  hitScore += exclam * 0.8 + question * 0.6;
  let score = hitScore * (LENGTH_NEUTRAL_SECS / Math.max(duration, LENGTH_NEUTRAL_SECS));
  score += Math.min(wordsPerSec, 3.2) * 1.1;
  if (/\b(i|you|we)\b/i.test(text)) score += 0.6;
  const reason = hits.length
    ? `Hooks on "${hits.slice(0, 2).join(", ")}" with punchy pacing`
    : exclam || question
    ? "High energy delivery with emphasis"
    : "Strong, self-contained moment";
  return { score, reason };
}

const endsSentence = (w: string) => /[.!?]["')\]]*$/.test(w.trim());

function buildWindowsFromWords(words: Word[], duration: number): Window[] {
  const windows: Window[] = [];
  if (!words.length) return windows;

  for (let i = 0; i < words.length; i++) {
    // start where a sentence starts and end where one ends, so clips don't open or stop mid-thought —
    // which is also what makes their lengths follow the content instead of a fixed size
    const startsSentence = i === 0 || endsSentence(words[i - 1].word) || words[i].start - words[i - 1].end > 0.7;
    if (!startsSentence) continue;
    const startWord = words[i];
    let j = i;
    let text = "";
    while (j < words.length && words[j].end - startWord.start <= MAX_CLIP) {
      text += (text ? " " : "") + words[j].word;
      const len = words[j].end - startWord.start;
      const endsHere = endsSentence(words[j].word) || (words[j + 1] && words[j + 1].start - words[j].end > 0.7) || j === words.length - 1;
      if (len >= MIN_CLIP && endsHere) {
        const slice = words.slice(i, j + 1);
        const wps = slice.length / Math.max(len, 1);
        const { score, reason } = scoreText(text, wps, len);
        windows.push({ start: startWord.start, end: words[j].end, text, words: slice, score, reason });
      }
      j++;
    }
    // skip ahead to keep candidate count sane on long transcripts
    if (words.length > 1200) i += 2;
  }
  return windows;
}

function greedySelect(windows: Window[], count: number, minGap: number, duration: number): Window[] {
  const sorted = [...windows].sort((a, b) => b.score - a.score);
  const picked: Window[] = [];
  for (const w of sorted) {
    if (picked.length >= count) break;
    const overlaps = picked.some(
      (p) => w.start < p.end + minGap && w.end > p.start - minGap
    );
    if (!overlaps) picked.push(w);
  }
  return picked.sort((a, b) => a.start - b.start);
}

function topUp(selected: Window[], targetCount: number, duration: number): Window[] {
  if (selected.length >= targetCount || duration <= 0) return selected;
  const extra = evenSplit(duration, targetCount);
  const result = [...selected];
  for (const w of extra) {
    if (result.length >= targetCount) break;
    const overlaps = result.some((p) => w.start < p.end && w.end > p.start);
    if (!overlaps) result.push(w);
  }
  return result.sort((a, b) => a.start - b.start);
}

// Evenly spaced picks used when there's no transcript to score. Giving each the same length looked
// robotic, so lengths cycle through a few proportions of the slot (still inside MIN..MAX_CLIP).
const LENGTH_PATTERN = [1, 0.7, 0.88, 0.58, 0.8];

function evenSplit(duration: number, count: number): Window[] {
  const slot = duration / count;
  const windows: Window[] = [];
  for (let i = 0; i < count; i++) {
    const clipLen = Math.min(MAX_CLIP, Math.max(MIN_CLIP, Math.min(slot, MAX_CLIP) * LENGTH_PATTERN[i % LENGTH_PATTERN.length]));
    const start = i * slot;
    const end = Math.min(duration, start + clipLen);
    if (end - start < 6) continue;
    windows.push({
      start,
      end,
      text: "",
      words: [],
      score: 0,
      reason: "Evenly sampled moment from the source",
    });
  }
  return windows;
}

export interface SelectedClip extends Window {
  title: string;
  hook: string;
}

export function titleFromText(text: string, index: number): { title: string; hook: string } {
  if (!text) return { title: `Clip ${index + 1}`, hook: "Auto-detected highlight" };
  const clean = text.replace(/\s+/g, " ").trim();
  const sentence = clean.split(/(?<=[.!?])\s/)[0] || clean;
  const title = sentence.length > 60 ? sentence.slice(0, 57) + "…" : sentence;
  const hook = clean.length > 90 ? clean.slice(0, 87) + "…" : clean;
  return { title: title.replace(/^./, (c) => c.toUpperCase()), hook };
}

export function selectHighlights(transcript: Transcript, targetCount = DEFAULT_TARGET_COUNT): SelectedClip[] {
  const words = flattenWords(transcript.segments);
  let windows =
    transcript.method === "whisper" && words.length
      ? buildWindowsFromWords(words, transcript.duration)
      : [];

  let selected: Window[];
  if (windows.length) {
    selected = greedySelect(windows, targetCount, 4, transcript.duration);
    if (!selected.length) selected = evenSplit(transcript.duration, targetCount);
  } else {
    // No real transcript to score candidates by — every detected speech span
    // ties at the same score, and greedy selection among ties resolves in
    // chronological order, so it used to silently cluster every pick near
    // the start of the video (e.g. the first ~6 minutes of a 13-minute
    // video) instead of covering the whole thing. Spread evenly across the
    // full duration instead — a much safer default with no real scoring
    // signal to go on.
    selected = evenSplit(transcript.duration, targetCount);
  }

  if (!selected.length) selected = evenSplit(transcript.duration, targetCount);
  selected = topUp(selected, targetCount, transcript.duration);

  return selected.map((w, i) => {
    const { title, hook } = titleFromText(w.text, i);
    return { ...w, title, hook };
  });
}
