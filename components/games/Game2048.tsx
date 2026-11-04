"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SIZE = 4;
const CELL = 72;
const GAP = 8;
const BOARD = SIZE * CELL + (SIZE + 1) * GAP;

interface Tile {
  id: number;
  value: number;
  row: number;
  col: number;
  merged?: boolean;
  isNew?: boolean;
}

const TILE_COLORS: Record<number, { bg: string; fg: string }> = {
  2: { bg: "#1c1916", fg: "#f5efe3" },
  4: { bg: "#241f1a", fg: "#f5efe3" },
  8: { bg: "#ff8a4c", fg: "#141210" },
  16: { bg: "#ff6e2e", fg: "#141210" },
  32: { bg: "#ff4e1f", fg: "#f5efe3" },
  64: { bg: "#e5390f", fg: "#f5efe3" },
  128: { bg: "#cdfb5e", fg: "#141210" },
  256: { bg: "#b8e84f", fg: "#141210" },
  512: { bg: "#a3d440", fg: "#141210" },
  1024: { bg: "#f5efe3", fg: "#141210" },
  2048: { bg: "#ffffff", fg: "#141210" },
};

let uid = 1;
function nextId() {
  return uid++;
}

function emptyGrid(): (Tile | null)[][] {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
}

function cloneGrid(grid: (Tile | null)[][]): (Tile | null)[][] {
  return grid.map((row) => row.map((t) => (t ? { ...t } : null)));
}

function spawnTile(grid: (Tile | null)[][]): Tile | null {
  const empties: [number, number][] = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) if (!grid[r][c]) empties.push([r, c]);
  if (!empties.length) return null;
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  const tile: Tile = { id: nextId(), value: Math.random() < 0.9 ? 2 : 4, row: r, col: c, isNew: true };
  grid[r][c] = tile;
  return tile;
}

function getLine(grid: (Tile | null)[][], dir: "up" | "down" | "left" | "right", index: number): (Tile | null)[] {
  const line: (Tile | null)[] = [];
  for (let i = 0; i < SIZE; i++) {
    if (dir === "left" || dir === "right") line.push(grid[index][i]);
    else line.push(grid[i][index]);
  }
  if (dir === "right" || dir === "down") line.reverse();
  return line;
}

function setLine(grid: (Tile | null)[][], dir: "up" | "down" | "left" | "right", index: number, line: (Tile | null)[]) {
  const ordered = dir === "right" || dir === "down" ? [...line].reverse() : line;
  for (let i = 0; i < SIZE; i++) {
    const tile = ordered[i];
    if (!tile) continue;
    if (dir === "left" || dir === "right") {
      tile.row = index;
      tile.col = i;
      grid[index][i] = tile;
    } else {
      tile.row = i;
      tile.col = index;
      grid[i][index] = tile;
    }
  }
}

function mergeLine(line: (Tile | null)[]): { line: (Tile | null)[]; gained: number; moved: boolean } {
  const original = line.map((t) => (t ? `${t.id}:${t.value}` : "_"));
  const compact = line.filter(Boolean) as Tile[];
  const result: (Tile | null)[] = [];
  let gained = 0;

  let i = 0;
  while (i < compact.length) {
    if (i + 1 < compact.length && compact[i].value === compact[i + 1].value) {
      const merged: Tile = { id: nextId(), value: compact[i].value * 2, row: 0, col: 0, merged: true };
      gained += merged.value;
      result.push(merged);
      i += 2;
    } else {
      result.push(compact[i]);
      i += 1;
    }
  }
  while (result.length < SIZE) result.push(null);

  const after = result.map((t) => (t ? `${t.id}:${t.value}` : "_"));
  return { line: result, gained, moved: original.join(",") !== after.join(",") };
}

