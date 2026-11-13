"use client";

// Player bars (avatar, name, rating, captured pieces, clock), the move list and the evaluation bar.
import { useEffect, useRef } from "react";
import type { PlayedMove } from "@/lib/games/chess/game";
import { PieceSvg, type PieceSet } from "./pieces";

export function formatClock(ms: number): string {
  if (!isFinite(ms)) return "∞";
  const t = Math.max(0, ms);
  if (t < 10_000) {
    const s = Math.floor(t / 1000);
    const tenths = Math.floor((t % 1000) / 100);
    return `0:0${s}.${tenths}`;
  }
  const total = Math.ceil(t / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export function PlayerBar({
  name,
  sub,
  avatar,
  color,
  captured,
  advantage,
  clockMs,
  clockActive,
  showClock,
  thinking,
  pieceSet,
  checks,
}: {
  name: string;
  sub?: string;
  avatar: string;
  /** colour this player plays */
  color: 0 | 1;
  /** opponent piece types this player captured */
  captured: number[];
  advantage: number;
  clockMs: number;
  clockActive: boolean;
  showClock: boolean;
  thinking?: boolean;
  pieceSet: PieceSet;
  /** three-check: checks given */
  checks?: number;
}) {
  const low = showClock && clockMs < 10_000;
  const groups: number[][] = [];
  for (const t of captured) {
    const g = groups.find((x) => x[0] === t);
    if (g) g.push(t);
    else groups.push([t]);
  }
  return (
    <div className="flex items-center gap-2.5 py-1.5" data-player={color === 0 ? "white" : "black"}>
      <div
        className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-md text-xl ${color === 0 ? "bg-[#e9e4da]" : "bg-[#3b3632]"} ring-1 ring-white/10`}
        aria-hidden
      >
        {avatar}
        {thinking && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-moss" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="truncate text-sm font-semibold text-paper">{name}</span>
          {sub && <span className="shrink-0 text-xs text-paper-dim">{sub}</span>}
          {checks !== undefined && (
            <span className="ml-1 flex gap-0.5" title={`${checks} of 3 checks`}>
              {[0, 1, 2].map((i) => (
                <span key={i} className={`h-2 w-2 rounded-full ${i < checks ? "bg-red-400" : "bg-white/15"}`} />
              ))}
            </span>
          )}
        </div>
        <div className="flex h-4 items-center">
          {groups.map((g, gi) => (
            <span key={gi} className="mr-1 flex">
              {g.map((t, i) => (
                <span key={i} className={`block h-4 w-4 ${i ? "-ml-2.5" : ""}`}>
                  <PieceSvg type={t} color={(color ^ 1) as 0 | 1} set={pieceSet} className="h-full w-full" />
                </span>
              ))}
            </span>
          ))}
          {advantage > 0 && <span className="text-[11px] font-semibold text-paper-dim">+{advantage}</span>}
        </div>
      </div>
      {showClock && (
        <div
          className={`rounded-md px-2.5 py-1 font-mono text-lg font-semibold tabular-nums transition-colors ${
            clockActive
              ? low
                ? "bg-red-500 text-white"
                : color === 0
                  ? "bg-[#f3f1ec] text-[#2b2925]"
                  : "bg-[#2f2b27] text-white"
              : low
                ? "bg-red-500/20 text-red-200"
                : "bg-white/[0.06] text-paper-dim"
          }`}
          data-clock={color === 0 ? "white" : "black"}
        >
          {formatClock(clockMs)}
        </div>
      )}
    </div>
  );
}

export function MoveList({ moves, current, onSelect }: { moves: PlayedMove[]; current: number; onSelect: (ply: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>(`[data-ply="${current}"]`);
    if (el && box.current) {
      const b = box.current;
      const top = el.offsetTop - b.offsetTop;
      if (top < b.scrollTop || top > b.scrollTop + b.clientHeight - el.offsetHeight) b.scrollTop = top - b.clientHeight / 2;
    } else if (box.current && current === moves.length) box.current.scrollTop = box.current.scrollHeight;
  }, [current, moves.length]);
  const rows: { n: number; w?: PlayedMove; b?: PlayedMove; wPly: number }[] = [];
  const startBlack = moves[0]?.color === 1;
  for (let i = 0; i < moves.length; ) {
    if (i === 0 && startBlack) {
      rows.push({ n: 1, b: moves[0], wPly: 0 });
      i = 1;
      continue;
    }
    rows.push({ n: rows.length + 1, w: moves[i], b: moves[i + 1], wPly: i + 1 });
    i += 2;
  }
  return (
    <div ref={box} className="relative max-h-48 min-h-24 overflow-y-auto rounded-lg bg-black/25 text-[13px] @2xl:max-h-none @2xl:flex-1" data-movelist>
      {rows.length === 0 && <p className="p-3 text-center font-sans text-xs text-paper-dim">Moves will appear here</p>}
      {rows.map((r, i) => (
        <div key={i} className={`grid grid-cols-[2.6rem_1fr_1fr] items-center px-1 ${i % 2 ? "bg-white/[0.025]" : ""}`}>
          <span className="pl-2 font-mono text-paper-dim/70">{r.n}.</span>
          {(["w", "b"] as const).map((side) => {
            const m = r[side];
            const ply = side === "w" ? r.wPly : startBlack && i === 0 ? 1 : r.wPly + 1;
            if (!m) return <span key={side} />;
            return (
              <button
                key={side}
                type="button"
                data-ply={ply}
                onClick={() => onSelect(ply)}
                className={`my-0.5 mr-1 truncate rounded px-1.5 py-0.5 text-left font-semibold transition ${
                  ply === current ? "bg-white/20 text-paper" : "text-paper/85 hover:bg-white/10"
                }`}
              >
                {m.san}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Vertical eval bar. `whiteScore` in cp from white's POV, mate in moves (+ = white mates). */
export function EvalBar({ whiteScore, mate, orientation, final }: { whiteScore: number; mate: number | null; orientation: 0 | 1; final?: string }) {
  const share = mate !== null ? (mate > 0 ? 1 : mate < 0 ? 0 : whiteScore >= 0 ? 1 : 0) : 1 / (1 + Math.pow(10, -whiteScore / 400));
  const pct = Math.min(0.97, Math.max(0.03, share)) * 100;
  const label = final ?? (mate !== null ? `M${Math.abs(mate)}` : (Math.abs(whiteScore) / 100).toFixed(1));
  const whiteAhead = mate !== null ? mate > 0 : whiteScore >= 0;
  const whiteAtBottom = orientation === 0;
  return (
    <div className="relative w-3.5 shrink-0 overflow-hidden rounded-[3px] bg-[#403d39] @lg:w-5" title={`Evaluation ${whiteAhead ? "+" : "−"}${label}`} data-evalbar>
      <div
        className="absolute inset-x-0 bg-[#f1efe9] transition-[height] duration-700 ease-out"
        style={{ height: `${pct}%`, [whiteAtBottom ? "bottom" : "top"]: 0 }}
      />
      <span
        className={`absolute inset-x-0 hidden text-center text-[8px] font-bold @lg:block ${whiteAhead ? "text-[#403d39]" : "text-[#f1efe9]"}`}
        style={{ [whiteAhead === whiteAtBottom ? "bottom" : "top"]: 3 }}
      >
        {label}
      </span>
    </div>
  );
}
