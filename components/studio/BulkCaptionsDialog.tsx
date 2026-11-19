"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Loader, X } from "lucide-react";
import {
  applyPreset,
  CAPTION_PRESETS,
  DEFAULT_CAPTION_STYLE,
  groupWordsIntoChunks,
  normalizeCaptionStyle,
  type CaptionStyle,
} from "@/lib/captions";
import { captionFontCss, getCaptionFont } from "@/lib/captionFonts";
import type { ClientClip } from "@/lib/serialize";
import type { Word } from "@/lib/types";

export interface BulkItem {
  jobId: string;
  clip: ClientClip;
  label: string;
}

type Status = "waiting" | "transcribing" | "rendering" | "done" | "skipped" | "failed";

const LANGUAGES: [string, string][] = [
  ["auto", "Auto-detect"], ["en", "English"], ["es", "Spanish"], ["fr", "French"], ["de", "German"], ["pt", "Portuguese"],
  ["ar", "Arabic"], ["ur", "Urdu"], ["hi", "Hindi"], ["tr", "Turkish"], ["ru", "Russian"], ["id", "Indonesian"],
];

const LAST_STYLE_KEY = "clipforge.captionPrefs.v1"; // written by the editor

function lastEditorStyle(): CaptionStyle | null {
  try {
    const raw = localStorage.getItem(LAST_STYLE_KEY);
    return raw ? normalizeCaptionStyle(JSON.parse(raw)?.style) : null;
  } catch {
    return null;
  }
}

const keyOf = (i: BulkItem) => `${i.jobId}:${i.clip.index}`;

/**
 * Adds captions to many clips in one go: transcribes each (if it has no word timings yet), then
 * re-renders it from its editable source with the chosen caption style burned in.
 * Re-rendering starts from the original cut, so earlier editor changes to these clips are replaced.
 */
