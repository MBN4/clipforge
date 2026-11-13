"use client";

// Original SVG chess pieces (two sets), drawn on a 100×100 grid so they stay razor sharp at any size.
// "Neo": chunky, rounded silhouettes with soft gradients and a dark outline (the modern-app look).
// "Classic": slimmer Staunton-inspired shapes in ivory and ebony.
import { memo, useId } from "react";

export type PieceSet = "neo" | "classic";
export const PIECE_SETS: { id: PieceSet; label: string }[] = [
  { id: "neo", label: "Neo" },
  { id: "classic", label: "Classic" },
];

/** type: 1 pawn … 6 king; color: 0 white, 1 black */
type Shape = { body: string; details?: string; extra?: (fill: string, stroke: string, detail: string) => React.ReactNode };

const BASE_NEO = "M24 79 Q24 72 32 71 L68 71 Q76 72 76 79 L76 84 Q76 89 70 89 L30 89 Q24 89 24 84 Z";

const NEO: Record<number, Shape> = {
  1: {
    body:
      "M50 17 C58.5 17 64 23 64 30.5 C64 35.5 61.5 39.5 57.5 42 L62 45.5 C62.5 47.5 61.5 49 59.5 49 L57 49 C58 57 62 63 68 69 L68 72 L32 72 L32 69 C38 63 42 57 43 49 L40.5 49 C38.5 49 37.5 47.5 38 45.5 L42.5 42 C38.5 39.5 36 35.5 36 30.5 C36 23 41.5 17 50 17 Z " +
      BASE_NEO,
  },
  2: {
    body:
      "M66 72 C66 60 70 52 73 42 C76 30 70 19 58 14 L56 8 L50 14 L46 8 L43 16 C34 20 28 27 25 35 L18 50 C16 55 19 59 24 58 L32 55 C35 54 38 55 41 54 L45 52 C44 58 38 62 34 72 Z " +
      BASE_NEO,
    details: "M41 54 C46 51 49 46 50 40 M25.5 49 L28 49",
    extra: (_f, s, d) => (
      <>
        <circle cx="40" cy="29" r="3.2" fill={s} />
        <path d="M60 18 C68 24 71 33 68 44" fill="none" stroke={d} strokeWidth="2.6" strokeLinecap="round" />
      </>
    ),
  },
  3: {
    body:
      "M50 8 C54 8 56.5 10.5 56.5 13.5 C56.5 15.5 55.5 17 54 18 C63 23 68 32 68 41 C68 49 63.5 54 58 56 L60 61 L40 61 L42 56 C36.5 54 32 49 32 41 C32 32 37 23 46 18 C44.5 17 43.5 15.5 43.5 13.5 C43.5 10.5 46 8 50 8 Z M40 61 L60 61 C60 64 59 65 57 65 L56 66 C58 68 62 69 66 70 L68 72 L32 72 L34 70 C38 69 42 68 44 66 L43 65 C41 65 40 64 40 61 Z " +
      BASE_NEO,
    details: "M55 30 L47 40 M40 61 L60 61",
  },
  4: {
    body:
      "M27 16 L37 16 L37 22 L45 22 L45 16 L55 16 L55 22 L63 22 L63 16 L73 16 L73 30 C73 32 71.5 33 70 33 L66 33 L64 62 C64 65 66 67 69 69 L69 72 L31 72 L31 69 C34 67 36 65 36 62 L34 33 L30 33 C28.5 33 27 32 27 30 Z " +
      BASE_NEO,
    details: "M34 33 L66 33 M36 61 L64 61",
  },
  5: {
    body:
      "M50 22 L57 40 L67 24 L69 44 L80 31 L74 59 C72 62 70 64 69 66 L69 72 L31 72 L31 66 C30 64 28 62 26 59 L20 31 L31 44 L33 24 L43 40 Z " +
      BASE_NEO,
    details: "M27 59 C42 55 58 55 73 59 M31 66 L69 66",
    extra: (f, s) => (
      <g fill={f} stroke={s} strokeWidth="3">
        <circle cx="50" cy="15" r="5.5" />
        <circle cx="33" cy="18" r="4.8" />
        <circle cx="67" cy="18" r="4.8" />
        <circle cx="19" cy="26" r="4.4" />
        <circle cx="81" cy="26" r="4.4" />
      </g>
    ),
  },
  6: {
    body:
      "M46.5 6 L53.5 6 L53.5 12 L59 12 L59 18.5 L53.5 18.5 L53.5 25 C56 26 57.5 28 58 30 C62 26 68 24 73 26 C81 29 82 39 77 47 L70 59 C69.5 61 69 63 69 66 L69 72 L31 72 L31 66 C31 63 30.5 61 30 59 L23 47 C18 39 19 29 27 26 C32 24 38 26 42 30 C42.5 28 44 26 46.5 25 L46.5 18.5 L41 18.5 L41 12 L46.5 12 Z " +
      BASE_NEO,
    details: "M50 31 L50 58 M30 59 C43 55 57 55 70 59 M31 66 L69 66",
  },
};

const BASE_CL = "M26 80 L74 80 C76 80 77 81.5 77 83.5 L77 87 L23 87 L23 83.5 C23 81.5 24 80 26 80 Z M30 74 L70 74 L72 80 L28 80 Z";

