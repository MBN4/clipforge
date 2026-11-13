"use client";

// The chessboard: SVG squares + coordinates + highlights, sliding pieces, drag & drop and click-click moves,
// legal-move dots / capture rings, check glow, right-click marks and arrows, and the promotion picker.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { unlockAudio } from "@/lib/games/audio";
import { PieceSvg, type PieceSet } from "./pieces";
import { THEMES, type BoardTheme } from "./themes";
import { PieceTracker } from "./tracker";

export interface Target {
  to: number; // sq64 the user clicks / drops on
  moves: number[]; // engine moves (several = promotion choices)
  promos: number[]; // promotion piece type per move (0 = none)
}

export interface BoardProps {
  /** piece code per square (a1 = 0 … h8 = 63) */
  board: number[];
  /** identity key of the displayed position (changes → animate) */
  posKey: string;
  orientation: 0 | 1;
  lastMove: { from: number; to: number } | null;
  checkSq: number | null;
  /** from-square → legal targets; null when the user can't move right now */
  targets: Map<number, Target[]> | null;
  onMove: (move: number) => void;
  onIllegal?: () => void;
  theme: BoardTheme;
  pieceSet: PieceSet;
  showLegal: boolean;
  showCoords: boolean;
  autoQueen: boolean;
  /** colour whose pieces the user may pick up (for showing selection on own pieces only) */
  hintSquares?: { sq: number; color: string }[];
}

type Arrow = { from: number; to: number; color: string };
const ARROW_COLORS = { green: "rgba(21,120,27,0.8)", red: "rgba(214,48,49,0.82)", blue: "rgba(42,109,214,0.82)", yellow: "rgba(230,170,20,0.85)" };

const sqCol = (sq: number, o: 0 | 1) => (o === 0 ? sq & 7 : 7 - (sq & 7));
const sqRow = (sq: number, o: 0 | 1) => (o === 0 ? 7 - (sq >> 3) : sq >> 3);
const xform = (sq: number, o: 0 | 1) => `translate(${sqCol(sq, o) * 100}%, ${sqRow(sq, o) * 100}%)`;

