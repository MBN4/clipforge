"use client";

import { memo, useMemo } from "react";
import { COLORS, HOME, YARD, STAR_ABS, startIndex, TRACK, YARD_ORIGIN, homeColCell, pointOf, type Color } from "@/lib/games/ludo/board";
import type { PlayerCfg } from "@/lib/games/ludo/engine";
import { SWATCH } from "./theme";

export interface Burst {
  key: number;
  x: number;
  y: number;
  color: Color;
  kind: "capture" | "home";
}

interface Props {
  players: PlayerCfg[];
  tokens: number[][];
  /** player whose turn it is (yard glows) */
  activePi: number | null;
  /** "pi-t" ids that can be clicked */
  movable: ReadonlySet<string>;
  onPick: (pi: number, t: number) => void;
  /** token that is currently hopping + a counter that restarts its hop each step */
  hop: { id: string; n: number } | null;
  flying: ReadonlySet<string>;
  bursts: Burst[];
  reduced: boolean;
}

const OFFSETS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [
    [-0.17, 0.02],
    [0.17, -0.02],
  ],
  3: [
    [-0.18, 0.1],
    [0.18, 0.1],
    [0, -0.16],
  ],
  4: [
    [-0.18, -0.12],
    [0.18, -0.12],
    [-0.18, 0.15],
    [0.18, 0.15],
  ],
};
const SCALE: Record<number, number> = { 1: 1, 2: 0.8, 3: 0.7, 4: 0.64 };

function starPath(cx: number, cy: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(3)},${(cy + Math.sin(a) * rr).toFixed(3)}`);
  }
  return `M${pts.join("L")}Z`;
}

const CENTRE: Record<Color, string> = {
  0: "M6,6 L6,9 L7.5,7.5 Z",
  1: "M6,6 L9,6 L7.5,7.5 Z",
  2: "M9,6 L9,9 L7.5,7.5 Z",
  3: "M6,9 L9,9 L7.5,7.5 Z",
};

/** Static board art: memoised so token animation never re-renders 200 SVG nodes. */
const BoardArt = memo(function BoardArt({ active, activePi, slots }: { active: Color[]; activePi: Color | null; slots: Record<number, number[]> }) {
  const safeStar = new Set(STAR_ABS);
  return (
    <g>
      <rect x={-0.28} y={-0.28} width={15.56} height={15.56} rx={1.1} fill="url(#ludo-frame)" />
      <rect x={0} y={0} width={15} height={15} rx={0.55} fill="#17130f" />
      {COLORS.map((c) => {
        const [ox, oy] = YARD_ORIGIN[c];
        const sw = SWATCH[c];
        const on = active.includes(c);
        return (
          <g key={c} opacity={on ? 1 : 0.38}>
            <rect x={ox + 0.06} y={oy + 0.06} width={5.88} height={5.88} rx={0.7} fill={`url(#ludo-yard-${c})`} />
            <rect x={ox + 1} y={oy + 1} width={4} height={4} rx={0.6} fill={sw.tint} opacity={0.96} />
            <rect x={ox + 1} y={oy + 1} width={4} height={4} rx={0.6} fill="none" stroke={sw.dark} strokeOpacity={0.35} strokeWidth={0.05} />
            {slots[c].map((s) => {
              const sx = ox + (s % 2 === 0 ? 2 : 4);
              const sy = oy + (s < 2 ? 2 : 4);
              return (
                <g key={s}>
                  <circle cx={sx} cy={sy} r={0.55} fill={sw.base} opacity={0.28} />
                  <circle cx={sx} cy={sy} r={0.55} fill="none" stroke={sw.base} strokeWidth={0.07} opacity={0.75} />
                  <circle cx={sx} cy={sy} r={0.36} fill="#000" opacity={0.08} />
                </g>
              );
            })}
            {activePi === c && (
              <rect className="ludo-glow" x={ox + 0.06} y={oy + 0.06} width={5.88} height={5.88} rx={0.7} fill="none" stroke="#fff" strokeWidth={0.18} style={{ color: sw.light }} />
            )}
          </g>
        );
      })}
      {/* home columns + start squares sit under the track */}
      {COLORS.map((c) =>
        [0, 1, 2, 3, 4].map((k) => {
          const [x, y] = homeColCell(c, k);
          return <rect key={`${c}-${k}`} x={x + 0.04} y={y + 0.04} width={0.92} height={0.92} rx={0.1} fill={SWATCH[c].base} opacity={0.88 - k * 0.04} />;
        })
      )}
      {TRACK.map(([x, y], i) => {
        const startOf = COLORS.find((c) => startIndex(c) === i);
        const isStar = safeStar.has(i);
        return (
          <g key={i}>
            <rect x={x + 0.04} y={y + 0.04} width={0.92} height={0.92} rx={0.1} fill={startOf !== undefined ? SWATCH[startOf].base : "#f1eadb"} />
            {startOf !== undefined && <path d={starPath(x + 0.5, y + 0.5, 0.3)} fill="#fff" opacity={0.92} />}
            {isStar && <path d={starPath(x + 0.5, y + 0.5, 0.3)} fill="#b9ad92" />}
          </g>
        );
      })}
      {/* centre */}
      <rect x={6} y={6} width={3} height={3} fill="#17130f" />
      {COLORS.map((c) => (
        <path key={c} d={CENTRE[c]} fill={`url(#ludo-tri-${c})`} stroke="#17130f" strokeWidth={0.06} strokeLinejoin="round" />
      ))}
      <circle cx={7.5} cy={7.5} r={0.2} fill="#f1eadb" opacity={0.9} />
    </g>
  );
});

