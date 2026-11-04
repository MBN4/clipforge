"use client";

import type { CropSpec } from "@/lib/types";

export function ReframePanel({ crop, onChange }: { crop: CropSpec; onChange: (c: CropSpec) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-sm font-semibold text-paper">Reframe</h3>
        <p className="mt-1 text-xs text-paper-dim">
          Drag directly on the preview to pan. Use the slider to zoom in before panning.
        </p>
      </div>

      <label className="block">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] text-paper-dim">Zoom</span>
          <span className="font-mono text-xs text-paper">{crop.zoom.toFixed(2)}×</span>
        </div>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={crop.zoom}
          onChange={(e) => onChange({ ...crop, zoom: parseFloat(e.target.value) })}
          className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-3 accent-ember"
        />
      </label>

      <button
        onClick={() => onChange({ x: 0.5, y: 0.5, zoom: 1 })}
        className="rounded-full border border-line-strong px-4 py-2 text-xs font-semibold text-paper-dim transition hover:text-paper"
      >
        Reset to center
      </button>
    </div>
  );
}
