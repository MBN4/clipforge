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
}

export const CAPTION_FONT_LIST: CaptionFont[] = [
  { family: "Poppins", assFamily: "Poppins ExtraBold", label: "Poppins", assBold: false, cssWeight: 800, cssScale: 0.568, bundled: true },
  { family: "Anton", label: "Anton", assBold: false, cssWeight: 400, cssScale: 0.577, bundled: true },
  { family: "Bebas Neue", label: "Bebas Neue", assBold: false, cssWeight: 400, cssScale: 0.769, bundled: true },
  { family: "Archivo Black", label: "Archivo Black", assBold: false, cssWeight: 400, cssScale: 0.742, bundled: true },
  { family: "Luckiest Guy", label: "Luckiest Guy", assBold: false, cssWeight: 400, cssScale: 0.816, bundled: true },
  { family: "Bangers", label: "Bangers", assBold: false, cssWeight: 400, cssScale: 0.569, bundled: true },
  { family: "Permanent Marker", label: "Permanent Marker", assBold: false, cssWeight: 400, cssScale: 0.701, bundled: true },
  { family: "DejaVu Sans", label: "DejaVu Sans", assBold: true, cssWeight: 900, cssScale: 0.859, bundled: false },
  { family: "Liberation Sans", label: "Liberation Sans", assBold: true, cssWeight: 900, cssScale: 0.895, bundled: false },
  { family: "DejaVu Serif", label: "DejaVu Serif", assBold: true, cssWeight: 900, cssScale: 0.851, bundled: false },
  { family: "Liberation Mono", label: "Liberation Mono", assBold: true, cssWeight: 900, cssScale: 0.883, bundled: false },
];

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
