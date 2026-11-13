"use client";

import { useSyncExternalStore } from "react";
import type { Pt } from "@/lib/games/snakesladders/geometry";
import { cellOf, VB } from "@/lib/games/snakesladders/geometry";
import { PLAYER_COLORS } from "./theme";

export interface TokenPose {
  x: number;
  y: number;
  /** lift above the board in svg units (hop arc) */
  h: number;
  /** extra scale (multi-token squares are smaller) */
  s: number;
}

/** Offsets (in cells) for n tokens sharing a square. */
export function slotOffset(slot: number, count: number): { dx: number; dy: number; s: number } {
  if (count <= 1) return { dx: 0, dy: 0, s: 1 };
  if (count === 2) return { dx: slot === 0 ? -0.2 : 0.2, dy: 0, s: 0.8 };
  if (count === 3) return [{ dx: -0.22, dy: 0.05, s: 0.72 }, { dx: 0.22, dy: 0.05, s: 0.72 }, { dx: 0, dy: -0.16, s: 0.72 }][slot];
  return [{ dx: -0.22, dy: -0.12, s: 0.68 }, { dx: 0.22, dy: -0.12, s: 0.68 }, { dx: -0.22, dy: 0.18, s: 0.68 }, { dx: 0.22, dy: 0.18, s: 0.68 }][slot];
}

export function restPose(center: Pt, slot: number, count: number, size: number): TokenPose {
  const o = slotOffset(slot, count);
  const c = cellOf(size);
  return { x: center.x + o.dx * c, y: center.y + o.dy * c, h: 0, s: o.s };
}

export function Tokens({ store, colors, size, active, names }: { store: { get: () => TokenPose[]; subscribe: (cb: () => void) => () => void }; colors: number[]; size: number; active: number; names: string[] }) {
  const poses = useSyncExternalStore(store.subscribe, store.get, store.get);
  const c = cellOf(size);
  const order = poses.map((_, i) => i).sort((a, b) => poses[a].y - poses[b].y);
  return (
    <svg viewBox={`0 0 ${VB} ${VB}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        {PLAYER_COLORS.map((p) => (
          <radialGradient key={p.id} id={`pawn-${p.id}`} cx="0.35" cy="0.3" r="0.85">
            <stop offset="0" stopColor={p.light} />
            <stop offset="0.45" stopColor={p.main} />
            <stop offset="1" stopColor={p.dark} />
          </radialGradient>
        ))}
      </defs>
      {order.map((i) => {
        const p = poses[i];
        const col = PLAYER_COLORS[colors[i]];
        const k = (c / 100) * p.s * 1.05;
        const baseY = p.y + c * 0.3 * p.s;
        return (
          <g key={i} data-token={i} data-x={p.x.toFixed(1)} data-y={p.y.toFixed(1)} data-h={p.h.toFixed(1)}>
            <ellipse cx={p.x + c * 0.03} cy={baseY + c * 0.02} rx={c * 0.2 * p.s * (1 - Math.min(0.4, p.h / (c * 1.5)))} ry={c * 0.07 * p.s} fill="#000" opacity={0.4 - Math.min(0.2, p.h / (c * 4))} />
            <g transform={`translate(${p.x} ${baseY - p.h}) scale(${k})`}>
              {i === active && <ellipse cx={0} cy={-4} rx={30} ry={11} fill="none" stroke={col.main} strokeWidth={3} opacity={0.9} />}
              <path d="M-22 -4 Q-22 -34 -9 -46 L9 -46 Q22 -34 22 -4 Q0 6 -22 -4 Z" fill={`url(#pawn-${col.id})`} stroke={col.dark} strokeWidth={2} />
              <ellipse cx={0} cy={-46} rx={14} ry={4.5} fill={col.dark} opacity={0.6} />
              <circle cx={0} cy={-60} r={15} fill={`url(#pawn-${col.id})`} stroke={col.dark} strokeWidth={2} />
              <ellipse cx={-5} cy={-65} rx={5.5} ry={3.5} fill="#fff" opacity={0.7} transform="rotate(-30 -5 -65)" />
              <path d="M-14 -22 Q-10 -36 -4 -42" stroke="#fff" strokeOpacity={0.35} strokeWidth={4} fill="none" strokeLinecap="round" />
              <title>{names[i]}</title>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
