"use client";

import type { FilterSpec } from "@/lib/types";
import { DEFAULT_FILTERS } from "@/lib/editSpec";

const P = (v: Partial<FilterSpec>): FilterSpec => ({ ...DEFAULT_FILTERS, ...v });

// swatch = a quick visual cue for the look (not the real grade)
const PRESETS: { name: string; swatch: string; values: FilterSpec }[] = [
  { name: "None", swatch: "linear-gradient(135deg,#555,#999)", values: P({}) },
  { name: "Cinematic", swatch: "linear-gradient(135deg,#0e2a33,#c98a4b)", values: P({ brightness: -0.03, contrast: 0.22, saturation: -0.08, warmth: 0.15, vignette: 0.5, sharpen: 0.3 }) },
  { name: "Golden hour", swatch: "linear-gradient(135deg,#ff9a3c,#ffd27a)", values: P({ brightness: 0.04, contrast: 0.1, saturation: 0.3, warmth: 0.55, vignette: 0.25 }) },
  { name: "Cool mood", swatch: "linear-gradient(135deg,#0b2447,#5aa9ff)", values: P({ contrast: 0.2, saturation: -0.15, warmth: -0.45, vignette: 0.4 }) },
  { name: "Vintage", swatch: "linear-gradient(135deg,#7a5c3a,#d8c3a0)", values: P({ brightness: 0.02, contrast: -0.1, saturation: -0.3, warmth: 0.35, vignette: 0.6 }) },
  { name: "Noir", swatch: "linear-gradient(135deg,#000,#bbb)", values: P({ contrast: 0.4, saturation: -1, vignette: 0.6, sharpen: 0.3 }) },
  { name: "Pop", swatch: "linear-gradient(135deg,#ff2bd6,#25e2ff)", values: P({ brightness: 0.03, contrast: 0.2, saturation: 0.6, sharpen: 0.5 }) },
  { name: "Warm", swatch: "linear-gradient(135deg,#ff7a45,#ffc48a)", values: P({ brightness: 0.03, contrast: 0.08, saturation: 0.25, warmth: 0.3 }) },
  { name: "High contrast", swatch: "linear-gradient(135deg,#111,#fff)", values: P({ brightness: -0.02, contrast: 0.35, saturation: 0.1, sharpen: 0.2 }) },
  { name: "Muted", swatch: "linear-gradient(135deg,#6b6b66,#a9a79c)", values: P({ brightness: 0.02, contrast: -0.05, saturation: -0.4 }) },
  { name: "Black & white", swatch: "linear-gradient(135deg,#222,#ddd)", values: P({ brightness: 0.02, contrast: 0.15, saturation: -1 }) },
  { name: "Vivid", swatch: "linear-gradient(135deg,#00e676,#ffd21f)", values: P({ brightness: 0.04, contrast: 0.15, saturation: 0.5 }) },
];

const SLIDERS: { key: keyof FilterSpec; label: string; min: number; max: number }[] = [
  { key: "brightness", label: "Brightness", min: -1, max: 1 },
  { key: "contrast", label: "Contrast", min: -1, max: 1 },
  { key: "saturation", label: "Saturation", min: -1, max: 1 },
  { key: "warmth", label: "Warmth (cool ↔ warm)", min: -1, max: 1 },
  { key: "vignette", label: "Vignette", min: 0, max: 1 },
  { key: "sharpen", label: "Sharpen", min: 0, max: 1 },
];

const KEYS = Object.keys(DEFAULT_FILTERS) as (keyof FilterSpec)[];
const same = (a: FilterSpec, b: FilterSpec) => KEYS.every((k) => Math.abs((a[k] ?? 0) - (b[k] ?? 0)) < 0.005);

export function FiltersPanel({ filters, onChange }: { filters: FilterSpec; onChange: (f: FilterSpec) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-sm font-semibold text-paper">Filters & color</h3>
        <p className="mt-1 text-xs text-paper-dim">One-tap looks, or fine-tune below. Sharpen shows up in the export.</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            onClick={() => onChange(p.values)}
            className={`overflow-hidden rounded-xl border text-left transition ${
              same(filters, p.values) ? "border-ember" : "border-line-strong hover:border-paper/40"
            }`}
          >
            <span className="block h-7" style={{ background: p.swatch }} />
            <span className="block px-2 py-1.5 text-[11px] font-semibold text-paper-dim">{p.name}</span>
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {SLIDERS.map((s) => (
          <label key={s.key} className="block">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-paper-dim">{s.label}</span>
              <span className="font-mono text-xs text-paper">{(filters[s.key] ?? 0).toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={0.01}
              value={filters[s.key] ?? 0}
              onChange={(e) => onChange({ ...filters, [s.key]: parseFloat(e.target.value) })}
              className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-3 accent-ember"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
