"use client";

import { memo, useId } from "react";
import type { Card, Color } from "@/lib/games/uno/cards";
import { cardLabel } from "@/lib/games/uno/cards";

export const CARD_RATIO = 1.5;

export const COLOR_HEX: Record<Color, string> = {
  red: "#e23b3b",
  yellow: "#f2b81c",
  green: "#2e9e55",
  blue: "#2563d6",
};
const COLOR_DARK: Record<Color, string> = {
  red: "#9f1d1d",
  yellow: "#a87500",
  green: "#17693a",
  blue: "#143f95",
};
const FONT = "var(--font-bricolage), 'Arial Black', system-ui, sans-serif";

/** Tiny 4-colour pie used for wilds and the colour picker. */
export function QuadPie({ r, stroke }: { r: number; stroke?: string }) {
  const q = (a0: number, c: Color) => {
    const a1 = a0 + Math.PI / 2;
    const x0 = Math.cos(a0) * r;
    const y0 = Math.sin(a0) * r;
    const x1 = Math.cos(a1) * r;
    const y1 = Math.sin(a1) * r;
    return <path key={c} d={`M0 0 L${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1} Z`} fill={COLOR_HEX[c]} stroke={stroke} strokeWidth={stroke ? 1 : 0} />;
  };
  return (
    <g>
      {q(-Math.PI / 2, "red")}
      {q(0, "blue")}
      {q(Math.PI / 2, "green")}
      {q(Math.PI, "yellow")}
    </g>
  );
}

const arrow = (dir: 1 | -1, y: number) => {
  const s = dir;
  return (
    <path
      d={`M${-14 * s} ${y - 5} L${3 * s} ${y - 5} L${3 * s} ${y - 11} L${15 * s} ${y} L${3 * s} ${y + 11} L${3 * s} ${y + 5} L${-14 * s} ${y + 5} Z`}
      strokeLinejoin="round"
    />
  );
};

/** Value glyph drawn around (0,0) within roughly ±20. */
function Glyph({ value, fill, stroke }: { value: Card["value"]; fill: string; stroke?: string }) {
  switch (value) {
    case "skip":
      return (
        <g fill="none" stroke={fill} strokeWidth={7} strokeLinecap="round">
          <circle r={14.5} />
          <path d="M-10 10 L10 -10" />
        </g>
      );
    case "reverse":
      return (
        <g fill={fill} stroke={stroke} strokeWidth={stroke ? 1.5 : 0}>
          {arrow(1, -9)}
          {arrow(-1, 9)}
        </g>
      );
    case "draw2":
      return (
        <g fill={fill} stroke={stroke ?? "#fff"} strokeWidth={2.2} strokeLinejoin="round">
          <rect x={-15} y={-14} width={19} height={27} rx={3.2} transform="rotate(-14)" opacity={0.9} />
          <rect x={-3} y={-12} width={19} height={27} rx={3.2} transform="rotate(10)" />
        </g>
      );
    case "wild4":
      return (
        <g strokeWidth={1.6} stroke="#fff" strokeLinejoin="round">
          <rect x={-18} y={-12} width={14} height={20} rx={2.4} fill={COLOR_HEX.red} transform="rotate(-24 -11 -2)" />
          <rect x={-9} y={-16} width={14} height={20} rx={2.4} fill={COLOR_HEX.yellow} transform="rotate(-8 -2 -6)" />
          <rect x={-3} y={-12} width={14} height={20} rx={2.4} fill={COLOR_HEX.green} transform="rotate(8 4 -2)" />
          <rect x={4} y={-8} width={14} height={20} rx={2.4} fill={COLOR_HEX.blue} transform="rotate(24 11 2)" />
        </g>
      );
    case "wild":
      return null;
    default:
      return (
        <g>
          <text
            textAnchor="middle"
            dominantBaseline="central"
            y={1.5}
            fontFamily={FONT}
            fontWeight={900}
            fontSize={42}
            fill={fill}
            stroke={stroke}
            strokeWidth={stroke ? 1.5 : 0}
            paintOrder="stroke"
          >
            {value}
          </text>
          {(value === "6" || value === "9") && <path d="M-9 20 L9 20" stroke={fill} strokeWidth={3.4} strokeLinecap="round" />}
        </g>
      );
  }
}

const cornerText = (v: Card["value"]) => (v === "draw2" ? "+2" : v === "wild4" ? "+4" : /^\d$/.test(v) ? v : null);

