import type { Word } from "./types";
import { getCaptionFont, isKnownCaptionFont } from "./captionFonts";

// Animated, fully customizable captions.
//
// Everything here is a pure function of (chunk, style, time) and is shared by
// two renderers that must agree with each other:
//   - the in-browser editor preview (components/editor/CaptionOverlay.tsx),
//     which evaluates the animations every animation frame, and
//   - the ffmpeg/libass export (buildAssFromChunks below), which encodes the
//     exact same keyframes as ASS override tags.
// Keep any change to the animation maths in this file so the two can't drift.

export interface CaptionChunk {
  text: string;
  start: number;
  end: number;
  /** Per-word timings (same timeline as start/end), when known from the
   * transcript. Used by word-level effects; if the chunk's text has been
   * edited so the word count no longer matches, timings are re-spread evenly. */
  words?: Word[];
}

export type CaptionAnimation = "none" | "fade" | "pop" | "bounce" | "slide" | "zoom" | "swing";
export type WordEffect = "none" | "highlight" | "pop" | "karaoke" | "box" | "reveal" | "glow";

export interface CaptionStyle {
  fontFamily: string;
  /** ASS font size at 1080x1920 (the preview converts per font, see captionFonts). */
  fontSize: number;
  uppercase: boolean;
  letterSpacing: number; // px at 1080 width
  textColor: string; // "#rrggbb"
  /** Active-word colour (highlight/pop/karaoke/glow) or the box fill ("box"). */
  highlightColor: string;
  outlineColor: string;
  outlineWidth: number; // px at 1080 width
  shadowColor: string;
  shadowDepth: number;
  shadowOpacity: number; // 0..1
  background: boolean; // box behind the whole caption
  backgroundColor: string;
  backgroundOpacity: number; // 0..1
  /** Vertical centre of the caption, 0 (top) .. 1 (bottom). */
  positionY: number;
  animation: CaptionAnimation;
  wordEffect: WordEffect;
}

export const CAPTION_ANIMATIONS: { key: CaptionAnimation; label: string }[] = [
  { key: "none", label: "None" },
  { key: "fade", label: "Fade" },
  { key: "pop", label: "Pop" },
  { key: "bounce", label: "Bounce" },
  { key: "slide", label: "Slide up" },
  { key: "zoom", label: "Zoom in" },
  { key: "swing", label: "Swing" },
];

export const WORD_EFFECTS: { key: WordEffect; label: string; hint: string }[] = [
  { key: "none", label: "None", hint: "Whole caption, one colour" },
  { key: "highlight", label: "Highlight", hint: "Spoken word changes colour" },
  { key: "pop", label: "Word pop", hint: "Spoken word pops & changes colour" },
  { key: "karaoke", label: "Karaoke", hint: "Colour sweeps across as words are said" },
  { key: "box", label: "Word box", hint: "Coloured box behind the spoken word" },
  { key: "reveal", label: "Reveal", hint: "Words appear as they're spoken" },
  { key: "glow", label: "Glow", hint: "Spoken word glows" },
];

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontFamily: "Poppins",
  fontSize: 92,
  uppercase: true,
  letterSpacing: 0,
  textColor: "#ffffff",
  highlightColor: "#ffd21f",
  outlineColor: "#000000",
  outlineWidth: 7,
  shadowColor: "#000000",
  shadowDepth: 4,
  shadowOpacity: 0.5,
  background: false,
  backgroundColor: "#111111",
  backgroundOpacity: 0.65,
  positionY: 0.72,
  animation: "pop",
  wordEffect: "highlight",
};

export interface CaptionPreset {
  id: string;
  name: string;
  style: Partial<CaptionStyle>;
}

/** One-click looks. Applying a preset keeps the user's caption position;
 * each sets its own size, since fonts differ a lot in visual size. */
