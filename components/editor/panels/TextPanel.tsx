"use client";

import type { TextOverlaySpec } from "@/lib/types";

export function TextPanel({
  overlays,
  onAdd,
  onChange,
  trim,
}: {
  overlays: TextOverlaySpec[];
  onAdd: () => void;
  onChange: (overlays: TextOverlaySpec[]) => void;
  trim: { start: number; end: number };
}) {
  function update(id: string, patch: Partial<TextOverlaySpec>) {
    onChange(overlays.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }
  function remove(id: string) {
    onChange(overlays.filter((o) => o.id !== id));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm font-semibold text-paper">Text</h3>
          <p className="mt-1 text-xs text-paper-dim">Drag text on the preview to position it.</p>
        </div>
        <button
          onClick={onAdd}
          className="rounded-full bg-ember px-3 py-1.5 text-xs font-semibold text-ink transition hover:brightness-110"
        >
          + Add text
        </button>
      </div>

      <div className="space-y-3">
        {overlays.map((o) => (
          <div key={o.id} className="space-y-2 rounded-xl border border-line-strong p-3">
            <input
              value={o.text}
              onChange={(e) => update(o.id, { text: e.target.value })}
              className="w-full rounded-lg bg-ink-3 px-2 py-1.5 text-sm text-paper"
            />
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={o.color}
                onChange={(e) => update(o.id, { color: e.target.value })}
                className="h-8 w-10 rounded-lg border border-line-strong bg-ink-3"
              />
              <input
                type="range"
                min={24}
                max={140}
                value={o.fontSize}
                onChange={(e) => update(o.id, { fontSize: parseInt(e.target.value, 10) })}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-ink-3 accent-ember"
              />
              <span className="w-8 font-mono text-[11px] text-paper-dim">{o.fontSize}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step={0.1}
                min={trim.start}
                max={trim.end}
                value={o.start.toFixed(1)}
                onChange={(e) => update(o.id, { start: parseFloat(e.target.value) || trim.start })}
                className="w-16 rounded-lg bg-ink-3 px-1.5 py-1 font-mono text-[11px] text-paper-dim"
              />
              <span className="text-[11px] text-paper-dim">to</span>
              <input
                type="number"
                step={0.1}
                min={trim.start}
                max={trim.end}
                value={o.end.toFixed(1)}
                onChange={(e) => update(o.id, { end: parseFloat(e.target.value) || trim.end })}
                className="w-16 rounded-lg bg-ink-3 px-1.5 py-1 font-mono text-[11px] text-paper-dim"
              />
              <button onClick={() => remove(o.id)} className="ml-auto text-[11px] text-paper-dim hover:text-ember">
                Remove
              </button>
            </div>
          </div>
        ))}
        {!overlays.length && <p className="text-xs text-paper-dim">No text yet — add one above.</p>}
      </div>
    </div>
  );
}
