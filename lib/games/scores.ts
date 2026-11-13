"use client";

// Per-game stats and high scores, kept in localStorage so they survive reloads.
// Components subscribe with useGameStats() and update with the record* helpers.
import { useSyncExternalStore } from "react";

export type GameKey = "chess" | "snake" | "ludo" | "uno" | "snakesladders";

export interface GameStats {
  played: number;
  wins: number;
  losses: number;
  draws: number;
  /** current and best consecutive wins */
  streak: number;
  bestStreak: number;
  /** named personal bests, e.g. { score: 120 } or { fewestTurns: 31 } — each game decides its keys */
  best: Record<string, number>;
}

const KEY = "clipforge-games-v1";
const EVT = "clipforge-games-change";

export const emptyStats = (): GameStats => ({ played: 0, wins: 0, losses: 0, draws: 0, streak: 0, bestStreak: 0, best: {} });

let cacheRaw: string | null = null;
let cache: Partial<Record<GameKey, GameStats>> = {};
const EMPTY = emptyStats();

function readAll(): Partial<Record<GameKey, GameStats>> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cache; // storage blocked: fall back to this session's in-memory copy
  }
  if (raw === cacheRaw) return cache;
  cacheRaw = raw;
  try {
    cache = raw ? JSON.parse(raw) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function write(next: Partial<Record<GameKey, GameStats>>) {
  cache = next;
  try {
    const raw = JSON.stringify(next);
    localStorage.setItem(KEY, raw);
    cacheRaw = raw;
  } catch {
    cacheRaw = null;
  }
  window.dispatchEvent(new Event(EVT));
}

export function getGameStats(game: GameKey): GameStats {
  return { ...emptyStats(), ...(readAll()[game] ?? {}) };
}

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Live stats for one game; re-renders when they change (also across tabs). */
export function useGameStats(game: GameKey): GameStats {
  // the snapshot must be referentially stable between changes, so hand back the cached object itself
  return useSyncExternalStore(
    subscribe,
    () => readAll()[game] ?? EMPTY,
    () => EMPTY
  );
}

/** Count a finished game. Returns the updated stats. */
export function recordResult(game: GameKey, result: "win" | "loss" | "draw"): GameStats {
  const all = readAll();
  const s = { ...emptyStats(), ...(all[game] ?? {}) };
  s.played += 1;
  if (result === "win") {
    s.wins += 1;
    s.streak += 1;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
  } else {
    if (result === "loss") s.losses += 1;
    else s.draws += 1;
    s.streak = 0;
  }
  write({ ...all, [game]: s });
  return s;
}

/** Record a personal best under `key`. Returns true when it's a new record. */
export function recordBest(game: GameKey, key: string, value: number, opts: { lowerIsBetter?: boolean } = {}): boolean {
  const all = readAll();
  const s = { ...emptyStats(), ...(all[game] ?? {}), best: { ...(all[game]?.best ?? {}) } };
  const prev = s.best[key];
  const better = prev === undefined || (opts.lowerIsBetter ? value < prev : value > prev);
  if (!better) return false;
  s.best[key] = value;
  write({ ...all, [game]: s });
  return true;
}

export function resetGameStats(game: GameKey) {
  const all = { ...readAll() };
  delete all[game];
  write(all);
}