export const CAPTION_PRESETS: CaptionPreset[] = [
  { id: "spotlight", name: "Spotlight", style: { ...DEFAULT_CAPTION_STYLE } },
  {
    id: "karaoke",
    name: "Karaoke",
    style: {
      fontSize: 118, fontFamily: "Anton", uppercase: true, textColor: "#ffffff", highlightColor: "#25e2ff",
      outlineColor: "#000000", outlineWidth: 6, shadowDepth: 3, shadowOpacity: 0.6, background: false,
      animation: "fade", wordEffect: "karaoke", letterSpacing: 1,
    },
  },
  {
    id: "boxed",
    name: "Word box",
    style: {
      fontSize: 88, fontFamily: "Poppins", uppercase: true, textColor: "#ffffff", highlightColor: "#ff4e1f",
      outlineColor: "#000000", outlineWidth: 6, shadowDepth: 0, background: false,
      animation: "pop", wordEffect: "box", letterSpacing: 0,
    },
  },
  {
    id: "bounce",
    name: "Bouncy",
    style: {
      fontSize: 100, fontFamily: "Luckiest Guy", uppercase: true, textColor: "#ffe14d", highlightColor: "#ff4e1f",
      outlineColor: "#1a1a1a", outlineWidth: 9, shadowColor: "#000000", shadowDepth: 6, shadowOpacity: 0.7,
      background: false, animation: "bounce", wordEffect: "pop", letterSpacing: 2,
    },
  },
  {
    id: "neon",
    name: "Neon",
    style: {
      fontSize: 130, fontFamily: "Bebas Neue", uppercase: true, textColor: "#ffffff", highlightColor: "#ff2bd6",
      outlineColor: "#7a00ff", outlineWidth: 4, shadowDepth: 0, background: false,
      animation: "zoom", wordEffect: "glow", letterSpacing: 3,
    },
  },
  {
    id: "typewriter",
    name: "Typewriter",
    style: {
      fontSize: 86, fontFamily: "Archivo Black", uppercase: false, textColor: "#ffffff", highlightColor: "#ffd21f",
      outlineColor: "#000000", outlineWidth: 6, shadowDepth: 3, shadowOpacity: 0.5, background: false,
      animation: "none", wordEffect: "reveal", letterSpacing: 0,
    },
  },
  {
    id: "comic",
    name: "Comic",
    style: {
      fontSize: 124, fontFamily: "Bangers", uppercase: true, textColor: "#ffffff", highlightColor: "#ffd21f",
      outlineColor: "#000000", outlineWidth: 8, shadowColor: "#d62828", shadowDepth: 7, shadowOpacity: 1,
      background: false, animation: "swing", wordEffect: "highlight", letterSpacing: 3,
    },
  },
  {
    id: "marker",
    name: "Marker",
    style: {
      fontSize: 100, fontFamily: "Permanent Marker", uppercase: false, textColor: "#ffffff", highlightColor: "#7dff5a",
      outlineColor: "#000000", outlineWidth: 6, shadowDepth: 3, shadowOpacity: 0.5, background: false,
      animation: "slide", wordEffect: "highlight", letterSpacing: 0,
    },
  },
  {
    id: "subtitle",
    name: "Clean",
    style: {
      fontSize: 70, fontFamily: "Poppins", uppercase: false, textColor: "#ffffff", highlightColor: "#ffd21f",
      outlineColor: "#000000", outlineWidth: 0, shadowDepth: 0, background: true,
      backgroundColor: "#111111", backgroundOpacity: 0.7, animation: "fade", wordEffect: "none", letterSpacing: 0,
    },
  },
];

export function applyPreset(current: CaptionStyle, preset: CaptionPreset): CaptionStyle {
  return normalizeCaptionStyle({
    ...current,
    ...preset.style,
    positionY: current.positionY,
  });
}

// ---------------------------------------------------------------------------
// Validation (the export route receives this straight from the browser, and
// it ends up inside an ASS script, so clamp/allowlist everything).

const HEX = /^#[0-9a-fA-F]{6}$/;
const ANIMS = new Set(CAPTION_ANIMATIONS.map((a) => a.key));
const EFFECTS = new Set(WORD_EFFECTS.map((e) => e.key));

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
function color(v: unknown, fallback: string): string {
  return typeof v === "string" && HEX.test(v) ? v.toLowerCase() : fallback;
}

