import type { Color } from "@/lib/games/ludo/board";

export interface Swatch {
  base: string;
  light: string;
  dark: string;
  /** soft tint used on the board's yards */
  tint: string;
}

export const SWATCH: Record<Color, Swatch> = {
  0: { base: "#ef4444", light: "#fecaca", dark: "#9b1c1c", tint: "#fde4e4" },
  1: { base: "#22b45a", light: "#bbf7d0", dark: "#14532d", tint: "#dcf7e5" },
  2: { base: "#f5b400", light: "#fef08a", dark: "#a16207", tint: "#fdf1c4" },
  3: { base: "#3b82f6", light: "#bfdbfe", dark: "#1e3a8a", tint: "#dbe8fd" },
};
