export type BoardTheme = "green" | "brown" | "blue" | "slate";

export const THEMES: Record<BoardTheme, { label: string; light: string; dark: string; hlLight: string; hlDark: string }> = {
  green: { label: "Green", light: "#eeeed2", dark: "#769656", hlLight: "#f6f669", hlDark: "#baca2b" },
  brown: { label: "Wood", light: "#f0d9b5", dark: "#b58863", hlLight: "#f7ec74", hlDark: "#dac34b" },
  blue: { label: "Blue", light: "#dee3e6", dark: "#8ca2ad", hlLight: "#c3d887", hlDark: "#92b166" },
  slate: { label: "Slate", light: "#d9d9d9", dark: "#7d8796", hlLight: "#e9e47a", hlDark: "#b8b450" },
};