export function normalizeCaptionStyle(input: unknown): CaptionStyle {
  const s = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const d = DEFAULT_CAPTION_STYLE;
  // Legacy shape (pre-animated captions): {color, highlightColor-as-outline, position}
  const legacyPos: Record<string, number> = { top: 0.2, middle: 0.5, bottom: 0.78 };
  const legacy = "color" in s && !("textColor" in s);
  return {
    fontFamily: isKnownCaptionFont(s.fontFamily) ? s.fontFamily : d.fontFamily,
    fontSize: Math.round(num(s.fontSize, d.fontSize, 30, 180)),
    uppercase: typeof s.uppercase === "boolean" ? s.uppercase : d.uppercase,
    letterSpacing: num(s.letterSpacing, d.letterSpacing, -5, 30),
    textColor: color(legacy ? s.color : s.textColor, d.textColor),
    highlightColor: color(legacy ? undefined : s.highlightColor, d.highlightColor),
    outlineColor: color(legacy ? s.highlightColor : s.outlineColor, d.outlineColor),
    outlineWidth: num(s.outlineWidth, d.outlineWidth, 0, 20),
    shadowColor: color(s.shadowColor, d.shadowColor),
    shadowDepth: num(s.shadowDepth, d.shadowDepth, 0, 20),
    shadowOpacity: num(s.shadowOpacity, d.shadowOpacity, 0, 1),
    background: typeof s.background === "boolean" ? s.background : d.background,
    backgroundColor: color(s.backgroundColor, d.backgroundColor),
    backgroundOpacity: num(s.backgroundOpacity, d.backgroundOpacity, 0, 1),
    positionY:
      typeof s.position === "string" && legacyPos[s.position] !== undefined && !("positionY" in s)
        ? legacyPos[s.position]
        : num(s.positionY, d.positionY, 0.05, 0.95),
    animation: ANIMS.has(s.animation as CaptionAnimation) ? (s.animation as CaptionAnimation) : d.animation,
    wordEffect: EFFECTS.has(s.wordEffect as WordEffect) ? (s.wordEffect as WordEffect) : d.wordEffect,
  };
}

/** The box word-effect and the full-line background are drawn with
 * different libass border styles, so they can't be combined. */
export function effectiveBackground(style: CaptionStyle): boolean {
  return style.background && style.wordEffect !== "box";
}

