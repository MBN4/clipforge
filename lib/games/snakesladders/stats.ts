"use client";
// Tiny extra counters (snakes bitten / ladders climbed) kept in our own localStorage key.
import { useSyncExternalStore } from "react";

const KEY = "clipforge-snl-v1";
const EVT = "clipforge-snl-change";
export interface SnlExtra {
  bitten: number;
  climbed: number;
}
const EMPTY: SnlExtra = { bitten: 0, climbed: 0 };
let cacheRaw: string | null = null;
let cache: SnlExtra = EMPTY;

function read(): SnlExtra {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cache;
  }
  if (raw === cacheRaw) return cache;
  cacheRaw = raw;
  try {
    const p = raw ? JSON.parse(raw) : {};
    cache = { bitten: Number(p.bitten) || 0, climbed: Number(p.climbed) || 0 };
  } catch {
    cache = EMPTY;
  }
  return cache;
}

export function addSnlExtra(bitten: number, climbed: number) {
  const cur = read();
  cache = { bitten: cur.bitten + bitten, climbed: cur.climbed + climbed };
  try {
    const raw = JSON.stringify(cache);
    localStorage.setItem(KEY, raw);
    cacheRaw = raw;
  } catch {
    cacheRaw = null;
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

export function useSnlExtra(): SnlExtra {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