const CLASSIC: Record<number, Shape> = {
  1: {
    body:
      "M50 22 C56 22 60 26.5 60 32 C60 35.5 58.5 38.5 56 40.5 C58 41.5 59 43 59 44.5 L55 46 C55.5 56 60 64 67 72 L67 74 L33 74 L33 72 C40 64 44.5 56 45 46 L41 44.5 C41 43 42 41.5 44 40.5 C41.5 38.5 40 35.5 40 32 C40 26.5 44 22 50 22 Z " +
      BASE_CL,
  },
  2: {
    body:
      "M64 74 C62 62 66 52 69 44 C73 32 68 20 55 15 L53 10 L48 15 C38 17 31 24 28 32 L21 46 C19.5 50 22 53 26 52 L33 49 C37 48.5 41 48 44 46 C44 54 36 62 35 74 Z " +
      BASE_CL,
    details: "M44 46 C47 43 49 39 50 34",
    extra: (_f, s, d) => (
      <>
        <circle cx="40" cy="27" r="2.6" fill={s} />
        <path d="M56 19 C64 25 66 34 63 44 M60 21 C67 28 69 37 66 47" fill="none" stroke={d} strokeWidth="2" strokeLinecap="round" />
      </>
    ),
  },
  3: {
    body:
      "M50 9 C53 9 55 11 55 13.5 C55 15.5 54 16.5 53 17.5 C61 22 65 30 65 38 C65 45 61 50 56 52 L58 57 L42 57 L44 52 C39 50 35 45 35 38 C35 30 39 22 47 17.5 C46 16.5 45 15.5 45 13.5 C45 11 47 9 50 9 Z M42 57 L58 57 L57 62 C57 66 61 70 66 72 L66 74 L34 74 L34 72 C39 70 43 66 43 62 Z " +
      BASE_CL,
    details: "M54 28 L46 37 M43 62 L57 62",
  },
  4: {
    body:
      "M30 17 L38 17 L38 23 L46 23 L46 17 L54 17 L54 23 L62 23 L62 17 L70 17 L70 31 L64 35 L62 64 L68 72 L68 74 L32 74 L32 72 L38 64 L36 35 L30 31 Z " +
      BASE_CL,
    details: "M30 31 L70 31 M36 35 L64 35 M38 64 L62 64",
  },
  5: {
    body:
      "M50 24 L56 42 L65 27 L66 45 L77 33 L70 60 C68 63 66 66 66 70 L66 74 L34 74 L34 70 C34 66 32 63 30 60 L23 33 L34 45 L35 27 L44 42 Z " +
      BASE_CL,
    details: "M31 60 C44 57 56 57 69 60 M34 68 L66 68",
    extra: (f, s) => (
      <g fill={f} stroke={s} strokeWidth="2.4">
        <circle cx="50" cy="18" r="4.5" />
        <circle cx="35" cy="22" r="4" />
        <circle cx="65" cy="22" r="4" />
        <circle cx="22" cy="29" r="3.6" />
        <circle cx="78" cy="29" r="3.6" />
      </g>
    ),
  },
  6: {
    body:
      "M47.5 7 L52.5 7 L52.5 13 L58 13 L58 18 L52.5 18 L52.5 26 C55 27 56.5 29 57 31 C61 27.5 66 26.5 70 28 C77 31 77.5 40 73 47 L67 59 C66.5 62 66 66 66 70 L66 74 L34 74 L34 70 C34 66 33.5 62 33 59 L27 47 C22.5 40 23 31 30 28 C34 26.5 39 27.5 43 31 C43.5 29 45 27 47.5 26 L47.5 18 L42 18 L42 13 L47.5 13 Z " +
      BASE_CL,
    details: "M50 32 L50 57 M33 59 C44 56 56 56 67 59 M34 68 L66 68",
  },
};

const STYLE = {
  neo: {
    white: { top: "#ffffff", bottom: "#d9d2c3", stroke: "#2b2622", detail: "#7a7166", width: 3.2 },
    black: { top: "#6b645c", bottom: "#24201d", stroke: "#0f0d0b", detail: "#a39a8e", width: 3.2 },
  },
  classic: {
    white: { top: "#fffaf0", bottom: "#e8dcc2", stroke: "#3b3128", detail: "#8c7a63", width: 2.4 },
    black: { top: "#3d3631", bottom: "#141110", stroke: "#000000", detail: "#d9cfbf", width: 2.4 },
  },
};

function PieceSvgImpl({ type, color, set = "neo", className }: { type: number; color: 0 | 1; set?: PieceSet; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const shape = (set === "classic" ? CLASSIC : NEO)[type];
  const st = STYLE[set][color === 0 ? "white" : "black"];
  if (!shape) return null;
  const grad = `pg${uid}`;
  const fill = `url(#${grad})`;
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor={st.top} />
          <stop offset="1" stopColor={st.bottom} />
        </linearGradient>
      </defs>
      {/* soft contact shadow */}
      <ellipse cx="50" cy={set === "neo" ? 89 : 87} rx="27" ry="3.5" fill="rgba(0,0,0,0.22)" />
      <path d={shape.body} fill={fill} stroke={st.stroke} strokeWidth={st.width} strokeLinejoin="round" fillRule="nonzero" />
      {shape.extra?.(fill, st.stroke, st.detail)}
      {shape.details && <path d={shape.details} fill="none" stroke={st.detail} strokeWidth={st.width * 0.75} strokeLinecap="round" strokeLinejoin="round" />}
      {/* top-left sheen */}
      {color === 0 ? null : <path d={shape.body} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" transform="translate(-0.6,-0.6)" />}
    </svg>
  );
}

export const PieceSvg = memo(PieceSvgImpl);
