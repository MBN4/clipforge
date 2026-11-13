"use client";

import { memo, useMemo } from "react";
import type { Layout, PowerKind } from "@/lib/games/snakesladders/board";
import { cellOf, ladderShape, snakeShape, squareCenter, VB } from "@/lib/games/snakesladders/geometry";
import { rcToSquare } from "@/lib/games/snakesladders/board";
import { POWER_INFO, SNAKE_PALETTES } from "./theme";

function PowerGlyph({ kind, r }: { kind: PowerKind; r: number }) {
  const col = POWER_INFO[kind].color;
  return (
    <g>
      <circle r={r} fill="#0b0a09" fillOpacity={0.75} stroke={col} strokeWidth={r * 0.1} />
      <circle r={r * 1.35} fill="none" stroke={col} strokeOpacity={0.25} strokeWidth={r * 0.25} />
      {kind === "bolt" && <path d="M-0.18 -0.62 L0.3 -0.08 L0.02 -0.08 L0.2 0.62 L-0.32 0.0 L-0.04 0.0 Z" transform={`scale(${r})`} fill={col} />}
      {kind === "shield" && (
        <path d="M0 -0.62 L0.5 -0.4 V0.05 C0.5 0.35 0.25 0.55 0 0.66 C-0.25 0.55 -0.5 0.35 -0.5 0.05 V-0.4 Z" transform={`scale(${r})`} fill={col} />
      )}
      {kind === "gift" && (
        <g transform={`scale(${r})`}>
          <rect x={-0.5} y={-0.12} width={1} height={0.66} rx={0.06} fill={col} />
          <rect x={-0.56} y={-0.34} width={1.12} height={0.24} rx={0.06} fill={col} />
          <rect x={-0.07} y={-0.34} width={0.14} height={0.88} fill="#0b0a09" fillOpacity={0.55} />
          <path d="M0 -0.36 C-0.3 -0.7 -0.5 -0.36 -0.1 -0.36 M0 -0.36 C0.3 -0.7 0.5 -0.36 0.1 -0.36" stroke={col} strokeWidth={0.1} fill="none" />
        </g>
      )}
    </g>
  );
}

