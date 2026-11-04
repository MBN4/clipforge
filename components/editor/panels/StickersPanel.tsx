"use client";

import { STICKER_TYPES, StickerIcon } from "../StickerIcon";
import type { StickerSpec, StickerType } from "@/lib/types";

export function StickersPanel({
  stickers,
  onAdd,
  onChange,
  trim,
}: {
  stickers: StickerSpec[];
  onAdd: (type: StickerType) => void;
  onChange: (stickers: StickerSpec[]) => void;
  trim: { start: number; end: number };
}) {
  function update(id: string, patch: Partial<StickerSpec>) {
    onChange(stickers.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function remove(id: string) {
    onChange(stickers.filter((s) => s.id !== id));
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-sm font-semibold text-paper">Stickers</h3>
        <p className="mt-1 text-xs text-paper-dim">Tap to add, drag on the preview to position.</p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {STICKER_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => onAdd(type)}
            className="flex items-center justify-center rounded-xl border border-line-strong bg-ink-3 p-2 transition hover:border-ember"
          >
            <StickerIcon type={type} size={28} />
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {stickers.map((s) => (
          <div key={s.id} className="space-y-2 rounded-xl border border-line-strong p-3">
            <div className="flex items-center gap-2">
              <StickerIcon type={s.type} color={s.color} size={24} />
              <span className="text-xs font-semibold capitalize text-paper">{s.type}</span>
              <input
                type="color"
                value={s.color}
                onChange={(e) => update(s.id, { color: e.target.value })}
                className="ml-auto h-7 w-9 rounded-lg border border-line-strong bg-ink-3"
              />
            </div>
            <input
              type="range"
              min={40}
              max={320}
              value={s.size}
              onChange={(e) => update(s.id, { size: parseInt(e.target.value, 10) })}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-3 accent-ember"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                step={0.1}
                min={trim.start}
                max={trim.end}
                value={s.start.toFixed(1)}
                onChange={(e) => update(s.id, { start: parseFloat(e.target.value) || trim.start })}
                className="w-16 rounded-lg bg-ink-3 px-1.5 py-1 font-mono text-[11px] text-paper-dim"
              />
              <span className="text-[11px] text-paper-dim">to</span>
              <input
                type="number"
                step={0.1}
                min={trim.start}
                max={trim.end}
                value={s.end.toFixed(1)}
                onChange={(e) => update(s.id, { end: parseFloat(e.target.value) || trim.end })}
                className="w-16 rounded-lg bg-ink-3 px-1.5 py-1 font-mono text-[11px] text-paper-dim"
              />
              <button onClick={() => remove(s.id)} className="ml-auto text-[11px] text-paper-dim hover:text-ember">
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
