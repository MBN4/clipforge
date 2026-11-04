// Hand-built geometric piece icons (not a copy of any existing piece set) —
// unicode chess glyphs (♔♞ etc.) render as invisible tofu boxes on some
// OS/browser font combinations, so pieces need to be guaranteed-visible SVG.
import type { CSSProperties } from "react";

type PieceType = "p" | "n" | "b" | "r" | "q" | "k";

const SHAPES: Record<PieceType, React.ReactNode> = {
  p: (
    <>
      <circle cx="50" cy="32" r="13" />
      <path d="M38 50 Q50 40 62 50 L68 78 H32 Z" />
      <rect x="26" y="78" width="48" height="9" rx="3" />
    </>
  ),
  r: (
    <>
      <rect x="30" y="20" width="10" height="14" />
      <rect x="47" y="20" width="10" height="14" />
      <rect x="64" y="20" width="10" height="14" />
      <path d="M28 34 H76 L70 56 H34 Z" />
      <path d="M32 56 H72 L76 80 H28 Z" />
      <rect x="24" y="80" width="56" height="9" rx="3" />
    </>
  ),
  b: (
    <>
      <circle cx="50" cy="20" r="6" />
      <path d="M50 28 Q68 42 62 62 Q56 72 50 74 Q44 72 38 62 Q32 42 50 28 Z" />
      <line x1="40" y1="46" x2="60" y2="54" stroke="currentColor" strokeOpacity="0.5" strokeWidth="3" />
      <path d="M38 74 Q50 82 62 74 L66 86 H34 Z" />
      <rect x="26" y="86" width="48" height="7" rx="3" />
    </>
  ),
  n: (
    <>
      <path d="M62 86 H34 L36 66 Q26 64 24 50 Q23 36 38 26 Q46 20 52 22 L48 30 Q58 28 64 38 Q70 48 64 56 L58 54 Q62 62 60 70 Z" />
      <circle cx="43" cy="37" r="2.6" fill="var(--ink-2)" stroke="none" />
      <rect x="26" y="86" width="48" height="7" rx="3" />
    </>
  ),
  q: (
    <>
      <circle cx="28" cy="26" r="6" />
      <circle cx="50" cy="18" r="6" />
      <circle cx="72" cy="26" r="6" />
      <circle cx="39" cy="22" r="5" />
      <circle cx="61" cy="22" r="5" />
      <path d="M26 30 L74 30 L66 64 H34 Z" />
      <path d="M34 64 Q50 76 66 64 L70 86 H30 Z" />
      <rect x="24" y="86" width="52" height="7" rx="3" />
    </>
  ),
  k: (
    <>
      <rect x="47" y="10" width="6" height="16" />
      <rect x="40" y="16" width="20" height="6" />
      <path d="M30 32 H70 L64 62 H36 Z" />
      <path d="M36 62 Q50 74 64 62 L68 86 H32 Z" />
      <rect x="24" y="86" width="52" height="7" rx="3" />
    </>
  ),
};

export function ChessPiece({
  type,
  color,
  size = 40,
  style,
}: {
  type: PieceType;
  color: "w" | "b";
  size?: number;
  style?: CSSProperties;
}) {
  const fill = color === "w" ? "#f5efe3" : "#141210";
  const stroke = color === "w" ? "#141210" : "#f5efe3";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={style}
      className="pointer-events-none select-none"
    >
      <g fill={fill} stroke={stroke} strokeWidth={color === "w" ? 2.5 : 1.5} strokeLinejoin="round" color={stroke}>
        {SHAPES[type]}
      </g>
    </svg>
  );
}
