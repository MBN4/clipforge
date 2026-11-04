"use client";

import { CAPTION_FONTS, type CaptionChunk, type CaptionStyle } from "@/lib/captions";

const POSITIONS: CaptionStyle["position"][] = ["top", "middle", "bottom"];

export function CaptionsPanel({
  enabled,
  onToggle,
  chunks,
  onChangeChunks,
  style,
  onChangeStyle,
}: {
  enabled: boolean;
  onToggle: (v: boolean) => void;
  chunks: CaptionChunk[];
  onChangeChunks: (c: CaptionChunk[]) => void;
  style: CaptionStyle;
  onChangeStyle: (s: CaptionStyle) => void;
}) {
  function updateChunk(i: number, patch: Partial<CaptionChunk>) {
    onChangeChunks(chunks.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function removeChunk(i: number) {
    onChangeChunks(chunks.filter((_, idx) => idx !== i));
  }
  function addChunk() {
    const last = chunks[chunks.length - 1];
    const start = last ? last.end + 0.2 : 0;
    onChangeChunks([...chunks, { text: "New caption", start, end: start + 2 }]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-paper">Captions</h3>
        <button
          onClick={() => onToggle(!enabled)}
          className={`h-6 w-11 rounded-full transition ${enabled ? "bg-ember" : "bg-ink-3"}`}
        >
          <span
            className={`block h-5 w-5 translate-y-0.5 rounded-full bg-paper transition ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {enabled && (
        <>
          <div className="space-y-3 rounded-xl border border-line-strong p-3">
            <p className="text-[11px] font-semibold text-paper-dim">Style</p>

            <label className="block">
              <span className="text-[11px] text-paper-dim">Font</span>
              <select
                value={style.fontFamily}
                onChange={(e) => onChangeStyle({ ...style, fontFamily: e.target.value })}
                className="mt-1 w-full rounded-lg border border-line-strong bg-ink-3 px-2 py-1.5 text-sm text-paper"
              >
                {CAPTION_FONTS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-paper-dim">Size</span>
                <span className="font-mono text-xs text-paper">{style.fontSize}</span>
              </div>
              <input
                type="range"
                min={40}
                max={110}
                step={1}
                value={style.fontSize}
                onChange={(e) => onChangeStyle({ ...style, fontSize: parseInt(e.target.value, 10) })}
                className="mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-3 accent-ember"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[11px] text-paper-dim">Text color</span>
                <input
                  type="color"
                  value={style.color}
                  onChange={(e) => onChangeStyle({ ...style, color: e.target.value })}
                  className="mt-1 h-8 w-full rounded-lg border border-line-strong bg-ink-3"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-paper-dim">Outline</span>
                <input
                  type="color"
                  value={style.highlightColor}
                  onChange={(e) => onChangeStyle({ ...style, highlightColor: e.target.value })}
                  className="mt-1 h-8 w-full rounded-lg border border-line-strong bg-ink-3"
                />
              </label>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-paper-dim">Position</span>
              <div className="inline-flex rounded-full border border-line-strong bg-ink-3 p-0.5">
                {POSITIONS.map((p) => (
                  <button
                    key={p}
                    onClick={() => onChangeStyle({ ...style, position: p })}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition ${
                      style.position === p ? "bg-paper text-ink" : "text-paper-dim"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center justify-between">
              <span className="text-[11px] text-paper-dim">UPPERCASE</span>
              <input
                type="checkbox"
                checked={style.uppercase}
                onChange={(e) => onChangeStyle({ ...style, uppercase: e.target.checked })}
                className="accent-ember"
              />
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-paper-dim">Caption text</p>
              <button onClick={addChunk} className="text-[11px] font-semibold text-ember">
                + Add
              </button>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {chunks.map((c, i) => (
                <div key={i} className="rounded-xl border border-line-strong p-2.5">
                  <input
                    value={c.text}
                    onChange={(e) => updateChunk(i, { text: e.target.value })}
                    className="w-full rounded-lg bg-ink-3 px-2 py-1.5 text-sm text-paper"
                  />
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      type="number"
                      step={0.1}
                      value={c.start.toFixed(1)}
                      onChange={(e) => updateChunk(i, { start: parseFloat(e.target.value) || 0 })}
                      className="w-16 rounded-lg bg-ink-3 px-1.5 py-1 font-mono text-[11px] text-paper-dim"
                    />
                    <span className="text-[11px] text-paper-dim">to</span>
                    <input
                      type="number"
                      step={0.1}
                      value={c.end.toFixed(1)}
                      onChange={(e) => updateChunk(i, { end: parseFloat(e.target.value) || 0 })}
                      className="w-16 rounded-lg bg-ink-3 px-1.5 py-1 font-mono text-[11px] text-paper-dim"
                    />
                    <button onClick={() => removeChunk(i)} className="ml-auto text-[11px] text-paper-dim hover:text-ember">
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              {!chunks.length && <p className="text-xs text-paper-dim">No captions yet — add one above.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
