export interface PlayerColor {
  id: string;
  label: string;
  main: string;
  light: string;
  dark: string;
}

export const PLAYER_COLORS: PlayerColor[] = [
  { id: "ember", label: "Ember", main: "#ff4e1f", light: "#ffb199", dark: "#8f2208" },
  { id: "moss", label: "Moss", main: "#b6e63a", light: "#efffb5", dark: "#5f8312" },
  { id: "sky", label: "Sky", main: "#3db8ff", light: "#bde8ff", dark: "#146394" },
  { id: "amber", label: "Amber", main: "#ffc233", light: "#ffeab0", dark: "#9a6a00" },
];

// body palettes for the snakes: [dark edge, base, light belly]
export const SNAKE_PALETTES: [string, string, string][] = [
  ["#14532d", "#22c55e", "#bbf7d0"],
  ["#7c2d12", "#f97316", "#fed7aa"],
  ["#4c1d95", "#a855f7", "#e9d5ff"],
  ["#831843", "#ec4899", "#fbcfe8"],
  ["#134e4a", "#14b8a6", "#99f6e4"],
  ["#713f12", "#eab308", "#fef08a"],
  ["#7f1d1d", "#ef4444", "#fecaca"],
  ["#1e3a8a", "#3b82f6", "#bfdbfe"],
];

export const POWER_INFO = {
  bolt: { label: "Lightning", color: "#ffd23f", text: "Roll again straight away." },
  shield: { label: "Shield", color: "#4cc3ff", text: "Blocks the next snake that would bite you." },
  gift: { label: "Gift", color: "#ff7ac8", text: "Swap places with the player in front of you, if you want to." },
} as const;
