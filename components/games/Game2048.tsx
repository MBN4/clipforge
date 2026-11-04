"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sfx } from "@/lib/sound";

const CELL = 72;
const GAP = 8;
const SIZES = [4, 5] as const;
type Size = (typeof SIZES)[number];

interface Tile {
  id: string;
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
  // Date.now() mixed in so a Fast Refresh module reload (which resets the
  // counter to 1) can't collide with ids already rendered from before reload.
  return `${Date.now().toString(36)}-${(uid++).toString(36)}`;
}

function emptyGrid(size: Size): (Tile | null)[][] {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

function cloneGrid(grid: (Tile | null)[][]): (Tile | null)[][] {
  return grid.map((row) => row.map((t) => (t ? { ...t } : null)));
}

function spawnTile(grid: (Tile | null)[][], size: Size): Tile | null {
  const empties: [number, number][] = [];
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) if (!grid[r][c]) empties.push([r, c]);
  if (!empties.length) return null;
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  const tile: Tile = { id: nextId(), value: Math.random() < 0.9 ? 2 : 4, row: r, col: c, isNew: true };
  grid[r][c] = tile;
  return tile;
}

function getLine(grid: (Tile | null)[][], size: Size, dir: "up" | "down" | "left" | "right", index: number): (Tile | null)[] {
  const line: (Tile | null)[] = [];
  for (let i = 0; i < size; i++) {
    if (dir === "left" || dir === "right") line.push(grid[index][i]);
    else line.push(grid[i][index]);
  }
  if (dir === "right" || dir === "down") line.reverse();
  return line;
}

function setLine(
  grid: (Tile | null)[][],
  size: Size,
  dir: "up" | "down" | "left" | "right",
  index: number,
  line: (Tile | null)[]
) {
  const ordered = dir === "right" || dir === "down" ? [...line].reverse() : line;
  for (let i = 0; i < size; i++) {
    const tile = ordered[i];
    if (!tile) {
      // Must explicitly clear empty slots too — otherwise a cell that held a
      // tile before the shift/merge keeps a stale reference to it, so the
      // same tile ends up duplicated at both its old and new position.
      if (dir === "left" || dir === "right") grid[index][i] = null;
      else grid[i][index] = null;
      continue;
    }
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

function mergeLine(line: (Tile | null)[], size: Size): { line: (Tile | null)[]; gained: number; moved: boolean } {
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
  while (result.length < size) result.push(null);

  const after = result.map((t) => (t ? `${t.id}:${t.value}` : "_"));
  return { line: result, gained, moved: original.join(",") !== after.join(",") };
}

export function Game2048() {
  const [size, setSize] = useState<Size>(4);
  const [grid, setGrid] = useState<(Tile | null)[][]>(() => {
    const g = emptyGrid(4);
    spawnTile(g, 4);
    spawnTile(g, 4);
    return g;
  });
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [started, setStarted] = useState(false);
  const busyRef = useRef(false);

  const board = size * CELL + (size + 1) * GAP;

  const move = useCallback(
    (dir: "up" | "down" | "left" | "right") => {
      if (busyRef.current || gameOver) return;
      setGrid((prevGrid) => {
        const grid = cloneGrid(prevGrid);
        let anyMoved = false;
        let gained = 0;

        for (let i = 0; i < size; i++) {
          const line = getLine(grid, size, dir, i);
          const result = mergeLine(line, size);
          if (result.moved) anyMoved = true;
          gained += result.gained;
          setLine(grid, size, dir, i, result.line);
        }

        if (!anyMoved) return prevGrid;
        sfx.move();

        for (let r = 0; r < size; r++)
          for (let c = 0; c < size; c++) {
            const t = grid[r][c];
            if (t) t.isNew = false;
          }

        spawnTile(grid, size);

        if (gained) {
          sfx.merge();
          setScore((s) => s + gained);
        }
        if (grid.flat().some((t) => t && t.value >= 2048)) {
          setWon(true);
          sfx.win();
        }

        const hasEmpty = grid.flat().some((t) => !t);
        const canMerge = (["up", "down", "left", "right"] as const).some((d) => {
          const test = cloneGrid(grid);
          let moved = false;
          for (let i = 0; i < size; i++) {
            const line = getLine(test, size, d, i);
            if (mergeLine(line, size).moved) moved = true;
          }
          return moved;
        });
        if (!hasEmpty && !canMerge) {
          setGameOver(true);
          sfx.lose();
        }

        return grid;
      });
    },
    [gameOver, size]
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
      if (!started) setStarted(true);
      move(dir);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, started]);

  function restart(nextSize: Size = size) {
    const g = emptyGrid(nextSize);
    spawnTile(g, nextSize);
    spawnTile(g, nextSize);
    setSize(nextSize);
    setGrid(g);
    setScore(0);
    setGameOver(false);
    setWon(false);
    setStarted(false);
  }

  const tiles = grid.flat().filter(Boolean) as Tile[];

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="inline-flex rounded-full border border-line-strong bg-ink-3 p-1 text-xs">
        {SIZES.map((s) => (
          <button
            key={s}
            disabled={started}
            onClick={() => restart(s)}
            className={`rounded-full px-3 py-1 font-semibold transition disabled:opacity-40 ${
              size === s ? "bg-paper text-ink" : "text-paper-dim hover:text-paper"
            }`}
          >
            {s}×{s}
          </button>
        ))}
      </div>

      <div className="flex w-full items-center justify-between font-mono text-xs text-paper-dim" style={{ width: board }}>
        <span>Score: {score}</span>
        <span>Best: {best}</span>
      </div>

      <div
        className="relative rounded-xl border border-line-strong bg-ink-3 shadow-xl shadow-black/40"
        style={{ width: board, height: board }}
      >
        {Array.from({ length: size * size }).map((_, i) => {
          const r = Math.floor(i / size);
          const c = i % size;
          return (
            <div
              key={`bg-${i}`}
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
                key={`tile-${t.id}`}
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
              onClick={won ? () => setWon(false) : () => restart()}
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
