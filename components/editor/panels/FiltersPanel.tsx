"use client";

import type { FilterSpec } from "@/lib/types";

const PRESETS: { name: string; values: FilterSpec }[] = [
  { name: "None", values: { brightness: 0, contrast: 0, saturation: 0 } },
  { name: "Warm", values: { brightness: 0.03, contrast: 0.08, saturation: 0.25 } },
  { name: "High contrast", values: { brightness: -0.02, contrast: 0.35, saturation: 0.1 } },
  { name: "Muted", values: { brightness: 0.02, contrast: -0.05, saturation: -0.4 } },
  { name: "Black & white", values: { brightness: 0.02, contrast: 0.15, saturation: -1 } },
  { name: "Vivid", values: { brightness: 0.04, contrast: 0.15, saturation: 0.5 } },
];

const SLIDERS: { key: keyof FilterSpec; label: string }[] = [
  { key: "brightness", label: "Brightness" },
  { key: "contrast", label: "Contrast" },
  { key: "saturation", label: "Saturation" },
];

export function FiltersPanel({ filters, onChange }: { filters: FilterSpec; onChange: (f: FilterSpec) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-sm font-semibold text-paper">Filters & color</h3>
        <p className="mt-1 text-xs text-paper-dim">One-tap looks, or fine-tune below.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            onClick={() => onChange(p.values)}
            className="rounded-xl border border-line-strong px-3 py-2 text-xs font-semibold text-paper-dim transition hover:border-paper/40 hover:text-paper"
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {SLIDERS.map((s) => (
          <label key={s.key} className="block">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-paper-dim">{s.label}</span>
              <span className="font-mono text-xs text-paper">{filters[s.key].toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.01}
              value={filters[s.key]}
              onChange={(e) => onChange({ ...filters, [s.key]: parseFloat(e.target.value) })}
              className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-3 accent-ember"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