function Pawn({ c }: { c: Color }) {
  return (
    <g>
      <ellipse cx={0.03} cy={0.3} rx={0.33} ry={0.1} fill="#000" opacity={0.4} filter="url(#ludo-blur)" />
      <ellipse cx={0} cy={0.24} rx={0.34} ry={0.14} fill={`url(#ludo-pawn-base-${c})`} stroke={SWATCH[c].dark} strokeWidth={0.025} />
      <path d="M-0.23,0.22 C-0.22,0.02 -0.1,-0.04 -0.1,-0.13 L0.1,-0.13 C0.1,-0.04 0.22,0.02 0.23,0.22 Z" fill={`url(#ludo-pawn-${c})`} stroke={SWATCH[c].dark} strokeWidth={0.025} strokeLinejoin="round" />
      <circle cx={0} cy={-0.2} r={0.2} fill={`url(#ludo-pawn-${c})`} stroke={SWATCH[c].dark} strokeWidth={0.025} />
      <ellipse cx={-0.07} cy={-0.28} rx={0.075} ry={0.045} fill="#fff" opacity={0.7} transform="rotate(-25 -0.07 -0.28)" />
    </g>
  );
}

export function LudoBoard({ players, tokens, activePi, movable, onPick, hop, flying, bursts, reduced }: Props) {
  const ntok = tokens[0]?.length ?? 4;
  const active = useMemo(() => players.map((p) => p.color), [players]);
  const slots = useMemo(() => {
    const m: Record<number, number[]> = {};
    for (const c of COLORS) m[c] = ntok === 2 ? [0, 3] : [0, 1, 2, 3];
    return m;
  }, [ntok]);

  // draw positions with stack offsets
  const placed = useMemo(() => {
    const items: { pi: number; t: number; c: Color; x: number; y: number; s: number; id: string }[] = [];
    const groups = new Map<string, number[]>();
    players.forEach((pl, pi) => {
      tokens[pi].forEach((pos, t) => {
        const slot = pos === YARD ? (ntok === 2 ? [0, 3][t] : t) : ntok === 2 ? [1, 2][t] : t;
        const [x, y] = pointOf(pl.color, pos, slot);
        const idx = items.length;
        items.push({ pi, t, c: pl.color, x, y, s: 1, id: `${pi}-${t}` });
        if (pos >= 0 && pos < HOME) {
          const k = `${x.toFixed(2)},${y.toFixed(2)}`;
          groups.set(k, [...(groups.get(k) ?? []), idx]);
        }
      });
    });
    for (const idxs of groups.values()) {
      const n = idxs.length;
      if (n === 1) continue;
      const offs = OFFSETS[Math.min(n, 4)];
      idxs.forEach((ix, j) => {
        const o = offs[j % 4] ?? [0, 0];
        const extra = j >= 4 ? 0.06 * (j - 3) : 0;
        items[ix].x += o[0] + extra;
        items[ix].y += o[1] - extra;
        items[ix].s = SCALE[Math.min(n, 4)];
      });
    }
    return items;
  }, [players, tokens, ntok]);

  const orderedPlayers = players.map((_, i) => i).sort((a, b) => (a === activePi ? 1 : 0) - (b === activePi ? 1 : 0));

  return (
    <svg viewBox="-0.3 -0.3 15.6 15.6" className="block h-full w-full select-none" role="group" aria-label="Ludo board" shapeRendering="geometricPrecision">
      <defs>
        <linearGradient id="ludo-frame" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a241d" />
          <stop offset="1" stopColor="#0f0c09" />
        </linearGradient>
        <filter id="ludo-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.06" />
        </filter>
        {COLORS.map((c) => {
          const s = SWATCH[c];
          return (
            <g key={c}>
              <radialGradient id={`ludo-pawn-${c}`} cx="0.35" cy="0.3" r="0.9">
                <stop offset="0" stopColor={s.light} />
                <stop offset="0.45" stopColor={s.base} />
                <stop offset="1" stopColor={s.dark} />
              </radialGradient>
              <linearGradient id={`ludo-pawn-base-${c}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={s.base} />
                <stop offset="1" stopColor={s.dark} />
              </linearGradient>
              <linearGradient id={`ludo-yard-${c}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={s.base} />
                <stop offset="1" stopColor={s.dark} />
              </linearGradient>
              <linearGradient id={`ludo-tri-${c}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={s.light} />
                <stop offset="1" stopColor={s.base} />
              </linearGradient>
            </g>
          );
        })}
      </defs>
      <BoardArt active={active} activePi={activePi === null ? null : players[activePi].color} slots={slots} />

      {bursts.map((b) => (
        <g key={b.key} transform={`translate(${b.x} ${b.y})`} pointerEvents="none">
          <circle className="ludo-burst" r={0.3} fill="none" stroke={b.kind === "capture" ? "#fff" : SWATCH[b.color].light} strokeWidth={0.12} />
          {!reduced &&
            Array.from({ length: b.kind === "home" ? 10 : 6 }, (_, i) => {
              const a = (i / (b.kind === "home" ? 10 : 6)) * Math.PI * 2;
              return (
                <circle
                  key={i}
                  className="ludo-spark"
                  r={0.07}
                  fill={i % 2 ? "#fff" : SWATCH[b.color].light}
                  style={{ ["--dx" as string]: `${Math.cos(a) * 0.9}px`, ["--dy" as string]: `${Math.sin(a) * 0.9}px` }}
                />
              );
            })}
        </g>
      ))}

      {orderedPlayers.map((pi) => (
        <g key={pi}>
          {placed
            .filter((p) => p.pi === pi)
            .map((p) => {
              const can = movable.has(p.id);
              const fly = flying.has(p.id);
              return (
                <g
                  key={p.id}
                  className={fly ? "ludo-tok ludo-tok-fly" : "ludo-tok"}
                  style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
                  data-token={p.id}
                >
                  <g key={hop && hop.id === p.id ? hop.n : 0} className={hop && hop.id === p.id ? "ludo-hop" : fly ? "ludo-flyarc" : ""}>
                    {can && <circle className="ludo-ring" r={0.5} fill="none" stroke="#fff" strokeWidth={0.07} />}
                    <g className={can && !reduced ? "ludo-bob" : ""}>
                      <g transform={`scale(${p.s})`}>
                        <Pawn c={p.c} />
                      </g>
                    </g>
                  </g>
                </g>
              );
            })}
        </g>
      ))}

      {/* hit areas on their own top layer so overlapping tokens never swallow clicks */}
      {placed
        .filter((p) => movable.has(p.id))
        .map((p) => (
          <circle
            key={p.id}
            data-movable={p.id}
            cx={p.x}
            cy={p.y}
            r={0.5}
            fill="transparent"
            style={{ cursor: "pointer", outline: "none" }}
            role="button"
            tabIndex={0}
            aria-label={`Move ${["red", "green", "yellow", "blue"][p.c]} token ${p.t + 1}`}
            onClick={() => onPick(p.pi, p.t)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onPick(p.pi, p.t);
              }
            }}
          />
        ))}
    </svg>
  );
}