function Snake({ from, to, size, index }: { from: number; to: number; size: number; index: number }) {
  const sh = useMemo(() => snakeShape(from, to, size, index), [from, to, size, index]);
  const [dark, base, light] = SNAKE_PALETTES[index % SNAKE_PALETTES.length];
  const c = cellOf(size);
  const gid = `snk-${index}`;
  const first = sh.center[0];
  const last = sh.center[sh.center.length - 1];
  const bands: React.ReactNode[] = [];
  for (let i = 4; i < sh.center.length - 2; i += 3) {
    const l = sh.left[i];
    const r = sh.right[i];
    bands.push(<line key={"b" + i} x1={l.x} y1={l.y} x2={r.x} y2={r.y} stroke={dark} strokeOpacity={0.45} strokeWidth={c * 0.028} strokeLinecap="round" />);
    if (i % 6 === 4) bands.push(<circle key={"d" + i} cx={sh.center[i].x} cy={sh.center[i].y} r={sh.widths[i] * 0.34} fill={light} fillOpacity={0.55} />);
  }
  const h = sh.head;
  return (
    <g data-snake={`${from}-${to}`}>
      <defs>
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={first.x} y1={first.y} x2={last.x} y2={last.y}>
          <stop offset="0" stopColor={base} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
      </defs>
      <path d={sh.body} fill="#000" opacity={0.35} transform={`translate(${c * 0.03} ${c * 0.05})`} style={{ filter: "blur(2px)" }} />
      <path d={sh.body} fill={`url(#${gid})`} stroke={dark} strokeWidth={c * 0.02} strokeLinejoin="round" />
      <path d={sh.centerPath} fill="none" stroke={light} strokeOpacity={0.3} strokeWidth={c * 0.05} strokeLinecap="round" />
      {bands}
      <path data-snake-center={`${from}-${to}`} d={sh.centerPath} fill="none" stroke="none" />
      {/* head */}
      <g transform={`translate(${h.x} ${h.y}) rotate(${h.angle})`}>
        {/* tongue */}
        <path d={`M${c * 0.2} 0 L${c * 0.36} 0 M${c * 0.36} 0 L${c * 0.45} ${-c * 0.06} M${c * 0.36} 0 L${c * 0.45} ${c * 0.06}`} stroke="#ff2d55" strokeWidth={c * 0.025} strokeLinecap="round" fill="none" />
        <ellipse cx={0} cy={c * 0.02} rx={c * 0.25} ry={c * 0.19} fill="#000" opacity={0.3} />
        <ellipse cx={0} cy={0} rx={c * 0.25} ry={c * 0.19} fill={base} stroke={dark} strokeWidth={c * 0.025} />
        <ellipse cx={-c * 0.02} cy={-c * 0.06} rx={c * 0.17} ry={c * 0.07} fill={light} fillOpacity={0.35} />
        <circle cx={c * 0.1} cy={-c * 0.095} r={c * 0.065} fill="#fff" />
        <circle cx={c * 0.1} cy={c * 0.095} r={c * 0.065} fill="#fff" />
        <circle cx={c * 0.12} cy={-c * 0.09} r={c * 0.033} fill="#111" />
        <circle cx={c * 0.12} cy={c * 0.09} r={c * 0.033} fill="#111" />
        <path d={`M${c * 0.05} ${-c * 0.17} L${c * 0.16} ${-c * 0.13} M${c * 0.05} ${c * 0.17} L${c * 0.16} ${c * 0.13}`} stroke={dark} strokeWidth={c * 0.022} strokeLinecap="round" />
        <circle cx={c * 0.23} cy={-c * 0.04} r={c * 0.012} fill={dark} />
        <circle cx={c * 0.23} cy={c * 0.04} r={c * 0.012} fill={dark} />
      </g>
      {/* tail tip */}
      <circle cx={last.x} cy={last.y} r={c * 0.035} fill={dark} />
    </g>
  );
}

function Ladder({ from, to, size }: { from: number; to: number; size: number }) {
  const l = useMemo(() => ladderShape(from, to, size), [from, to, size]);
  const c = cellOf(size);
  const rail = (r: [{ x: number; y: number }, { x: number; y: number }], key: string, off = 0, stroke = "url(#wood)", w = l.railWidth, op = 1) => (
    <line key={key} x1={r[0].x + off} y1={r[0].y + off} x2={r[1].x + off} y2={r[1].y + off} stroke={stroke} strokeWidth={w} strokeLinecap="round" opacity={op} />
  );
  return (
    <g data-ladder={`${from}-${to}`}>
      <g style={{ filter: "blur(1.5px)" }}>
        {rail(l.railA, "sa", c * 0.04, "#000", l.railWidth, 0.35)}
        {rail(l.railB, "sb", c * 0.04, "#000", l.railWidth, 0.35)}
      </g>
      {rail(l.railA, "ra", 0, "#6b3f17", l.railWidth * 1.25)}
      {rail(l.railB, "rb", 0, "#6b3f17", l.railWidth * 1.25)}
      {l.rungs.map(([a, b], i) => (
        <g key={i}>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#6b3f17" strokeWidth={l.rungWidth * 1.4} strokeLinecap="round" />
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#d9a35b" strokeWidth={l.rungWidth * 0.8} strokeLinecap="round" />
        </g>
      ))}
      {rail(l.railA, "ga", 0, "#e0a964", l.railWidth * 0.85)}
      {rail(l.railB, "gb", 0, "#e0a964", l.railWidth * 0.85)}
      {rail(l.railA, "hl", 0, "#fff3d6", l.railWidth * 0.22, 0.55)}
      {rail(l.railB, "hl2", 0, "#fff3d6", l.railWidth * 0.22, 0.55)}
    </g>
  );
}

