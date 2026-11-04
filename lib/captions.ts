import type { Word } from "./types";

export interface CaptionChunk {
  text: string;
  start: number;
  end: number;
}

export interface CaptionStyle {
  fontFamily: string;
  fontSize: number;
  color: string; // "#rrggbb"
  highlightColor: string; // "#rrggbb" — used for the outline/accent
  position: "bottom" | "middle" | "top";
  uppercase: boolean;
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontFamily: "DejaVu Sans",
  fontSize: 72,
  color: "#f5efe3",
  highlightColor: "#ff4e1f",
  position: "bottom",
  uppercase: true,
};

export const CAPTION_FONTS = ["DejaVu Sans", "Liberation Sans", "DejaVu Serif", "Liberation Mono"];

function formatAssTime(t: number): string {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const cs = Math.floor((t - Math.floor(t)) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/** "#rrggbb" -> ASS "&H00BBGGRR" (ASS stores colour as AABBGGRR, alpha 00 = opaque). */
function hexToAss(hex: string): string {
  const clean = hex.replace("#", "");
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

export function groupWordsIntoChunks(words: Word[], size = 3): CaptionChunk[] {
  const chunks: CaptionChunk[] = [];
  for (let i = 0; i < words.length; i += size) {
    const group = words.slice(i, i + size);
    if (!group.length) continue;
    chunks.push({
      text: group.map((w) => w.word).join(" "),
      start: group[0].start,
      end: group[group.length - 1].end + 0.05,
    });
  }
  return chunks;
}

const ALIGNMENT: Record<CaptionStyle["position"], { alignment: number; marginV: number }> = {
  bottom: { alignment: 2, marginV: 260 },
  middle: { alignment: 5, marginV: 0 },
  top: { alignment: 8, marginV: 140 },
};

function buildHeader(style: CaptionStyle): string {
  const { alignment, marginV } = ALIGNMENT[style.position];
  const primary = hexToAss(style.color);
  const outline = hexToAss(style.highlightColor);
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,${style.fontFamily},${style.fontSize},${primary},&H000000FF,${outline},&H00000000,1,0,0,0,100,100,0,0,1,7,0,${alignment},60,60,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
}

export function buildAssFromChunks(chunks: CaptionChunk[], style: CaptionStyle = DEFAULT_CAPTION_STYLE): string {
  const lines = chunks
    .filter((c) => c.text.trim() && c.end > c.start)
    .map((c) => {
      const text = (style.uppercase ? c.text.toUpperCase() : c.text).replace(/[{}]/g, "");
      return `Dialogue: 0,${formatAssTime(c.start)},${formatAssTime(c.end)},Caption,,0,0,0,,{\\fad(60,60)}${text}`;
    });
  return buildHeader(style) + lines.join("\n");
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
