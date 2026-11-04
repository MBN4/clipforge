import type { Word } from "./types";

function formatAssTime(t: number): string {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const cs = Math.floor((t - Math.floor(t)) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function chunkWords(words: Word[], size: number): Word[][] {
  const chunks: Word[][] = [];
  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size));
  }
  return chunks;
}

const HEADER = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Arial Black,72,&H00F3EEE6,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,7,0,2,60,60,260,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

export function buildAssFromWords(words: Word[], clipStart: number, accentColor = "&H001F57FF"): string {
  const relWords = words.map((w) => ({
    word: w.word,
    start: Math.max(0, w.start - clipStart),
    end: Math.max(0, w.end - clipStart),
  }));

  const groups = chunkWords(relWords, 3);
  const lines: string[] = [];

  for (const group of groups) {
    if (!group.length) continue;
    const start = group[0].start;
    const end = group[group.length - 1].end + 0.05;
    const text = group
      .map((w) => w.word.toUpperCase())
      .join(" ")
      .replace(/[{}]/g, "");
    lines.push(
      `Dialogue: 0,${formatAssTime(start)},${formatAssTime(end)},Caption,,0,0,0,,{\\fad(60,60)}${text}`
    );
  }

  return HEADER + lines.join("\n");
}