export function Game2048() {
  const [grid, setGrid] = useState<(Tile | null)[][]>(() => {
    const g = emptyGrid();
    spawnTile(g);
    spawnTile(g);
    return g;
  });
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const busyRef = useRef(false);

  const move = useCallback(
    (dir: "up" | "down" | "left" | "right") => {
      if (busyRef.current || gameOver) return;
      setGrid((prevGrid) => {
        const grid = cloneGrid(prevGrid);
        let anyMoved = false;
        let gained = 0;

        for (let i = 0; i < SIZE; i++) {
          const line = getLine(grid, dir, i);
          const result = mergeLine(line);
          if (result.moved) anyMoved = true;
          gained += result.gained;
          setLine(grid, dir, i, result.line);
        }

        if (!anyMoved) return prevGrid;

        for (let r = 0; r < SIZE; r++)
          for (let c = 0; c < SIZE; c++) {
            const t = grid[r][c];
            if (t) {
              t.isNew = false;
            }
          }

        spawnTile(grid);

        if (gained) setScore((s) => s + gained);
        if (grid.flat().some((t) => t && t.value >= 2048)) setWon(true);

        const hasEmpty = grid.flat().some((t) => !t);
        const canMerge = ["up", "down", "left", "right"].some((d) => {
          const test = cloneGrid(grid);
          let moved = false;
          for (let i = 0; i < SIZE; i++) {
            const line = getLine(test, d as any, i);
            if (mergeLine(line).moved) moved = true;
          }
          return moved;
        });
        if (!hasEmpty && !canMerge) setGameOver(true);

        return grid;
      });
    },
    [gameOver]
  );

  useEffect(() => {
    setBest((b) => Math.max(b, score));
  }, [score]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const map: Record<string, "up" | "down" | "left" | "right"> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        w: "up",
        s: "down",
        a: "left",
        d: "right",
      };
      const dir = map[e.key];
      if (!dir) return;
      e.preventDefault();
      move(dir);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  function restart() {
    const g = emptyGrid();
    spawnTile(g);
    spawnTile(g);
    setGrid(g);
    setScore(0);
    setGameOver(false);
    setWon(false);
  }

  const tiles = grid.flat().filter(Boolean) as Tile[];

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between font-mono text-xs text-paper-dim" style={{ width: BOARD }}>
        <span>Score: {score}</span>
        <span>Best: {best}</span>
      </div>

      <div
        className="relative rounded-xl border border-line-strong bg-ink-3 shadow-xl shadow-black/40"
        style={{ width: BOARD, height: BOARD }}
      >
        {Array.from({ length: SIZE * SIZE }).map((_, i) => {
          const r = Math.floor(i / SIZE);
          const c = i % SIZE;
          return (
            <div
              key={i}
              className="absolute rounded-lg bg-ink/40"
              style={{
                width: CELL,
                height: CELL,
                top: GAP + r * (CELL + GAP),
                left: GAP + c * (CELL + GAP),
              }}
            />
          );
        })}

        <AnimatePresence>
          {tiles.map((t) => {
            const colors = TILE_COLORS[t.value] || { bg: "#ffffff", fg: "#141210" };
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ scale: t.isNew ? 0 : 1, opacity: t.isNew ? 0 : 1 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className="absolute flex items-center justify-center rounded-lg font-display font-bold"
                style={{
                  width: CELL,
                  height: CELL,
                  top: GAP + t.row * (CELL + GAP),
                  left: GAP + t.col * (CELL + GAP),
                  background: colors.bg,
                  color: colors.fg,
                  fontSize: t.value >= 1024 ? 20 : t.value >= 128 ? 24 : 28,
                }}
              >
                {t.value}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {(gameOver || won) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-ink/85 backdrop-blur-sm">
            <p className="font-display text-lg font-semibold text-paper">
              {won ? "You hit 2048!" : "No more moves"}
            </p>
            <p className="font-mono text-xs text-paper-dim">Score: {score}</p>
            <button
              onClick={won ? () => setWon(false) : restart}
              className="rounded-full bg-ember px-4 py-2 text-xs font-semibold text-ink transition hover:brightness-110"
            >
              {won ? "Keep playing" : "Try again"}
            </button>
          </div>
        )}
      </div>
      <p className="font-mono text-[11px] text-paper-dim">Arrow keys or WASD</p>
    </div>
  );
}