export function BulkCaptionsDialog({ items, onClose, onDone }: { items: BulkItem[]; onClose: () => void; onDone: () => void }) {
  const last = useMemo(() => lastEditorStyle(), []);
  const [choice, setChoice] = useState<string>(last ? "last" : CAPTION_PRESETS[0].id);
  const [language, setLanguage] = useState("auto");
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [status, setStatus] = useState<Record<string, { s: Status; note?: string }>>({});
  const [fatal, setFatal] = useState<{ message: string; code?: string } | null>(null);
  const [installing, setInstalling] = useState(false);
  const stop = useRef(false);

  const set = (i: BulkItem, s: Status, note?: string) => setStatus((m) => ({ ...m, [keyOf(i)]: { s, note } }));

  function chosenStyle(): CaptionStyle {
    if (choice === "last" && last) return last;
    const preset = CAPTION_PRESETS.find((p) => p.id === choice) ?? CAPTION_PRESETS[0];
    return applyPreset(DEFAULT_CAPTION_STYLE, preset);
  }

  async function installWhisper() {
    setInstalling(true);
    try {
      const res = await fetch("/api/system/install", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tool: "whisper" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Install failed");
      setFatal({ message: "Speech-to-text installed. Press Start again." });
    } catch (e) {
      setFatal({ message: e instanceof Error ? e.message : "Install failed", code: "whisper_missing" });
    } finally {
      setInstalling(false);
    }
  }

  async function start() {
    const style = chosenStyle();
    stop.current = false;
    setRunning(true);
    setFinished(false);
    setFatal(null);
    setStatus(Object.fromEntries(items.map((i) => [keyOf(i), { s: "waiting" as Status }])));

    // word timings live on the job (they're heavy, so the list view doesn't carry them)
    const wordsCache = new Map<string, Map<number, Word[]>>();
    async function wordsFor(i: BulkItem): Promise<Word[]> {
      if (!wordsCache.has(i.jobId)) {
        const res = await fetch(`/api/jobs/${i.jobId}`);
        const data = await res.json();
        wordsCache.set(i.jobId, new Map((data.job.clips as ClientClip[]).map((c) => [c.index, c.words ?? []])));
      }
      return wordsCache.get(i.jobId)?.get(i.clip.index) ?? [];
    }

    for (const item of items) {
      if (stop.current) break;
      if (!item.clip.rawUrl) {
        set(item, "skipped", "Made by an older version — no editable source");
        continue;
      }
      try {
        let words = await wordsFor(item);
        if (!words.length) {
          set(item, "transcribing");
          const res = await fetch(`/api/jobs/${item.jobId}/clips/${item.clip.index}/captions`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ language, quality: "fast" }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.status === 422) {
            set(item, "skipped", "No speech found");
            continue;
          }
          if (!res.ok) {
            if (data.code === "whisper_missing") {
              set(item, "failed", "Speech-to-text isn't installed");
              setFatal({ message: data.error, code: "whisper_missing" });
              break;
            }
            throw new Error(data.error || "Transcription failed");
          }
          words = data.words;
        }
        set(item, "rendering");
        const res = await fetch(`/api/jobs/${item.jobId}/clips/${item.clip.index}/export`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            trim: { start: 0, end: item.clip.duration },
            crop: { x: 0.5, y: 0.5, zoom: 1 },
            captions: { enabled: true, chunks: groupWordsIntoChunks(words, 3), style },
            textOverlays: [],
            stickers: [],
            filters: { brightness: 0, contrast: 0, saturation: 0 },
            music: null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Render failed");
        set(item, "done");
      } catch (e) {
        set(item, "failed", e instanceof Error ? e.message : "Failed");
      }
    }
    setRunning(false);
    setFinished(true);
    onDone();
  }

  const done = Object.values(status).filter((v) => v.s === "done").length;
  const presetTiles = [
    ...(last ? [{ id: "last", name: "My last editor style", style: last }] : []),
    ...CAPTION_PRESETS.map((p) => ({ id: p.id, name: p.name, style: applyPreset(DEFAULT_CAPTION_STYLE, p) })),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Add captions to clips">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-line-strong bg-ink-2 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-display text-base font-semibold text-paper">Add captions to {items.length} {items.length === 1 ? "clip" : "clips"}</h2>
            <p className="mt-0.5 text-xs text-paper-dim">Transcribes each clip, then burns the captions in.</p>
          </div>
          <button onClick={onClose} disabled={running} aria-label="Close" className="rounded-full p-1.5 text-paper-dim transition hover:bg-white/10 hover:text-paper disabled:opacity-40">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          {!running && !finished && (
            <>
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-paper-dim">Caption style</p>
                <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto pr-1">
                  {presetTiles.map((p) => {
                    const font = getCaptionFont(p.style.fontFamily);
                    return (
                      <button
                        key={p.id}
                        onClick={() => setChoice(p.id)}
                        className={`flex flex-col items-center gap-1 overflow-hidden rounded-xl border p-2 transition ${
                          choice === p.id ? "border-ember bg-ember/10" : "border-line-strong hover:border-paper/30"
                        }`}
                      >
                        <span
                          className="max-w-full truncate whitespace-nowrap rounded px-1 text-[18px] leading-8"
                          style={{
                            fontFamily: captionFontCss(font.family),
                            fontWeight: font.cssWeight,
                            color: p.style.textColor,
                            background: p.style.background ? p.style.backgroundColor : "rgba(255,255,255,0.06)",
                            WebkitTextStroke: p.style.outlineWidth > 0 ? `1px ${p.style.outlineColor}` : undefined,
                            paintOrder: "stroke fill",
                            fontSize: 18 * (font.tileFit ?? 1),
                          }}
                        >
                          {p.style.uppercase ? "SAY IT" : "Say it"}
                        </span>
                        <span className="text-[10px] font-semibold text-paper-dim">{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-paper-dim">Spoken language</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-line-strong bg-ink-3 px-3 py-2 text-sm text-paper"
                >
                  {LANGUAGES.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="rounded-lg bg-ink-3 px-3 py-2 text-[11px] leading-snug text-paper-dim">
                Clips are re-rendered from their original cut, so any editor changes you made to these clips are replaced. Transcribing takes roughly a few seconds per clip.
              </p>
            </>
          )}

          {(running || finished) && (
            <ul className="space-y-1.5">
              {items.map((i) => {
                const st = status[keyOf(i)] ?? { s: "waiting" as Status };
                return (
                  <li key={keyOf(i)} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-xs">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                      {st.s === "done" ? (
                        <Check className="h-4 w-4 text-moss" />
                      ) : st.s === "transcribing" || st.s === "rendering" ? (
                        <Loader className="h-4 w-4 animate-spin text-ember" />
                      ) : st.s === "failed" ? (
                        <X className="h-4 w-4 text-red-300" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-paper-dim/50" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-paper">
                        #{i.clip.index + 1} · {i.label}
                      </span>
                      <span className="block text-paper-dim">
                        {st.s === "waiting" && "Waiting"}
                        {st.s === "transcribing" && "Transcribing speech…"}
                        {st.s === "rendering" && "Adding captions…"}
                        {st.s === "done" && "Captions added"}
                        {(st.s === "skipped" || st.s === "failed") && (st.note ?? st.s)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {fatal && (
            <div className="rounded-lg border border-ember/40 bg-ember/10 p-3">
              <p className="text-xs text-ember">{fatal.message}</p>
              {fatal.code === "whisper_missing" && (
                <button
                  onClick={installWhisper}
                  disabled={installing}
                  className="mt-2 rounded-full bg-ember px-3 py-1.5 text-[11px] font-semibold text-ink disabled:opacity-60"
                >
                  {installing ? "Installing… (a few minutes)" : "Install speech-to-text"}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
          <span className="text-xs text-paper-dim">{running || finished ? `${done} of ${items.length} done` : ""}</span>
          <div className="flex gap-2">
            {running ? (
              <button onClick={() => (stop.current = true)} className="rounded-full border border-line-strong px-4 py-2 text-xs font-semibold text-paper-dim hover:text-paper">
                Stop after this clip
              </button>
            ) : finished ? (
              <>
                <button onClick={start} className="rounded-full border border-line-strong px-4 py-2 text-xs font-semibold text-paper-dim hover:text-paper">
                  Run again
                </button>
                <button onClick={onClose} className="rounded-full bg-ember px-5 py-2 text-xs font-semibold text-ink hover:brightness-110">
                  Close
                </button>
              </>
            ) : (
              <>
                <button onClick={onClose} className="rounded-full border border-line-strong px-4 py-2 text-xs font-semibold text-paper-dim hover:text-paper">
                  Cancel
                </button>
                <button onClick={start} className="rounded-full bg-ember px-5 py-2 text-xs font-semibold text-ink hover:brightness-110">
                  Start
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