function BoardArtImpl({ layout }: { layout: Layout }) {
  const { size } = layout;
  const c = cellOf(size);
  const last = size * size;
  const tiles: React.ReactNode[] = [];
  const nums: React.ReactNode[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const n = rcToSquare(row, col, size);
      const x = col * c;
      const y = (size - 1 - row) * c;
      const dark = (row + col) % 2 === 0;
      const fill = n === last ? "url(#finishTile)" : n === 1 ? "url(#startTile)" : dark ? "#1c2529" : "#25323a";
      tiles.push(<rect key={n} x={x} y={y} width={c} height={c} fill={fill} />);
      nums.push(
        <text key={n} x={x + c * 0.07} y={y + c * 0.25} fontSize={c * 0.19} fontFamily="ui-monospace, monospace" fontWeight={700} fill="#efe9da" fillOpacity={0.78} stroke="#0b0a09" strokeOpacity={0.7} strokeWidth={c * 0.045} paintOrder="stroke" data-sqnum={n}>
          {n === last ? "FINISH" : n === 1 ? "START" : n}
        </text>
      );
    }
  }
  const fin = squareCenter(last, size);
  const st = squareCenter(1, size);
  return (
    <svg viewBox={`0 0 ${VB} ${VB}`} className="block h-full w-full" role="img" aria-label="Snakes and ladders board" shapeRendering="geometricPrecision">
      <defs>
        <linearGradient id="finishTile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7a5a10" />
          <stop offset="1" stopColor="#caa23a" />
        </linearGradient>
        <linearGradient id="startTile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1f4a2a" />
          <stop offset="1" stopColor="#2f7a43" />
        </linearGradient>
        <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e0a964" />
          <stop offset="1" stopColor="#a86d2c" />
        </linearGradient>
      </defs>
      {tiles}
      {/* subtle grid lines */}
      <g stroke="#000" strokeOpacity={0.35} strokeWidth={1.2}>
        {Array.from({ length: size + 1 }, (_, i) => (
          <g key={i}>
            <line x1={i * c} y1={0} x2={i * c} y2={VB} />
            <line x1={0} y1={i * c} x2={VB} y2={i * c} />
          </g>
        ))}
      </g>
      <g opacity={0.93}>
        {layout.ladders.map((l) => (
          <Ladder key={`l${l.from}`} from={l.from} to={l.to} size={size} />
        ))}
        {layout.snakes.map((s, i) => (
          <Snake key={`s${s.from}`} from={s.from} to={s.to} size={size} index={i} />
        ))}
      </g>
      {layout.powers.map((p) => {
        const ct = squareCenter(p.sq, size);
        return (
          <g key={p.sq} transform={`translate(${ct.x} ${ct.y + c * 0.04})`} data-power={`${p.kind}-${p.sq}`}>
            <PowerGlyph kind={p.kind} r={c * 0.27} />
          </g>
        );
      })}
      {/* trophy + start flag */}
      <g transform={`translate(${fin.x + c * 0.02} ${fin.y + c * 0.1}) scale(${c / 100})`}>
        <path d="M-22 -26 H22 V-6 C22 12 8 20 0 20 C-8 20 -22 12 -22 -6 Z" fill="#ffe27a" stroke="#7a5a10" strokeWidth={3} />
        <path d="M-22 -20 C-38 -20 -36 0 -18 2 M22 -20 C38 -20 36 0 18 2" fill="none" stroke="#ffe27a" strokeWidth={5} />
        <rect x={-4} y={18} width={8} height={12} fill="#c49a2a" />
        <rect x={-16} y={29} width={32} height={8} rx={2} fill="#7a5a10" />
      </g>
      <g transform={`translate(${st.x + c * 0.18} ${st.y + c * 0.22}) scale(${c / 100})`}>
        <line x1={0} y1={14} x2={0} y2={-26} stroke="#efe9da" strokeWidth={4} strokeLinecap="round" />
        <path d="M2 -26 L28 -17 L2 -8 Z" fill="#ff4e1f" />
      </g>
      {nums}
      <rect x={1} y={1} width={VB - 2} height={VB - 2} fill="none" stroke="#fff" strokeOpacity={0.12} strokeWidth={2} />
    </svg>
  );
}

export const BoardArt = memo(BoardArtImpl);