function Corner({ card }: { card: Card }) {
  const t = cornerText(card.value);
  const isWildCard = card.color === null;
  return (
    <g>
      {t ? (
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily={FONT}
          fontWeight={900}
          fontSize={card.value === "draw2" || card.value === "wild4" ? 15 : 19}
          fill="#fff"
          stroke="rgba(0,0,0,0.35)"
          strokeWidth={2.2}
          paintOrder="stroke"
        >
          {t}
        </text>
      ) : card.value === "wild" ? (
        <g transform="scale(0.4)">
          <QuadPie r={20} stroke="#fff" />
        </g>
      ) : (
        <g transform="scale(0.52)">
          <Glyph value={card.value} fill="#fff" stroke={isWildCard ? undefined : "rgba(0,0,0,0.35)"} />
        </g>
      )}
    </g>
  );
}

export const CardFace = memo(function CardFace({ card }: { card: Card }) {
  const uid = useId().replace(/:/g, "");
  const wild = card.color === null;
  const base = wild ? "#15151c" : COLOR_HEX[card.color as Color];
  const dark = wild ? "#000" : COLOR_DARK[card.color as Color];
  return (
    <svg viewBox="0 0 100 150" width="100%" height="100%" role="img" aria-label={cardLabel(card)} style={{ display: "block" }}>
      <defs>
        <linearGradient id={`g${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={base} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <clipPath id={`c${uid}`}>
          <ellipse cx="50" cy="75" rx="31" ry="50" transform="rotate(32 50 75)" />
        </clipPath>
      </defs>
      <rect x="0.5" y="0.5" width="99" height="149" rx="12" fill="#fbfaf6" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
      <rect x="5" y="5" width="90" height="140" rx="8.5" fill={`url(#g${uid})`} />
      {wild ? (
        <g clipPath={`url(#c${uid})`}>
          <g transform="translate(50 75) rotate(32)">
            <QuadPie r={80} />
          </g>
        </g>
      ) : (
        <ellipse cx="50" cy="75" rx="31" ry="50" transform="rotate(32 50 75)" fill="#fbfaf6" />
      )}
      {wild && <ellipse cx="50" cy="75" rx="31" ry="50" transform="rotate(32 50 75)" fill="none" stroke="#fbfaf6" strokeWidth="3.2" />}
      <g transform="translate(50 75) scale(1.28)">
        <Glyph value={card.value} fill={wild ? "#fff" : COLOR_HEX[card.color as Color]} stroke={wild ? undefined : undefined} />
      </g>
      <g transform="translate(19 21)">
        <Corner card={card} />
      </g>
      <g transform="translate(81 129) rotate(180)">
        <Corner card={card} />
      </g>
    </svg>
  );
});

export const CardBack = memo(function CardBack() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 100 150" width="100%" height="100%" aria-hidden style={{ display: "block" }}>
      <defs>
        <linearGradient id={`b${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#23222b" />
          <stop offset="1" stopColor="#0d0c11" />
        </linearGradient>
        <linearGradient id={`o${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff7a3d" />
          <stop offset="1" stopColor="#e0360f" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="99" height="149" rx="12" fill="#fbfaf6" stroke="rgba(0,0,0,0.25)" />
      <rect x="5" y="5" width="90" height="140" rx="8.5" fill={`url(#b${uid})`} />
      <ellipse cx="50" cy="75" rx="33" ry="52" transform="rotate(32 50 75)" fill={`url(#o${uid})`} />
      <ellipse cx="50" cy="75" rx="33" ry="52" transform="rotate(32 50 75)" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.6" />
      <text
        x="50"
        y="76"
        textAnchor="middle"
        dominantBaseline="central"
        transform="rotate(-24 50 76)"
        fontFamily={FONT}
        fontWeight={900}
        fontStyle="italic"
        fontSize="30"
        letterSpacing="1"
        fill="#fff"
        stroke="#7a1c05"
        strokeWidth="3.4"
        paintOrder="stroke"
      >
        UNO
      </text>
      <circle cx="17" cy="19" r="3.2" fill="#ff6a33" />
      <circle cx="83" cy="131" r="3.2" fill="#ff6a33" />
    </svg>
  );
});

/** A card at a fixed pixel width (height follows the 2:3 ratio). Faces use the card's SVG art. */
export function UnoCard({ card, w, className = "", style }: { card: Card | null; w: number; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: w, height: w * CARD_RATIO, borderRadius: w * 0.12, filter: "drop-shadow(0 3px 5px rgba(0,0,0,0.45))", ...style }}
    >
      {card ? <CardFace card={card} /> : <CardBack />}
    </div>
  );
}
