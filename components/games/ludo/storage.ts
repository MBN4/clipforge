// Small localStorage helpers for Ludo's own preferences and lifetime capture count.
import type { Mode, Settings, Kind } from "@/lib/games/ludo/engine";
import { DEFAULT_SETTINGS } from "@/lib/games/ludo/engine";
import type { Color } from "@/lib/games/ludo/board";

const PREFS = "clipforge-ludo-prefs";
const EXTRA = "clipforge-ludo-extra";

export interface Prefs {
  settings: Settings;
  /** per colour: human, bot or off */
  seats: Record<Color, Kind | "off">;
}

export const DEFAULT_PREFS: Prefs = {
  settings: DEFAULT_SETTINGS,
  seats: { 0: "human", 1: "off", 2: "bot", 3: "off" },
};

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<Prefs>;
    const settings = { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) };
    if (settings.mode !== "classic" && settings.mode !== ("quick" as Mode)) settings.mode = "classic";
    const seats = { ...DEFAULT_PREFS.seats, ...(p.seats ?? {}) };
    return { settings, seats };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS, JSON.stringify(p));
  } catch {}
}

export function loadCaptures(): number {
  try {
    return Number(JSON.parse(localStorage.getItem(EXTRA) ?? "{}").captures) || 0;
  } catch {
    return 0;
  }
}

export function addCaptures(n: number): number {
  const total = loadCaptures() + n;
  try {
    localStorage.setItem(EXTRA, JSON.stringify({ captures: total }));
  } catch {}
  return total;
}
