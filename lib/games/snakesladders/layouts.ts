// Board layouts: the fixed classic one and random generators for the other modes.
import { Layout, Jump, squareToRC, PowerKind, PowerSquare, Overshoot, isWinnable, lastSquare, validateLayout } from "./board";

export type BoardMode = "classic" | "random" | "fast" | "chaos";

export const MODE_INFO: Record<BoardMode, { label: string; blurb: string }> = {
  classic: { label: "Classic", blurb: "The traditional 10x10 board with a fixed layout: 8 snakes, 9 ladders." },
  random: { label: "Random", blurb: "A fresh, fair 10x10 board every game (snake losses ~ ladder gains)." },
  fast: { label: "Fast", blurb: "A compact 7x7 board (49 squares) with 5 snakes and 5 ladders: short, punchy games." },
  chaos: { label: "Chaos", blurb: "A 10x10 board with 12 snakes and only 6 ladders. Hold on tight." },
};

export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const J = (from: number, to: number): Jump => ({ from, to });

export function classicLayout(): Layout {
  return {
    id: "classic",
    name: "Classic",
    size: 10,
    ladders: [J(2, 38), J(4, 14), J(9, 31), J(21, 42), J(28, 84), J(36, 44), J(51, 67), J(72, 92), J(80, 99)],
    snakes: [J(16, 6), J(47, 26), J(49, 30), J(62, 43), J(64, 60), J(87, 68), J(93, 75), J(97, 79)],
    powers: [],
  };
}

interface GenSpec {
  size: number;
  snakes: [number, number];
  ladders: [number, number];
  /** allowed ratio (total snake drop / total ladder climb) */
  ratio: [number, number];
}

const SPECS: Record<Exclude<BoardMode, "classic">, GenSpec> = {
  random: { size: 10, snakes: [8, 10], ladders: [8, 10], ratio: [0.85, 1.12] },
  fast: { size: 7, snakes: [5, 5], ladders: [5, 5], ratio: [0.85, 1.12] },
  chaos: { size: 10, snakes: [12, 12], ladders: [6, 6], ratio: [1.3, 1.6] },
};

type Seg = [number, number, number, number];
const segOf = (a: number, b: number, size: number): Seg => {
  const p = squareToRC(a, size);
  const q = squareToRC(b, size);
  return [p.col, p.row, q.col, q.row];
};
const orient = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
function crosses(a: Seg, b: Seg): boolean {
  const o1 = orient(a[0], a[1], a[2], a[3], b[0], b[1]);
  const o2 = orient(a[0], a[1], a[2], a[3], b[2], b[3]);
  const o3 = orient(b[0], b[1], b[2], b[3], a[0], a[1]);
  const o4 = orient(b[0], b[1], b[2], b[3], a[2], a[3]);
  return o1 !== o2 && o3 !== o4;
}

function tryGenerate(mode: Exclude<BoardMode, "classic">, rng: () => number): Layout | null {
  const spec = SPECS[mode];
  const { size } = spec;
  const last = lastSquare(size);
  const ri = (a: number, b: number) => a + Math.floor(rng() * (b - a + 1));
  const nS = ri(spec.snakes[0], spec.snakes[1]);
  const nL = ri(spec.ladders[0], spec.ladders[1]);
  const used = new Set<number>([1, last]);
  const minLen = Math.ceil(size * 0.7);
  const maxLen = Math.floor(size * (size > 8 ? 4.5 : 3.5));
  const ladders: Jump[] = [];
  const snakes: Jump[] = [];
  const minRows = size >= 10 ? 2 : 1;
  const maxCols = size >= 10 ? 4 : 3;
  const segs: Seg[] = [];
  // t < 60: keep the board tidy (steep-ish, non-crossing); later attempts relax the crossing rule
  const free = (a: number, b: number, t: number) => {
    if (used.has(a) || used.has(b)) return false;
    const ra = squareToRC(a, size);
    const rb = squareToRC(b, size);
    if (Math.abs(ra.row - rb.row) < minRows || Math.abs(ra.col - rb.col) > maxCols) return false;
    if (t < 60) {
      const sg = segOf(a, b, size);
      if (segs.some((o) => crosses(sg, o))) return false;
    }
    return true;
  };
  for (let i = 0; i < nL; i++) {
    let ok = false;
    for (let t = 0; t < 80 && !ok; t++) {
      const foot = ri(2, last - size);
      const top = Math.min(last - 1, foot + ri(minLen, maxLen));
      if (top <= foot || !free(foot, top, t)) continue;
      segs.push(segOf(foot, top, size));
      used.add(foot);
      used.add(top);
      ladders.push(J(foot, top));
      ok = true;
    }
    if (!ok) return null;
  }
  for (let i = 0; i < nS; i++) {
    let ok = false;
    for (let t = 0; t < 80 && !ok; t++) {
      const head = ri(size + 2, last - 1);
      const tail = head - ri(minLen, maxLen);
      if (tail < 2 || !free(head, tail, t)) continue;
      segs.push(segOf(head, tail, size));
      used.add(head);
      used.add(tail);
      snakes.push(J(head, tail));
      ok = true;
    }
    if (!ok) return null;
  }
  const gain = ladders.reduce((s, l) => s + l.to - l.from, 0);
  const loss = snakes.reduce((s, l) => s + l.from - l.to, 0);
  const ratio = loss / gain;
  if (ratio < spec.ratio[0] || ratio > spec.ratio[1]) return null;
  const layout: Layout = { id: mode, name: MODE_INFO[mode].label, size, snakes, ladders, powers: [] };
  if (validateLayout(layout).length || !isWinnable(layout, "bounce") || !isWinnable(layout, "exact")) return null;
  return layout;
}

export function generateLayout(mode: Exclude<BoardMode, "classic">, rng: () => number = Math.random): Layout {
  for (let i = 0; i < 400; i++) {
    const l = tryGenerate(mode, rng);
    if (l) return l;
  }
  return { ...classicLayout(), id: mode, name: MODE_INFO[mode].label }; // practically unreachable
}

/** Scatter power-up squares on plain squares (never on a snake/ladder end, square 1 or the finish). */
export function withPowerups(layout: Layout, rng: () => number = Math.random): Layout {
  const { size } = layout;
  const last = lastSquare(size);
  const used = new Set<number>([1, last]);
  for (const j of [...layout.snakes, ...layout.ladders]) {
    used.add(j.from);
    used.add(j.to);
  }
  const per = size >= 10 ? 2 : 1;
  const kinds: PowerKind[] = ["bolt", "shield", "gift"];
  const powers: PowerSquare[] = [];
  for (const kind of kinds) {
    for (let i = 0; i < per; i++) {
      for (let t = 0; t < 200; t++) {
        const sq = 3 + Math.floor(rng() * (last - 4));
        if (used.has(sq)) continue;
        used.add(sq);
        powers.push({ sq, kind });
        break;
      }
    }
  }
  return { ...layout, powers };
}

export function buildLayout(mode: BoardMode, powerups: boolean, rng: () => number = Math.random): Layout {
  const base = mode === "classic" ? classicLayout() : generateLayout(mode, rng);
  // classic keeps fixed power squares so the board is familiar run to run
  return powerups ? withPowerups(base, mode === "classic" ? makeRng(7) : rng) : base;
}

export type { Overshoot };
