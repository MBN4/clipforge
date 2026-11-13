"use client";

// Chess-only preferences + last start-screen choices + ladder progress, persisted in localStorage.
import { useCallback, useSyncExternalStore } from "react";
import type { PieceSet } from "./pieces";
import type { BoardTheme } from "./themes";
import type { ModeId } from "@/lib/games/chess/match";

export interface ChessPrefs {
  theme: BoardTheme;
  pieceSet: PieceSet;
  autoQueen: boolean;
  showLegal: boolean;
  showCoords: boolean;
  showEval: boolean;
  autoFlip: boolean;
  last: { mode: ModeId; botId: string; side: "w" | "b" | "r"; tcId: string };
  /** ladder: next rung index to play (0-based) in the current run */
  ladderRung: number;
  /** finished-game counts per mode (for display) */
  modeCounts: Partial<Record<string, { w: number; l: number; d: number }>>;
}

const KEY = "clipforge-chess-v1";
const EVT = "clipforge-chess-change";

export const DEFAULT_PREFS: ChessPrefs = {
  theme: "green",
  pieceSet: "neo",
  autoQueen: false,
  showLegal: true,
  showCoords: true,
  showEval: true,
  autoFlip: false,
  last: { mode: "bot", botId: "nova", side: "w", tcId: "none" },
  ladderRung: 0,
  modeCounts: {},
};

let cacheRaw: string | null | undefined;
let cache: ChessPrefs = DEFAULT_PREFS;

function read(): ChessPrefs {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cache;
  }
  if (raw === cacheRaw) return cache;
  cacheRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<ChessPrefs>) : {};
    cache = { ...DEFAULT_PREFS, ...parsed, last: { ...DEFAULT_PREFS.last, ...(parsed.last ?? {}) } };
  } catch {
    cache = DEFAULT_PREFS;
  }
  return cache;
}

export function writePrefs(patch: Partial<ChessPrefs> | ((p: ChessPrefs) => Partial<ChessPrefs>)) {
  const cur = read();
  const next = { ...cur, ...(typeof patch === "function" ? patch(cur) : patch) };
  cache = next;
  try {
    const raw = JSON.stringify(next);
    localStorage.setItem(KEY, raw);
    cacheRaw = raw;
  } catch {
    cacheRaw = undefined;
  }
  window.dispatchEvent(new Event(EVT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function usePrefs(): [ChessPrefs, (patch: Partial<ChessPrefs>) => void] {
  const prefs = useSyncExternalStore(subscribe, read, () => DEFAULT_PREFS);
  const set = useCallback((patch: Partial<ChessPrefs>) => writePrefs(patch), []);
  return [prefs, set];
}

export function countModeResult(mode: string, r: "w" | "l" | "d") {
  writePrefs((p) => {
    const c = { w: 0, l: 0, d: 0, ...(p.modeCounts[mode] ?? {}) };
    c[r]++;
    return { modeCounts: { ...p.modeCounts, [mode]: c } };
  });
}
