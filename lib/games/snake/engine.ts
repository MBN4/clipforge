// Pure Snake rules — no React/DOM, so it can be simulated and tested in node.

export type Dir = "up" | "down" | "left" | "right";
export type SnakeMode = "classic" | "wrap" | "rocks" | "blitz";

export interface Cell {
  x: number;
  y: number;
}

export interface SnakeState {
  size: number;
  mode: SnakeMode;
  /** head first */
  body: Cell[];
  dir: Dir;
  /** buffered turns (max 2) so quick double-taps like ↑← both register */
  queue: Dir[];
  food: Cell;
  bonus: { cell: Cell; ttl: number } | null;
  rocks: Cell[];
  score: number;
  foodEaten: number;
  ticks: number;
  alive: boolean;
  cause?: "wall" | "self" | "rock" | "perfect";
}

export type Rng = () => number;

export interface StepResult {
  ate: boolean;
  ateBonus: boolean;
  died: boolean;
  /** speed tier went up on this tick (for a sound cue) */
  levelUp: boolean;
}

export const GRID = 20;
export const FOOD_POINTS = 10;
export const BONUS_POINTS = 50;
const BONUS_EVERY = 5;
const BONUS_TTL = 36;

export const MODES: { key: SnakeMode; label: string; blurb: string }[] = [
  { key: "classic", label: "Classic", blurb: "Walls are deadly. The original." },
  { key: "wrap", label: "Portal", blurb: "Edges wrap around — slide off one side, appear on the other." },
  { key: "rocks", label: "Rocks", blurb: "Boulders litter the field. Weave through them." },
  { key: "blitz", label: "Blitz", blurb: "Speeds up fast. How long can you hold on?" },
];

const DELTA: Record<Dir, Cell> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };
export const dirDelta = (d: Dir) => DELTA[d];

const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;

function freeCell(s: SnakeState, rng: Rng, extra: Cell[] = []): Cell | null {
  const taken = new Set<number>();
  const key = (c: Cell) => c.y * s.size + c.x;
  s.body.forEach((c) => taken.add(key(c)));
  s.rocks.forEach((c) => taken.add(key(c)));
  extra.forEach((c) => taken.add(key(c)));
  if (s.bonus) taken.add(key(s.bonus.cell));
  const free: Cell[] = [];
  for (let y = 0; y < s.size; y++) for (let x = 0; x < s.size; x++) if (!taken.has(y * s.size + x)) free.push({ x, y });
  if (!free.length) return null;
  return free[Math.floor(rng() * free.length)];
}

/** Rocks are isolated single cells away from the border and the start area, so they can never wall off part of the field. */
function placeRocks(size: number, rng: Rng, count: number): Cell[] {
  const rocks: Cell[] = [];
  let guard = 0;
  while (rocks.length < count && guard++ < 500) {
    const c = { x: 2 + Math.floor(rng() * (size - 4)), y: 2 + Math.floor(rng() * (size - 4)) };
    const startZone = Math.abs(c.x - size / 2) < 5 && Math.abs(c.y - size / 2) < 3; // keep the opening runway clear
    const touching = rocks.some((r) => Math.abs(r.x - c.x) <= 1 && Math.abs(r.y - c.y) <= 1);
    if (!startZone && !touching) rocks.push(c);
  }
  return rocks;
}

export function newGame(mode: SnakeMode, rng: Rng = Math.random, size = GRID): SnakeState {
  const mid = Math.floor(size / 2);
  const s: SnakeState = {
    size,
    mode,
    body: [
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
    ],
    dir: "right",
    queue: [],
    food: { x: 0, y: 0 },
    bonus: null,
    rocks: mode === "rocks" ? placeRocks(size, rng, 9) : [],
    score: 0,
    foodEaten: 0,
    ticks: 0,
    alive: true,
  };
  // the first apple appears ahead of the snake so the first move has a purpose
  const ahead = { x: Math.min(size - 2, mid + 4 + Math.floor(rng() * 3)), y: mid + Math.floor(rng() * 5) - 2 };
  s.food = s.rocks.some((r) => same(r, ahead)) ? (freeCell(s, rng) as Cell) : ahead;
  return s;
}

/** Buffer a turn. Reversals (relative to the last queued/current heading) are ignored. */
export function queueTurn(s: SnakeState, d: Dir) {
  const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
  if (d === last || d === OPPOSITE[last]) return;
  if (s.queue.length < 2) s.queue.push(d);
}

/** Milliseconds per tick for the current length/mode: starts relaxed, speeds up as you eat. */
export function tickMs(s: SnakeState): number {
  const tier = Math.floor(s.foodEaten / 3);
  if (s.mode === "blitz") return Math.max(48, 120 - tier * 9);
  return Math.max(70, 140 - tier * 4);
}

export function speedTier(s: SnakeState): number {
  return Math.floor(s.foodEaten / 3);
}

export function step(s: SnakeState, rng: Rng = Math.random): StepResult {
  const res: StepResult = { ate: false, ateBonus: false, died: false, levelUp: false };
  if (!s.alive) return { ...res, died: true };

  if (s.queue.length) s.dir = s.queue.shift()!;
  const head = s.body[0];
  const d = DELTA[s.dir];
  let nx = head.x + d.x;
  let ny = head.y + d.y;

  if (s.mode === "wrap") {
    nx = (nx + s.size) % s.size;
    ny = (ny + s.size) % s.size;
  } else if (nx < 0 || ny < 0 || nx >= s.size || ny >= s.size) {
    return die(s, "wall");
  }
  const next = { x: nx, y: ny };

  const eatsFood = same(next, s.food);
  const eatsBonus = !!s.bonus && same(next, s.bonus.cell);
  const grows = eatsFood || eatsBonus;

  if (s.rocks.some((r) => same(r, next))) return die(s, "rock");
  // the tail cell frees up this tick unless we're growing, so chasing your own tail is legal
  const solid = grows ? s.body : s.body.slice(0, -1);
  if (solid.some((c) => same(c, next))) return die(s, "self");

  s.body.unshift(next);
  if (!grows) s.body.pop();
  s.ticks++;

  if (s.bonus) {
    s.bonus.ttl--;
    if (s.bonus.ttl <= 0 && !eatsBonus) s.bonus = null;
  }

  if (eatsBonus) {
    s.score += BONUS_POINTS;
    s.bonus = null;
    res.ateBonus = true;
  }
  if (eatsFood) {
    const before = speedTier(s);
    s.score += FOOD_POINTS;
    s.foodEaten++;
    res.ate = true;
    res.levelUp = speedTier(s) > before;
    const f = freeCell(s, rng);
    if (!f) {
      s.alive = false;
      s.cause = "perfect"; // the board is full — a flawless run
      return { ...res, died: true };
    }
    s.food = f;
    if (s.foodEaten % BONUS_EVERY === 0 && !s.bonus) {
      const b = freeCell(s, rng, [f]);
      if (b) s.bonus = { cell: b, ttl: BONUS_TTL };
    }
  }
  return res;
}

function die(s: SnakeState, cause: NonNullable<SnakeState["cause"]>): StepResult {
  s.alive = false;
  s.cause = cause;
  return { ate: false, ateBonus: false, died: true, levelUp: false };
}
