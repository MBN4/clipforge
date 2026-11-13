// Card primitives for the UNO-style game: pure TS, no DOM/React.

export type Color = "red" | "yellow" | "green" | "blue";
export const COLORS: Color[] = ["red", "yellow", "green", "blue"];

export type Value = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "skip" | "reverse" | "draw2" | "wild" | "wild4";

export interface Card {
  /** unique 0..107 */
  id: number;
  /** null for wild cards */
  color: Color | null;
  value: Value;
}

export type Rng = () => number;

const NUMBERS: Value[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const ACTIONS: Value[] = ["skip", "reverse", "draw2"];

/** The full 108-card deck, in a fixed order, ids 0..107. */
export function buildDeck(): Card[] {
  const cards: Card[] = [];
  let id = 0;
  for (const color of COLORS) {
    cards.push({ id: id++, color, value: "0" });
    for (const v of [...NUMBERS, ...ACTIONS]) {
      cards.push({ id: id++, color, value: v });
      cards.push({ id: id++, color, value: v });
    }
  }
  for (let i = 0; i < 4; i++) cards.push({ id: id++, color: null, value: "wild" });
  for (let i = 0; i < 4; i++) cards.push({ id: id++, color: null, value: "wild4" });
  return cards;
}

/** Fisher-Yates on a copy. */
export function shuffle<T>(arr: readonly T[], rng: Rng = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function cardPoints(c: Card): number {
  if (c.value === "wild" || c.value === "wild4") return 50;
  if (c.value === "skip" || c.value === "reverse" || c.value === "draw2") return 20;
  return Number(c.value);
}

export const COLOR_NAME: Record<Color, string> = { red: "Red", yellow: "Yellow", green: "Green", blue: "Blue" };

export function cardLabel(c: Card): string {
  const v =
    c.value === "skip" ? "Skip" : c.value === "reverse" ? "Reverse" : c.value === "draw2" ? "Draw Two" : c.value === "wild" ? "Wild" : c.value === "wild4" ? "Wild Draw Four" : c.value;
  return c.color ? `${COLOR_NAME[c.color]} ${v}` : v;
}

export const isWild = (c: Card) => c.color === null;
export const isAction = (c: Card) => c.value === "skip" || c.value === "reverse" || c.value === "draw2";
