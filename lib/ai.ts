import type { Transcript } from "./types";
import type { SelectedClip } from "./highlights";

const MODEL = "claude-sonnet-5";

function buildTranscriptPrompt(transcript: Transcript): string {
  return transcript.segments
    .filter((s) => s.text)
    .map((s) => `[${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.text}`)
    .join("\n");
}

export async function aiRankHighlights(
  transcript: Transcript,
  fallback: SelectedClip[]
): Promise<SelectedClip[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || transcript.method !== "whisper") return fallback;

  const body = buildTranscriptPrompt(transcript);
  if (!body.trim()) return fallback;

  const prompt = `You are an expert short-form video editor who finds the most shareable moments in a transcript for YouTube Shorts / Reels / TikTok.

Transcript (timestamps in seconds):
${body.slice(0, 12000)}

Pick 4 to 6 non-overlapping clips between 15 and 55 seconds each that would perform best as standalone vertical short videos. Each clip should start and end on natural sentence boundaries.

Respond with ONLY a JSON array, no prose, like:
[{"start": 12.4, "end": 38.1, "title": "short punchy title", "hook": "one sentence describing the hook", "reason": "why this works as a short"}]`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
    const data = await res.json();
    const text = data.content?.[0]?.text ?? "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("No JSON in AI response");
    const parsed = JSON.parse(match[0]) as Array<{
      start: number;
      end: number;
      title: string;
      hook: string;
      reason: string;
    }>;

    const words = transcript.segments.flatMap((s) => s.words || []);
    return parsed
      .filter((p) => p.end > p.start && p.end - p.start >= 8)
      .map((p) => ({
        start: p.start,
        end: p.end,
        text: p.hook,
        words: words.filter((w) => w.start >= p.start && w.end <= p.end),
        score: 10,
        reason: p.reason,
        title: p.title,
        hook: p.hook,
      }));
  } catch (e) {
    console.warn("[ai] falling back to heuristic highlights:", e);
    return fallback;
  }
}