export function normalizeChunks(input: unknown): CaptionChunk[] {
  if (!Array.isArray(input)) return [];
  const out: CaptionChunk[] = [];
  for (const raw of input.slice(0, 2000)) {
    if (!raw || typeof raw !== "object") continue;
    const c = raw as Record<string, unknown>;
    const text = typeof c.text === "string" ? c.text.slice(0, 300) : "";
    const start = num(c.start, NaN, 0, 1e6);
    const end = num(c.end, NaN, 0, 1e6);
    if (!text.trim() || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const words = Array.isArray(c.words)
      ? c.words
          .map((raw: unknown) => {
            const w = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
            return {
              word: typeof w.word === "string" ? w.word.slice(0, 80) : "",
              start: num(w.start, NaN, 0, 1e6),
              end: num(w.end, NaN, 0, 1e6),
            };
          })
          .filter((w) => w.word && Number.isFinite(w.start) && Number.isFinite(w.end))
      : undefined;
    out.push({ text, start, end, words });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Chunking & word timing

export function groupWordsIntoChunks(words: Word[], size = 3): CaptionChunk[] {
  const chunks: CaptionChunk[] = [];
  const n = Math.max(1, Math.round(size));
  for (let i = 0; i < words.length; i += n) {
    const group = words.slice(i, i + n);
    if (!group.length) continue;
    chunks.push({
      text: group.map((w) => w.word.trim()).join(" "),
      start: group[0].start,
      end: group[group.length - 1].end + 0.05,
      words: group.map((w) => ({ word: w.word.trim(), start: w.start, end: w.end })),
    });
  }
  // Butt consecutive chunks up against each other when they're close: closes
  // tiny gaps (no flicker between words said back to back) and removes the
  // small overlap the +0.05 tail would otherwise create (two captions on
  // screen at once).
  for (let i = 0; i < chunks.length - 1; i++) {
    const next = chunks[i + 1].start;
    if (next - chunks[i].end < 0.35 && next > chunks[i].start) chunks[i].end = next;
  }
  return chunks;
}

export interface TimedWord {
  text: string;
  start: number;
  end: number;
}

/** Words of a chunk (as currently typed) with timings, clamped to the chunk. */
export function chunkWordTimings(chunk: CaptionChunk, uppercase = false): TimedWord[] {
  const tokens = chunk.text.split(/\s+/).filter(Boolean).map((t) => (uppercase ? t.toUpperCase() : t));
  if (!tokens.length) return [];
  const span = Math.max(0.01, chunk.end - chunk.start);
  const clamp = (t: number) => Math.min(chunk.end, Math.max(chunk.start, t));
  if (chunk.words && chunk.words.length === tokens.length) {
    return tokens.map((text, i) => {
      const w = chunk.words![i];
      const start = clamp(w.start);
      return { text, start, end: Math.max(start, clamp(w.end)) };
    });
  }
  // Text was edited (or no timings): spread words across the chunk,
  // weighted by length so long words get a bit more time.
  const weights = tokens.map((t) => Math.max(2, t.length));
  const total = weights.reduce((a, b) => a + b, 0);
  let cursor = chunk.start;
  return tokens.map((text, i) => {
    const d = (weights[i] / total) * span;
    const w = { text, start: cursor, end: cursor + d };
    cursor += d;
    return w;
  });
}

/** Index of the word "currently being said" — it stays active until the next
 * word starts, so there's always a highlighted word once speech begins. */
export function activeWordIndex(words: TimedWord[], t: number): number {
  let idx = -1;
  for (let i = 0; i < words.length; i++) {
    if (t >= words[i].start) idx = i;
    else break;
  }
  return idx;
}

// ---------------------------------------------------------------------------
// Animation keyframes (shared by preview + export)

export interface AnimState {
  s: number; // scale, percent
  o: number; // opacity 0..1
  dy: number; // vertical offset, px at 1920 height (positive = lower)
  r: number; // rotation, degrees clockwise
}
type Keyframe = AnimState & { t: number }; // t in ms from caption start

const K = (t: number, s: number, o: number, dy = 0, r = 0): Keyframe => ({ t, s, o, dy, r });

export const ENTRANCE_KEYFRAMES: Record<CaptionAnimation, Keyframe[]> = {
  none: [K(0, 100, 1)],
  fade: [K(0, 100, 0), K(180, 100, 1)],
  pop: [K(0, 60, 0), K(110, 112, 1), K(190, 100, 1)],
  bounce: [K(0, 35, 0), K(140, 122, 1), K(220, 90, 1), K(290, 105, 1), K(350, 100, 1)],
  slide: [K(0, 100, 0, 70), K(220, 100, 1, 0)],
  zoom: [K(0, 175, 0), K(200, 100, 1)],
  swing: [K(0, 90, 0, 0, -9), K(130, 106, 1, 0, 5), K(230, 100, 1, 0, -2), K(310, 100, 1, 0, 0)],
};

/** Scale keyframes for the word-pop effect, ms from the word's start. */
export const WORD_POP_KEYFRAMES: { t: number; s: number }[] = [
  { t: 0, s: 100 },
  { t: 90, s: 122 },
  { t: 180, s: 100 },
];

export const EXIT_FADE_MS = 90;
export const REVEAL_FADE_MS = 80;

function lerp(a: number, b: number, k: number) {
  return a + (b - a) * k;
}

export function entranceAt(anim: CaptionAnimation, ms: number): AnimState {
  const kfs = ENTRANCE_KEYFRAMES[anim];
  if (ms <= kfs[0].t) return kfs[0];
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i];
    const b = kfs[i + 1];
    if (ms <= b.t) {
      const k = (ms - a.t) / (b.t - a.t);
      return { s: lerp(a.s, b.s, k), o: lerp(a.o, b.o, k), dy: lerp(a.dy, b.dy, k), r: lerp(a.r, b.r, k) };
    }
  }
  return kfs[kfs.length - 1];
}

export function wordPopScaleAt(msSinceWordStart: number): number {
  const kfs = WORD_POP_KEYFRAMES;
  if (msSinceWordStart <= 0) return 100;
  for (let i = 0; i < kfs.length - 1; i++) {
    if (msSinceWordStart <= kfs[i + 1].t) {
      const k = (msSinceWordStart - kfs[i].t) / (kfs[i + 1].t - kfs[i].t);
      return lerp(kfs[i].s, kfs[i + 1].s, k);
    }
  }
  return 100;
}

/** Opacity multiplier for the short fade-out at the end of each caption. */
export function exitOpacityAt(anim: CaptionAnimation, msUntilEnd: number): number {
  if (anim === "none") return 1;
  return Math.min(1, Math.max(0, msUntilEnd / EXIT_FADE_MS));
}

// ---------------------------------------------------------------------------
// ASS (libass) export

function formatAssTime(cs: number): string {
  const total = Math.max(0, Math.round(cs));
  const h = Math.floor(total / 360000);
  const m = Math.floor((total % 360000) / 6000);
  const s = Math.floor((total % 6000) / 100);
  const c = total % 100;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(c).padStart(2, "0")}`;
}

const toCs = (seconds: number) => Math.round(seconds * 100);

/** "#rrggbb" -> ASS "&HBBGGRR&" colour override. */
function assColor(hex: string): string {
  const c = hex.replace("#", "");
  return `&H${c.slice(4, 6)}${c.slice(2, 4)}${c.slice(0, 2)}&`.toUpperCase();
}
/** "#rrggbb" + alpha (0 = opaque, 255 = transparent) -> style colour "&HAABBGGRR". */
function assStyleColor(hex: string, alpha = 0): string {
  const c = hex.replace("#", "");
  const a = Math.round(Math.min(255, Math.max(0, alpha))).toString(16).padStart(2, "0");
  return `&H${a}${c.slice(4, 6)}${c.slice(2, 4)}${c.slice(0, 2)}`.toUpperCase();
}
function assAlpha(alpha: number): string {
  return `&H${Math.round(Math.min(255, Math.max(0, alpha))).toString(16).padStart(2, "0").toUpperCase()}&`;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function sanitizeAssText(text: string): string {
  return text.replace(/[{}\\]/g, "").replace(/\s+/g, " ").trim();
}

/** Base alpha (0 opaque .. 255 transparent) for the \4 colour: the line
 * background box when enabled, the drop shadow otherwise. */
function backAlpha(style: CaptionStyle): number {
  return effectiveBackground(style) ? 255 * (1 - style.backgroundOpacity) : 255 * (1 - style.shadowOpacity);
}

/** Alpha override tags for a given overall opacity. */
function alphaTags(style: CaptionStyle, o: number): string {
  const main = assAlpha(255 * (1 - o));
  const back = assAlpha(255 - o * (255 - backAlpha(style)));
  // In "box" mode \3 is the word box, which the word effect controls.
  const outline = style.wordEffect === "box" ? "" : `\\3a${main}`;
  return `\\1a${main}${outline}\\4a${back}`;
}

function animStateTags(style: CaptionStyle, st: AnimState, withAlpha: boolean): string {
  const s = r2(st.s);
  return `\\fscx${s}\\fscy${s}\\frz${r2(-st.r)}` + (withAlpha ? alphaTags(style, st.o) : "");
}

/**
 * Override tags reproducing the entrance animation for an event that starts
 * `offsetMs` after the caption's own start (word effects split one caption
 * into several back-to-back events, so later ones pick the animation up
 * mid-flight). \t times are relative to the event start.
 */
function entranceTags(style: CaptionStyle, offsetMs: number, withAlpha = true): string {
  const kfs = ENTRANCE_KEYFRAMES[style.animation];
  let tags = animStateTags(style, entranceAt(style.animation, offsetMs), withAlpha);
  for (let i = 0; i < kfs.length - 1; i++) {
    const b = kfs[i + 1];
    if (b.t <= offsetMs) continue;
    const t1 = Math.max(kfs[i].t, offsetMs) - offsetMs;
    const t2 = b.t - offsetMs;
    tags += `\\t(${Math.round(t1)},${Math.round(t2)},${animStateTags(style, b, withAlpha)})`;
  }
  return tags;
}

function positionTag(style: CaptionStyle, offsetMs: number): string {
  const x = 540;
  const y = Math.round(style.positionY * 1920);
  const kfs = ENTRANCE_KEYFRAMES[style.animation];
  const last = kfs[kfs.length - 1];
  const dy = entranceAt(style.animation, offsetMs).dy;
  if (Math.abs(dy) > 0.5 && last.t > offsetMs) {
    return `\\move(${x},${Math.round(y + dy)},${x},${Math.round(y + last.dy)},0,${Math.round(last.t - offsetMs)})`;
  }
  return `\\pos(${x},${y})`;
}

/**
 * Scale tags for the active word under "pop". The preview multiplies the
 * caption's entrance scale by the word's pop scale (nested CSS transforms);
 * an inline \\fscx replaces rather than multiplies, so sample the product at
 * every keyframe of either curve and interpolate between those points.
 */
function popTags(style: CaptionStyle, offsetMs: number): string {
  const entrance = ENTRANCE_KEYFRAMES[style.animation];
  const times = new Set<number>(WORD_POP_KEYFRAMES.map((k) => k.t));
  for (const k of entrance) if (k.t - offsetMs > 0) times.add(k.t - offsetMs);
  const sorted = [...times].sort((a, b) => a - b);
  const at = (t: number) => r2((entranceAt(style.animation, offsetMs + t).s * wordPopScaleAt(t)) / 100);
  let tags = `\\fscx${at(0)}\\fscy${at(0)}`;
  for (let i = 0; i < sorted.length - 1; i++) {
    const v = at(sorted[i + 1]);
    tags += `\\t(${Math.round(sorted[i])},${Math.round(sorted[i + 1])},\\fscx${v}\\fscy${v})`;
  }
  return tags;
}

/** Pixel padding of the per-word box ("box" effect). */
export function wordBoxPadding(style: CaptionStyle): number {
  return Math.round(style.fontSize * 0.12);
}

function buildHeader(style: CaptionStyle): string {
  const font = getCaptionFont(style.fontFamily);
  const bg = effectiveBackground(style);
  const box = style.wordEffect === "box";
  const karaoke = style.wordEffect === "karaoke";

  // karaoke (\kf) sweeps from SecondaryColour to PrimaryColour
  const primary = assStyleColor(karaoke ? style.highlightColor : style.textColor);
  const secondary = assStyleColor(style.textColor);
  // BorderStyle 1 = outline + shadow; 3 = opaque box per text run, drawn in
  // OutlineColour (used for the word box); 4 = one box behind the whole
  // event in BackColour, keeping normal outlines (libass extension).
  const borderStyle = box ? 3 : bg ? 4 : 1;
  const outlineColor = box ? assStyleColor(style.highlightColor, 255) : assStyleColor(style.outlineColor);
  const outline = box ? wordBoxPadding(style) : r2(style.outlineWidth);
  const backColor = bg
    ? assStyleColor(style.backgroundColor, backAlpha(style))
    : assStyleColor(style.shadowColor, backAlpha(style));
  const shadow = box || bg ? 0 : r2(style.shadowDepth);

  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,${font.assFamily ?? font.family},${style.fontSize},${primary},${secondary},${outlineColor},${backColor},${font.assBold ? -1 : 0},0,0,0,100,100,${r2(style.letterSpacing)},0,${borderStyle},${outline},${shadow},5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
}

function dialogue(startCs: number, endCs: number, text: string): string {
  return `Dialogue: 0,${formatAssTime(startCs)},${formatAssTime(endCs)},Caption,,0,0,0,,${text}`;
}

/** Text of one event, with word k styled as the active word (-1 = none). */
function sliceText(style: CaptionStyle, words: TimedWord[], k: number, offsetMs: number): string {
  const text = assColor(style.textColor);
  const hl = assColor(style.highlightColor);
  const parts: string[] = [];
  words.forEach((w, i) => {
    const t = sanitizeAssText(w.text);
    if (!t) return;
    if (i !== k) {
      if (style.wordEffect === "reveal" && i === k + 1) {
        // hide every word that hasn't been said yet (tags carry over to the rest)
        parts.push(`{\\1a&HFF&\\3a&HFF&${effectiveBackground(style) ? "" : "\\4a&HFF&"}}${t}`);
      } else {
        parts.push(t);
      }
      return;
    }
    switch (style.wordEffect) {
      case "highlight":
        parts.push(`{\\1c${hl}}${t}{\\1c${text}}`);
        break;
      case "pop":
        parts.push(`{\\1c${hl}${popTags(style, offsetMs)}}${t}{\\1c${text}${entranceTags(style, offsetMs, false)}}`);
        break;
      case "box":
        parts.push(`{\\3a&H00&}${t}{\\3a&HFF&}`);
        break;
      case "glow": {
        const ow = r2(style.outlineWidth + 4);
        parts.push(`{\\3c${hl}\\bord${ow}\\blur6}${t}{\\3c${assColor(style.outlineColor)}\\bord${r2(style.outlineWidth)}\\blur0}`);
        break;
      }
      case "reveal":
        parts.push(`{\\1a&HFF&\\3a&HFF&\\t(0,${REVEAL_FADE_MS},${alphaTags(style, 1)})}${t}`);
        break;
      default:
        parts.push(t);
    }
  });
  // Word k for "reveal" fades in; anything after it is hidden by the tag on k+1.
  // Spaces sit outside the override blocks so boxes hug the words.
  let out = "";
  parts.forEach((p, i) => {
    out += (i ? " " : "") + p;
  });
  return out;
}

function karaokeText(words: TimedWord[], chunkStartCs: number): string {
  let cursor = chunkStartCs;
  let out = "";
  words.forEach((w, i) => {
    const t = sanitizeAssText(w.text);
    if (!t) return;
    const ws = toCs(w.start);
    const we = Math.max(ws + 1, toCs(w.end));
    if (ws > cursor) out += `{\\k${ws - cursor}}`;
    out += `{\\kf${we - Math.max(ws, cursor)}}${t}${i < words.length - 1 ? " " : ""}`;
    cursor = Math.max(cursor, we);
  });
  return out;
}

function chunkEvents(chunk: CaptionChunk, style: CaptionStyle): string[] {
  const startCs = toCs(chunk.start);
  const endCs = toCs(chunk.end);
  if (endCs <= startCs) return [];
  const words = chunkWordTimings(chunk, style.uppercase);
  if (!words.length) return [];

  const exit = style.animation === "none" ? "" : `\\fad(0,${EXIT_FADE_MS})`;
  const head = (offsetMs: number, isLast: boolean) =>
    `{${positionTag(style, offsetMs)}${entranceTags(style, offsetMs)}${isLast ? exit : ""}${
      style.wordEffect === "box" ? "\\3a&HFF&" : ""
    }}`;

  if (style.wordEffect === "none") {
    return [dialogue(startCs, endCs, head(0, true) + sliceText(style, words, -1, 0))];
  }
  if (style.wordEffect === "karaoke") {
    return [dialogue(startCs, endCs, head(0, true) + karaokeText(words, startCs))];
  }

  // One event per "currently spoken word" slice.
  const bounds: { from: number; to: number; k: number }[] = [];
  const firstCs = Math.max(startCs, toCs(words[0].start));
  if (firstCs > startCs) bounds.push({ from: startCs, to: firstCs, k: -1 });
  words.forEach((w, i) => {
    const from = Math.max(startCs, toCs(w.start));
    const to = i < words.length - 1 ? Math.max(startCs, toCs(words[i + 1].start)) : endCs;
    if (to > from) bounds.push({ from, to: Math.min(to, endCs), k: i });
  });

  return bounds
    .filter((b) => b.to > b.from)
    .map((b, i, arr) => {
      const offsetMs = (b.from - startCs) * 10;
      return dialogue(b.from, b.to, head(offsetMs, i === arr.length - 1) + sliceText(style, words, b.k, offsetMs));
    });
}

export function buildAssFromChunks(chunks: CaptionChunk[], styleInput: Partial<CaptionStyle> = DEFAULT_CAPTION_STYLE): string {
  const style = normalizeCaptionStyle(styleInput);
  const lines = chunks.filter((c) => c.text.trim() && c.end > c.start).flatMap((c) => chunkEvents(c, style));
  return buildHeader(style) + lines.join("\n") + "\n";
}

/** Convenience used by the default (unedited) render path. */
export function buildAssFromWords(words: Word[], clipStart: number, style: CaptionStyle = DEFAULT_CAPTION_STYLE): string {
  const relWords = words.map((w) => ({
    word: w.word,
    start: Math.max(0, w.start - clipStart),
    end: Math.max(0, w.end - clipStart),
  }));
  return buildAssFromChunks(groupWordsIntoChunks(relWords, 3), style);
}
