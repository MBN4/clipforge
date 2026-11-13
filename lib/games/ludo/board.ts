// Pure board geometry for Ludo. A 15x15 grid, cells addressed as [col,row], row 0 at the top.
// Colours sit clockwise: 0 red (top-left), 1 green (top-right), 2 yellow (bottom-right), 3 blue (bottom-left).

export type Color = 0 | 1 | 2 | 3;
export type Cell = readonly [number, number];

export const COLOR_NAMES = ["Red", "Green", "Yellow", "Blue"] as const;
export const COLORS: Color[] = [0, 1, 2, 3];

/** Token positions: -1 = in the yard, 0..50 = shared track (relative to the colour's start),
 *  51..55 = the colour's home column, 56 = home (the centre). */
export const YARD = -1;
export const LAST_TRACK = 50;
export const HOME_COL_START = 51;
export const HOME = 56;
export const TRACK_LEN = 52;

function buildTrack(): Cell[] {
  const t: Cell[] = [];
  const add = (c: number, r: number) => t.push([c, r]);
  for (let c = 1; c <= 5; c++) add(c, 6);
  for (let r = 5; r >= 0; r--) add(6, r);
  add(7, 0);
  add(8, 0);
  for (let r = 1; r <= 5; r++) add(8, r);
  for (let c = 9; c <= 14; c++) add(c, 6);
  add(14, 7);
  add(14, 8);
  for (let c = 13; c >= 9; c--) add(c, 8);
  for (let r = 9; r <= 14; r++) add(8, r);
  add(7, 14);
  add(6, 14);
  for (let r = 13; r >= 9; r--) add(6, r);
  for (let c = 5; c >= 0; c--) add(c, 8);
  add(0, 7);
  add(0, 6);
  return t;
}

/** The 52 shared squares, clockwise, index 0 = red's start. */
export const TRACK: readonly Cell[] = buildTrack();

/** Absolute track index of a colour's start square. */
export const startIndex = (c: Color): number => c * 13;

/** Star squares sit 8 steps past each start. Start squares are safe too. */
export const SAFE_ABS: ReadonlySet<number> = new Set([0, 13, 26, 39, 8, 21, 34, 47]);
export const STAR_ABS: readonly number[] = [8, 21, 34, 47];

/** Absolute track index for a colour's relative position 0..50 (null otherwise). */
export function absOf(color: Color, pos: number): number | null {
  if (pos < 0 || pos > LAST_TRACK) return null;
  return (startIndex(color) + pos) % TRACK_LEN;
}

export function homeColCell(color: Color, k: number): Cell {
  switch (color) {
    case 0:
      return [1 + k, 7];
    case 1:
      return [7, 1 + k];
    case 2:
      return [13 - k, 7];
    default:
      return [7, 13 - k];
  }
}

/** Yard origin (top-left cell) per colour; yards are 6x6. */
export const YARD_ORIGIN: Record<Color, Cell> = { 0: [0, 0], 1: [9, 0], 2: [9, 9], 3: [0, 9] };

/** Centre of the t-th yard slot (cell-centre coordinates, i.e. +0.5 already applied). */
export function yardSlot(color: Color, t: number): [number, number] {
  const [ox, oy] = YARD_ORIGIN[color];
  const dx = t % 2 === 0 ? 2 : 4;
  const dy = t < 2 ? 2 : 4;
  return [ox + dx + 0.0, oy + dy + 0.0];
}

/** The board cell a colour's position maps to. Yard and home return null. */
export function cellOf(color: Color, pos: number): Cell | null {
  if (pos >= 0 && pos <= LAST_TRACK) return TRACK[(startIndex(color) + pos) % TRACK_LEN];
  if (pos >= HOME_COL_START && pos < HOME) return homeColCell(color, pos - HOME_COL_START);
  return null;
}

/** Drawing coordinates (cell units, centre of the square) for a token. */
export function pointOf(color: Color, pos: number, t: number): [number, number] {
  if (pos === YARD) return yardSlot(color, t);
  if (pos === HOME) return homeSpot(color, t);
  const c = cellOf(color, pos)!;
  return [c[0] + 0.5, c[1] + 0.5];
}

/** Where finished tokens rest inside their colour's triangle in the centre. */
export function homeSpot(color: Color, t: number): [number, number] {
  const off = (t - 1.5) * 0.3;
  switch (color) {
    case 0:
      return [6.55, 7.5 + off];
    case 1:
      return [7.5 + off, 6.55];
    case 2:
      return [8.45, 7.5 + off];
    default:
      return [7.5 + off, 8.45];
  }
}
