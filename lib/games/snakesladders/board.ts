// Pure board model for Snakes & Ladders: numbering, layouts, validation, movement.

export type PowerKind = "bolt" | "shield" | "gift";
export type Overshoot = "bounce" | "exact";

export interface Jump {
  from: number;
  to: number;
}
export interface PowerSquare {
  sq: number;
  kind: PowerKind;
}
export interface Layout {
  id: string;
  name: string;
  size: number;
  snakes: Jump[]; // from = head (high), to = tail (low)
  ladders: Jump[]; // from = foot (low), to = top (high)
  powers: PowerSquare[];
}

export const lastSquare = (size: number) => size * size;

/** Square 1 is bottom-left, rows zig-zag (boustrophedon). row 0 = bottom row, col 0 = left column. */
export function squareToRC(n: number, size: number): { row: number; col: number } {
  const i = n - 1;
  const row = Math.floor(i / size);
  const k = i % size;
  return { row, col: row % 2 === 0 ? k : size - 1 - k };
}

export function rcToSquare(row: number, col: number, size: number): number {
  const k = row % 2 === 0 ? col : size - 1 - col;
  return row * size + k + 1;
}

export const rowOf = (n: number, size: number) => Math.floor((n - 1) / size);

export interface JumpMaps {
  snake: Map<number, number>;
  ladder: Map<number, number>;
  power: Map<number, PowerKind>;
}

export function jumpMaps(l: Layout): JumpMaps {
  return {
    snake: new Map(l.snakes.map((j) => [j.from, j.to])),
    ladder: new Map(l.ladders.map((j) => [j.from, j.to])),
    power: new Map(l.powers.map((p) => [p.sq, p.kind])),
  };
}

/** Returns a list of problems (empty = valid). Chains are disallowed: every jump endpoint is a distinct square. */
export function validateLayout(l: Layout): string[] {
  const errs: string[] = [];
  const last = lastSquare(l.size);
  const seen = new Map<number, string>();
  const claim = (sq: number, what: string) => {
    if (!Number.isInteger(sq) || sq < 1 || sq > last) return errs.push(`${what}: ${sq} off board`);
    if (sq === 1 || sq === last) errs.push(`${what}: ${sq} is the start/finish square`);
    const prev = seen.get(sq);
    if (prev) errs.push(`${what}: square ${sq} already used by ${prev}`);
    else seen.set(sq, what);
  };
  for (const s of l.snakes) {
    claim(s.from, `snake head ${s.from}->${s.to}`);
    claim(s.to, `snake tail ${s.from}->${s.to}`);
    if (!(s.from > s.to)) errs.push(`snake ${s.from}->${s.to} does not go down`);
    if (rowOf(s.from, l.size) === rowOf(s.to, l.size)) errs.push(`snake ${s.from}->${s.to} is within one row`);
  }
  for (const s of l.ladders) {
    claim(s.from, `ladder foot ${s.from}->${s.to}`);
    claim(s.to, `ladder top ${s.from}->${s.to}`);
    if (!(s.from < s.to)) errs.push(`ladder ${s.from}->${s.to} does not go up`);
    if (rowOf(s.from, l.size) === rowOf(s.to, l.size)) errs.push(`ladder ${s.from}->${s.to} is within one row`);
  }
  for (const p of l.powers) claim(p.sq, `power ${p.kind}@${p.sq}`);
  return errs;
}

export interface MovePath {
  /** squares visited hop by hop (excludes the start) */
  path: number[];
  end: number;
  bounced: boolean;
  stayed: boolean;
}

/** Walk `roll` squares from `pos`, applying the finish rule (exact landing on the last square). */
export function movePath(pos: number, roll: number, size: number, overshoot: Overshoot): MovePath {
  const last = lastSquare(size);
  const target = pos + roll;
  if (target <= last) {
    const path: number[] = [];
    for (let s = pos + 1; s <= target; s++) path.push(s);
    return { path, end: target, bounced: false, stayed: false };
  }
  if (overshoot === "exact") return { path: [], end: pos, bounced: false, stayed: true };
  const path: number[] = [];
  for (let s = pos + 1; s <= last; s++) path.push(s);
  const back = target - last;
  for (let k = 1; k <= back; k++) path.push(last - k);
  return { path, end: last - back, bounced: true, stayed: false };
}

/** Square a piece ends on after a plain move + any snake/ladder (no shields). */
export function resolveSquare(l: Layout, sq: number): number {
  const m = jumpMaps(l);
  return m.ladder.get(sq) ?? m.snake.get(sq) ?? sq;
}

/** True when the last square can be reached from square 1 by some sequence of rolls. */
export function isWinnable(l: Layout, overshoot: Overshoot): boolean {
  const last = lastSquare(l.size);
  const m = jumpMaps(l);
  const seen = new Set<number>([1]);
  const q = [1];
  while (q.length) {
    const p = q.shift()!;
    if (p === last) return true;
    for (let r = 1; r <= 6; r++) {
      const e = movePath(p, r, l.size, overshoot).end;
      const n = m.ladder.get(e) ?? m.snake.get(e) ?? e;
      if (!seen.has(n)) {
        seen.add(n);
        q.push(n);
      }
    }
  }
  return false;
}

/** Fewest rolls needed from square 1 (BFS) — ladders make this small. Infinity if unreachable. */
export function shortestWin(l: Layout, overshoot: Overshoot): number {
  const last = lastSquare(l.size);
  const m = jumpMaps(l);
  const dist = new Map<number, number>([[1, 0]]);
  const q = [1];
  while (q.length) {
    const p = q.shift()!;
    if (p === last) return dist.get(p)!;
    for (let r = 1; r <= 6; r++) {
      const e = movePath(p, r, l.size, overshoot).end;
      const n = m.ladder.get(e) ?? m.snake.get(e) ?? e;
      if (!dist.has(n)) {
        dist.set(n, dist.get(p)! + 1);
        q.push(n);
      }
    }
  }
  return Infinity;
}
