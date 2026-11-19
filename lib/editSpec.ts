import type { AudioSpec, FilterSpec, LayoutMode, PolishSpec } from "./types";

// Defaults + validation for the "magic" edit options. The export route gets these straight from
// the browser and they end up inside an ffmpeg filter graph, so everything is clamped/allow-listed.

export const DEFAULT_AUDIO: AudioSpec = { denoise: false, normalize: false };

export const DEFAULT_POLISH: PolishSpec = {
  fadeIn: 0,
  fadeOut: 0,
  progressBar: { enabled: false, color: "#ff4e1f", position: "bottom", height: 14 },
};

export const DEFAULT_FILTERS: FilterSpec = { brightness: 0, contrast: 0, saturation: 0, warmth: 0, vignette: 0, sharpen: 0 };

const HEX = /^#[0-9a-fA-F]{6}$/;

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export function normalizeAudio(input: unknown): AudioSpec {
  const a = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return { denoise: a.denoise === true, normalize: a.normalize === true };
}

export function normalizePolish(input: unknown): PolishSpec {
  const p = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const b = (p.progressBar && typeof p.progressBar === "object" ? p.progressBar : {}) as Record<string, unknown>;
  const d = DEFAULT_POLISH.progressBar;
  return {
    fadeIn: num(p.fadeIn, 0, 0, 3),
    fadeOut: num(p.fadeOut, 0, 0, 3),
    progressBar: {
      enabled: b.enabled === true,
      color: typeof b.color === "string" && HEX.test(b.color) ? b.color.toLowerCase() : d.color,
      position: b.position === "top" ? "top" : "bottom",
      height: Math.round(num(b.height, d.height, 4, 40)),
    },
  };
}

export function normalizeLayout(input: unknown): LayoutMode {
  return input === "fit" ? "fit" : "fill";
}

export function normalizeFilters(input: unknown): Required<FilterSpec> {
  const f = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return {
    brightness: num(f.brightness, 0, -1, 1),
    contrast: num(f.contrast, 0, -1, 1),
    saturation: num(f.saturation, 0, -1, 1),
    warmth: num(f.warmth, 0, -1, 1),
    vignette: num(f.vignette, 0, 0, 1),
    sharpen: num(f.sharpen, 0, 0, 1),
  };
}
