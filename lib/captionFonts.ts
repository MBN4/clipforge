// Caption font registry — shared by the browser preview and the server-side
// libass render. The "bundled" fonts live in public/fonts/ and are loaded both
// as @font-face (preview, see app/globals.css) and via the ass filter's
// `fontsdir` option (export), so what you see in the editor is what you get
// in the exported file. The "system" ones are the original defaults and rely
// on the host having them installed (see README requirements).

export interface CaptionFont {
  family: string;
  /** Family name libass must ask for, when it differs from the CSS family.
   * libass matches the legacy (nameID 1) family, which for non-regular
   * static weights includes the weight, e.g. "Poppins ExtraBold". Asking
   * for the wrong name silently falls back to some other system font. */
  assFamily?: string;
  /** Short label for the picker. */
  label: string;
  /** Picker grouping. */
  group: "Bold" | "Display" | "Handwritten" | "Retro" | "System";
  /** Whether libass should request the bold weight. Single-weight display
   * fonts must be false, or libass synthesizes a smeared faux-bold. */
  assBold: boolean;
  /** CSS font-weight to use in the preview. */
  cssWeight: number;
  /** libass sizes text so (winAscent + winDescent) == Fontsize, while CSS
   * sizes the em box. Multiply an ASS font size by this to get the CSS
   * font-size that renders glyphs at the same height (unitsPerEm /
   * (winAscent + winDescent), measured from each font file). */
  cssScale: number;
  bundled: boolean;
  /** Very wide faces get a smaller sample in the preset tiles so they fit (default 1). */
  tileFit?: number;
}

export const CAPTION_FONT_LIST: CaptionFont[] = [
  { family: "Poppins", assFamily: "Poppins ExtraBold", label: "Poppins", group: "Bold", assBold: false, cssWeight: 800, cssScale: 0.568, bundled: true },
  { family: "Poppins Black", assFamily: "Poppins Black", label: "Poppins Black", group: "Bold", assBold: false, cssWeight: 900, cssScale: 0.568, bundled: true },
  { family: "Poppins Bold", assFamily: "Poppins", label: "Poppins Bold", group: "Bold", assBold: true, cssWeight: 700, cssScale: 0.568, bundled: true },
  { family: "Anton", label: "Anton", group: "Bold", assBold: false, cssWeight: 400, cssScale: 0.577, bundled: true },
  { family: "Bebas Neue", label: "Bebas Neue", group: "Bold", assBold: false, cssWeight: 400, cssScale: 0.769, bundled: true },
  { family: "Archivo Black", label: "Archivo Black", group: "Bold", assBold: false, cssWeight: 400, cssScale: 0.742, bundled: true },
  { family: "Russo One", label: "Russo One", group: "Bold", assBold: false, cssWeight: 400, cssScale: 0.83, bundled: true },
  { family: "Bowlby One", label: "Bowlby One", group: "Bold", assBold: false, cssWeight: 400, cssScale: 0.638, bundled: true, tileFit: 0.82 },
  { family: "Lilita One", label: "Lilita One", group: "Display", assBold: false, cssWeight: 400, cssScale: 0.875, bundled: true },
  { family: "Titan One", label: "Titan One", group: "Display", assBold: false, cssWeight: 400, cssScale: 0.873, bundled: true, tileFit: 0.85 },
  { family: "Luckiest Guy", label: "Luckiest Guy", group: "Display", assBold: false, cssWeight: 400, cssScale: 0.816, bundled: true, tileFit: 0.9 },
  { family: "Bangers", label: "Bangers", group: "Display", assBold: false, cssWeight: 400, cssScale: 0.569, bundled: true },
  { family: "Bungee", label: "Bungee", group: "Display", assBold: false, cssWeight: 400, cssScale: 0.389, bundled: true, tileFit: 0.78 },
  { family: "Righteous", label: "Righteous", group: "Display", assBold: false, cssWeight: 400, cssScale: 0.805, bundled: true, tileFit: 0.9 },
  { family: "Abril Fatface", label: "Abril Fatface", group: "Display", assBold: false, cssWeight: 400, cssScale: 0.741, bundled: true },
  { family: "Permanent Marker", label: "Permanent Marker", group: "Handwritten", assBold: false, cssWeight: 400, cssScale: 0.701, bundled: true },
  { family: "Caveat Brush", label: "Caveat Brush", group: "Handwritten", assBold: false, cssWeight: 400, cssScale: 0.794, bundled: true },
  { family: "Pacifico", label: "Pacifico", group: "Handwritten", assBold: false, cssWeight: 400, cssScale: 0.517, bundled: true },
  { family: "Press Start 2P", label: "Press Start 2P", group: "Retro", assBold: false, cssWeight: 400, cssScale: 0.728, bundled: true, tileFit: 0.62 },
  { family: "Black Ops One", label: "Black Ops One", group: "Retro", assBold: false, cssWeight: 400, cssScale: 0.701, bundled: true, tileFit: 0.85 },
  { family: "DejaVu Sans", label: "DejaVu Sans", group: "System", assBold: true, cssWeight: 900, cssScale: 0.859, bundled: false },
  { family: "Liberation Sans", label: "Liberation Sans", group: "System", assBold: true, cssWeight: 900, cssScale: 0.895, bundled: false },
  { family: "DejaVu Serif", label: "DejaVu Serif", group: "System", assBold: true, cssWeight: 900, cssScale: 0.851, bundled: false },
  { family: "Liberation Mono", label: "Liberation Mono", group: "System", assBold: true, cssWeight: 900, cssScale: 0.883, bundled: false },
];

export const CAPTION_FONT_GROUPS = ["Bold", "Display", "Handwritten", "Retro", "System"] as const;

const BY_FAMILY = new Map(CAPTION_FONT_LIST.map((f) => [f.family, f]));

export function getCaptionFont(family: string): CaptionFont {
  return BY_FAMILY.get(family) ?? CAPTION_FONT_LIST[0];
}

export function isKnownCaptionFont(family: unknown): family is string {
  return typeof family === "string" && BY_FAMILY.has(family);
}

/** CSS font-family stack for the preview. */
export function captionFontCss(family: string): string {
  return `"${getCaptionFont(family).family}", "Inter", system-ui, sans-serif`;
}