export function Board(p: BoardProps) {
  const { board, posKey, orientation: o, targets, onMove } = p;
  const theme = THEMES[p.theme];
  const [tracker] = useState(() => new PieceTracker());
  const layout = useMemo(() => tracker.update(board, posKey, p.lastMove), [tracker, board, posKey, p.lastMove]);
  const boxRef = useRef<HTMLDivElement>(null);
  const pieceEls = useRef(new Map<number, HTMLDivElement>());
  const [selected, setSelected] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [marks, setMarks] = useState<number[]>([]);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [promo, setPromo] = useState<{ from: number; to: number; target: Target } | null>(null);
  const drag = useRef<{ from: number; id: number; wasSelected: boolean; pointerId: number } | null>(null);
  const right = useRef<number | null>(null);

  // a new position clears transient UI (selection, arrows, picker) — the "adjust state on prop change" pattern
  const [seenKey, setSeenKey] = useState(posKey);
  if (seenKey !== posKey) {
    setSeenKey(posKey);
    setSelected(null);
    setPromo(null);
    setArrows([]);
    setMarks([]);
  }
  const [seenTargets, setSeenTargets] = useState(targets);
  if (seenTargets !== targets) {
    setSeenTargets(targets);
    if (!targets) {
      setSelected(null);
      setPromo(null);
    }
  }

  const sqAt = useCallback(
    (clientX: number, clientY: number): number | null => {
      const r = boxRef.current?.getBoundingClientRect();
      if (!r) return null;
      const col = Math.floor(((clientX - r.left) / r.width) * 8);
      const row = Math.floor(((clientY - r.top) / r.height) * 8);
      if (col < 0 || col > 7 || row < 0 || row > 7) return null;
      const file = o === 0 ? col : 7 - col;
      const rank = o === 0 ? 7 - row : row;
      return rank * 8 + file;
    },
    [o]
  );

  const pieceAt = (sq: number) => layout.pieces.find((q) => q.sq === sq);

  const tryMove = (from: number, to: number): boolean => {
    const t = targets?.get(from)?.find((x) => x.to === to);
    if (!t) return false;
    if (t.moves.length > 1) {
      if (p.autoQueen) {
        const qi = t.promos.indexOf(5);
        onMove(t.moves[qi >= 0 ? qi : 0]);
      } else setPromo({ from, to, target: t });
    } else onMove(t.moves[0]);
    setSelected(null);
    return true;
  };

  const placeEl = (id: number, sq: number, instant: boolean) => {
    const el = pieceEls.current.get(id);
    if (!el) return;
    if (instant) el.style.transition = "none";
    el.style.transform = xform(sq, o);
    el.style.zIndex = "";
    if (instant) {
      void el.offsetWidth; // commit the jump before transitions come back
      el.style.transition = "";
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    unlockAudio();
    const sq = sqAt(e.clientX, e.clientY);
    if (e.button === 2) {
      right.current = sq;
      return;
    }
    if (e.button !== 0) return;
    setArrows([]);
    setMarks([]);
    if (sq === null) return;
    if (promo) {
      setPromo(null);
      return;
    }
    if (selected !== null && selected !== sq && tryMove(selected, sq)) return;
    const piece = pieceAt(sq);
    if (piece && targets?.has(sq)) {
      e.preventDefault();
      setSelected(sq);
      drag.current = { from: sq, id: piece.id, wasSelected: selected === sq, pointerId: e.pointerId };
      boxRef.current?.setPointerCapture(e.pointerId);
      followPointer(e.clientX, e.clientY);
      setDragFrom(sq);
      setHover(sq);
    } else {
      if (selected !== null && piece) p.onIllegal?.();
      setSelected(null);
    }
  };

  const followPointer = (x: number, y: number) => {
    const d = drag.current;
    const r = boxRef.current?.getBoundingClientRect();
    if (!d || !r) return;
    const el = pieceEls.current.get(d.id);
    if (!el) return;
    const size = r.width / 8;
    el.style.transition = "none";
    el.style.zIndex = "40";
    el.style.transform = `translate(${x - r.left - size / 2}px, ${y - r.top - size / 2}px)`;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    followPointer(e.clientX, e.clientY);
    const sq = sqAt(e.clientX, e.clientY);
    if (sq !== hover) setHover(sq);
  };

  const endDrag = (e: React.PointerEvent, cancelled = false) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragFrom(null);
    setHover(null);
    try {
      boxRef.current?.releasePointerCapture(d.pointerId);
    } catch {}
    const to = cancelled ? null : sqAt(e.clientX, e.clientY);
    if (to === d.from || to === null) {
      // dropped back (or off-board): return home; a plain click on the selected piece deselects it
      const el = pieceEls.current.get(d.id);
      if (el) {
        el.style.transition = "";
        el.style.zIndex = "";
        el.style.transform = xform(d.from, o);
      }
      if (to === d.from && d.wasSelected) setSelected(null);
      return;
    }
    const t = targets?.get(d.from)?.find((x) => x.to === to);
    if (t) {
      placeEl(d.id, to, true);
      tryMove(d.from, to);
    } else {
      const el = pieceEls.current.get(d.id);
      if (el) {
        el.style.transition = "";
        el.style.zIndex = "";
        el.style.transform = xform(d.from, o);
      }
      p.onIllegal?.();
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (e.button === 2) {
      const from = right.current;
      right.current = null;
      const to = sqAt(e.clientX, e.clientY);
      if (from === null || to === null) return;
      if (from === to) {
        setMarks((m) => (m.includes(to) ? m.filter((x) => x !== to) : [...m, to]));
      } else {
        const color = e.shiftKey ? ARROW_COLORS.red : e.altKey ? ARROW_COLORS.blue : e.ctrlKey || e.metaKey ? ARROW_COLORS.yellow : ARROW_COLORS.green;
        setArrows((a) => {
          const exists = a.find((x) => x.from === from && x.to === to);
          return exists ? a.filter((x) => x !== exists) : [...a, { from, to, color }];
        });
      }
      return;
    }
    endDrag(e);
  };

  // when the orientation flips mid-drag, or the element set changes, snap everything to its square
  useEffect(() => {
    drag.current = null;
  }, [o, posKey]);

  const squares = useMemo(
    () =>
      Array.from({ length: 64 }, (_, sq) => {
        const light = ((sq & 7) + (sq >> 3)) % 2 === 1;
        return <rect key={sq} x={sqCol(sq, o)} y={sqRow(sq, o)} width="1" height="1" fill={light ? theme.light : theme.dark} />;
      }),
    [o, theme]
  );
  const selTargets = selected !== null ? targets?.get(selected) ?? [] : [];
  const occupied = new Set(layout.pieces.map((q) => q.sq));
  const promoColor = promo ? (pieceAt(promo.from)?.code ?? 0) >> 3 : 0;

  return (
    <div
      ref={boxRef}
      className="relative aspect-square w-full touch-none select-none overflow-hidden rounded-[6px] shadow-[0_18px_50px_-18px_rgba(0,0,0,0.85)]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={(e) => endDrag(e, true)}
      onContextMenu={(e) => e.preventDefault()}
      data-chessboard
    >
      {/* squares, highlights, coordinates */}
      <svg viewBox="0 0 8 8" className="absolute inset-0 h-full w-full" shapeRendering="crispEdges" aria-hidden>
        {squares}
        {[p.lastMove?.from, p.lastMove?.to, selected].map((sq, i) =>
          sq === undefined || sq === null ? null : (
            <rect key={"h" + i} x={sqCol(sq, o)} y={sqRow(sq, o)} width="1" height="1" fill={((sq & 7) + (sq >> 3)) % 2 ? theme.hlLight : theme.hlDark} opacity="0.62" />
          )
        )}
        {marks.map((sq) => (
          <rect key={"m" + sq} x={sqCol(sq, o)} y={sqRow(sq, o)} width="1" height="1" fill="#eb6150" opacity="0.8" />
        ))}
      </svg>
      <svg viewBox="0 0 800 800" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <radialGradient id="chk">
            <stop offset="0" stopColor="#ff0000" stopOpacity="1" />
            <stop offset="0.25" stopColor="#e70000" stopOpacity="1" />
            <stop offset="0.9" stopColor="#a90000" stopOpacity="0" />
          </radialGradient>
        </defs>
        {p.checkSq !== null && <rect x={sqCol(p.checkSq, o) * 100} y={sqRow(p.checkSq, o) * 100} width="100" height="100" fill="url(#chk)" />}
        {dragFrom !== null && hover !== null && (
          <rect x={sqCol(hover, o) * 100 + 3} y={sqRow(hover, o) * 100 + 3} width="94" height="94" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="6" />
        )}
        {p.showLegal &&
          selTargets.map((t) =>
            occupied.has(t.to) ? (
              <circle key={t.to} cx={sqCol(t.to, o) * 100 + 50} cy={sqRow(t.to, o) * 100 + 50} r="44" fill="none" stroke="rgba(0,0,0,0.16)" strokeWidth="9" />
            ) : (
              <circle key={t.to} cx={sqCol(t.to, o) * 100 + 50} cy={sqRow(t.to, o) * 100 + 50} r="16" fill="rgba(0,0,0,0.16)" />
            )
          )}
        {p.showCoords &&
          Array.from({ length: 8 }, (_, i) => {
            // rank numbers in the left column (top-left), file letters on the bottom row (bottom-right)
            const rankLight = ((o === 0 ? 0 : 7) + (o === 0 ? 7 - i : i)) % 2 === 1;
            const fileLight = ((o === 0 ? i : 7 - i) + (o === 0 ? 0 : 7)) % 2 === 1;
            return (
              <g key={i} fontFamily="ui-sans-serif, system-ui, sans-serif" fontWeight="700" fontSize="21">
                <text x={5} y={i * 100 + 22} fill={rankLight ? theme.dark : theme.light}>
                  {o === 0 ? 8 - i : i + 1}
                </text>
                <text x={i * 100 + 94} y={795} textAnchor="end" fill={fileLight ? theme.dark : theme.light}>
                  {"abcdefgh"[o === 0 ? i : 7 - i]}
                </text>
              </g>
            );
          })}
      </svg>

      {/* pieces */}
      <div className="absolute inset-0">
        {[...layout.pieces.map((q) => ({ ...q, ghost: false })), ...layout.ghosts.map((q) => ({ ...q, ghost: true }))]
          .sort((a, b) => a.id - b.id)
          .map((q) => (
            <div
              key={q.id}
              ref={(el) => {
                if (el) pieceEls.current.set(q.id, el);
                else pieceEls.current.delete(q.id);
              }}
              className={`chess-piece absolute left-0 top-0 h-[12.5%] w-[12.5%] will-change-transform ${q.ghost ? "chess-ghost pointer-events-none" : ""} ${
                targets?.has(q.sq) && !q.ghost ? "cursor-grab active:cursor-grabbing" : ""
              }`}
              style={{ transform: xform(q.sq, o) }}
              data-piece={q.code}
              data-sq={q.sq}
            >
              <PieceSvg type={q.code & 7} color={(q.code >> 3) as 0 | 1} set={p.pieceSet} className="h-full w-full" />
            </div>
          ))}
      </div>

      {/* arrows */}
      {arrows.length > 0 && (
        <svg viewBox="0 0 800 800" className="pointer-events-none absolute inset-0 z-30 h-full w-full" aria-hidden>
          {arrows.map((a, i) => (
            <ArrowShape key={i} a={a} o={o} />
          ))}
        </svg>
      )}

      {/* promotion picker */}
      {promo && (
        <PromotionPicker
          col={sqCol(promo.to, o)}
          fromTop={sqRow(promo.to, o) === 0}
          color={promoColor as 0 | 1}
          set={p.pieceSet}
          onPick={(type) => {
            const i = promo.target.promos.indexOf(type);
            setPromo(null);
            if (i >= 0) onMove(promo.target.moves[i]);
          }}
          onCancel={() => setPromo(null)}
        />
      )}
    </div>
  );
}

function ArrowShape({ a, o }: { a: Arrow; o: 0 | 1 }) {
  const x1 = sqCol(a.from, o) * 100 + 50;
  const y1 = sqRow(a.from, o) * 100 + 50;
  const x2 = sqCol(a.to, o) * 100 + 50;
  const y2 = sqRow(a.to, o) * 100 + 50;
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const knight = (dx === 100 && dy === 200) || (dx === 200 && dy === 100);
  const pts: [number, number][] = knight ? (dy > dx ? [[x1, y1], [x1, y2], [x2, y2]] : [[x1, y1], [x2, y1], [x2, y2]]) : [[x1, y1], [x2, y2]];
  // shorten the end for the head, start a bit off-centre like chess.com
  const [px, py] = pts[pts.length - 2];
  const len = Math.hypot(x2 - px, y2 - py);
  const ux = (x2 - px) / len;
  const uy = (y2 - py) / len;
  const head = 38;
  const tip: [number, number] = [x2 - ux * 10, y2 - uy * 10];
  const base: [number, number] = [tip[0] - ux * head, tip[1] - uy * head];
  const [sx, sy] = pts[0];
  const [nx, ny] = pts[1];
  const sl = Math.hypot(nx - sx, ny - sy);
  const start: [number, number] = [sx + ((nx - sx) / sl) * 22, sy + ((ny - sy) / sl) * 22];
  const line = [start, ...pts.slice(1, -1), base];
  return (
    <g opacity="0.9">
      <polyline points={line.map((q) => q.join(",")).join(" ")} fill="none" stroke={a.color} strokeWidth="18" strokeLinejoin="miter" />
      <polygon
        points={`${tip[0]},${tip[1]} ${base[0] - uy * 27},${base[1] + ux * 27} ${base[0] + uy * 27},${base[1] - ux * 27}`}
        fill={a.color}
      />
    </g>
  );
}

function PromotionPicker({
  col,
  fromTop,
  color,
  set,
  onPick,
  onCancel,
}: {
  col: number;
  fromTop: boolean;
  color: 0 | 1;
  set: PieceSet;
  onPick: (type: number) => void;
  onCancel: () => void;
}) {
  const order = [5, 2, 4, 3];
  return (
    <div className="absolute inset-0 z-40 bg-black/35" onPointerDown={(e) => { e.stopPropagation(); onCancel(); }}>
      <div
        className={`absolute flex w-[12.5%] overflow-hidden rounded-[4px] bg-white shadow-[0_6px_22px_rgba(0,0,0,0.6)] ${fromTop ? "top-0 flex-col" : "bottom-0 flex-col-reverse"}`}
        style={{ left: `${col * 12.5}%` }}
        onPointerDown={(e) => e.stopPropagation()}
        role="menu"
        aria-label="Promote to"
      >
        {order.map((t) => (
          <button
            key={t}
            type="button"
            role="menuitem"
            aria-label={["", "", "Knight", "Bishop", "Rook", "Queen"][t]}
            data-promo={t}
            onClick={() => onPick(t)}
            className="aspect-square w-full bg-[radial-gradient(circle,#ffffff_45%,#e7e2da_100%)] transition hover:bg-[radial-gradient(circle,#ffd9a8_30%,#f39a4a_100%)]"
          >
            <PieceSvg type={t} color={color} set={set} className="h-full w-full" />
          </button>
        ))}
        <button type="button" onClick={onCancel} aria-label="Cancel promotion" className="flex h-[0.5em] min-h-6 items-center justify-center bg-[#f1f1f1] text-xs font-bold text-[#8b8987] hover:bg-[#e3e3e3]">
          ✕
        </button>
      </div>
    </div>
  );
}
