"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut } from "lucide-react";
import { COLORS, COLOR_NAME, Card, Color, cardLabel } from "@/lib/games/uno/cards";
import { UnoSettings, UnoState, canJumpIn, playableCards, topCard } from "@/lib/games/uno/engine";
import { CARD_RATIO, COLOR_HEX, CardBack, QuadPie, UnoCard } from "./CardArt";
import { SEATS, landingRot, useUno } from "./useUno";

type Ctrl = ReturnType<typeof useUno>;

const COLOR_ORDER: Record<string, number> = { red: 0, yellow: 1, green: 2, blue: 3 };
const VALUE_ORDER = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "skip", "reverse", "draw2", "wild", "wild4"];
const sortHand = (h: Card[]) =>
  h.slice().sort((a, b) => (a.color ? COLOR_ORDER[a.color] : 9) - (b.color ? COLOR_ORDER[b.color] : 9) || VALUE_ORDER.indexOf(a.value) - VALUE_ORDER.indexOf(b.value) || a.id - b.id);

const FLASH_COLOR: Record<string, string> = { ...COLOR_HEX, neutral: "#f4efe6" };

export function Table({ ctrl, settings, cw, width }: { ctrl: Ctrl; settings: UnoSettings; cw: number; width: number }) {
  const { view, dealt } = ctrl;
  const [chooser, setChooser] = useState<{ cardId: number; kind: "color" | "target" } | null>(null);
  const [selected, setSelected] = useState<{ id: number; turn: number } | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const touch = useRef(false);
  const playable = useMemo(() => new Set(view ? playableCards(view, 0).map((c) => c.id) : []), [view]);
  if (!view) return null;

  const n = view.n;
  const total = settings.startCards * n;
  const dealing = dealt !== null;
  const visibleCount = (p: number) => {
    const full = view.hands[p].length;
    if (!dealing) return full;
    let c = 0;
    for (let j = 0; j < (dealt as number); j++) if (j % n === p) c++;
    return Math.min(c, full);
  };
  const myCards = dealing ? view.hands[0].slice(0, visibleCount(0)) : view.hands[0];
  const drawCount = view.draw.length + (dealing ? Math.max(0, total - (dealt as number)) : 0);
  const myTurn = view.current === 0 && !ctrl.busy && view.winner === null && !dealing && !ctrl.end;
  const canInteract = !ctrl.busy && view.winner === null && !dealing && !ctrl.end;

  const ow = Math.max(26, Math.round(cw * 0.5));
  const bots = n - 1;

  const status = (() => {
    if (view.winner !== null) return "";
    if (dealing) return "Dealing…";
    if (view.current !== 0) return `${SEATS[view.current].name} is thinking…`;
    if (view.pending > 0) return view.challenge ? `Challenge the Wild Draw Four, or take ${view.pending}` : `Stack a ${view.pendingKind === "draw2" ? "Draw Two" : "Draw Four"} or take ${view.pending}`;
    if (view.drawn !== null) return "Play the card you drew, or pass";
    return "Your turn — match the colour or number, or draw";
  })();

  const needsTarget = (c: Card) => settings.sevenZero && c.value === "7" && view.hands[0].length > 1;
  const go = (c: Card) => {
    setSelected(null);
    if (view.current === 0) {
      // let the controller explain illegal plays
      if (!playable.has(c.id)) return ctrl.humanPlay(c.id);
    } else if (!canJumpIn(view, 0, c)) return ctrl.humanPlay(c.id);
    if (c.color === null) return setChooser({ cardId: c.id, kind: "color" });
    if (needsTarget(c)) return setChooser({ cardId: c.id, kind: "target" });
    ctrl.humanPlay(c.id);
  };
  const onCard = (c: Card) => {
    if (!canInteract) return;
    if (touch.current && !(selected && selected.id === c.id && selected.turn === view.turnCount)) {
      setSelected({ id: c.id, turn: view.turnCount });
      return;
    }
    go(c);
  };
  const pickColor = (color: Color) => {
    const ch = chooser;
    setChooser(null);
    if (ch) ctrl.humanPlay(ch.cardId, color);
  };
  const pickTarget = (t: number) => {
    const ch = chooser;
    setChooser(null);
    if (!ch) return;
    ctrl.humanPlay(ch.cardId, undefined, t);
  };

  const showUno = canInteract && ((view.current === 0 && view.hands[0].length === 2 && !view.uno[0]) || (view.vulnerable === 0 && view.hands[0].length === 1));
  const unoDone = view.current === 0 && view.hands[0].length === 2 && view.uno[0];
  const showCatch = canInteract && view.vulnerable !== null && view.vulnerable !== 0;

  return (
    <div className="relative flex flex-col gap-1 px-3 pb-3 pt-2" style={{ ["--cw" as string]: `${cw}px` }} data-uno-phase={view.winner !== null ? "over" : dealing ? "dealing" : ctrl.busy ? "busy" : "play"} data-uno-turn={view.current} data-uno-hand={view.hands[0].length}>
      {/* HUD */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-paper-dim">
            Round {ctrl.round}
            {settings.target > 0 ? ` · to ${settings.target}` : ""}
          </span>
          {settings.target > 0 &&
            ctrl.scores.map((s, i) => (
              <span key={i} className={`rounded-full px-2 py-1 font-mono text-[10px] tabular-nums ${i === 0 ? "bg-moss/15 text-moss" : "bg-white/5 text-paper-dim"}`}>
                {SEATS[i].name} {s}
              </span>
            ))}
        </div>
        <button
          type="button"
          onClick={ctrl.quit}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] font-semibold text-paper-dim transition hover:text-paper"
        >
          <LogOut className="h-3 w-3" /> Quit
        </button>
      </div>

      {/* opponents */}
      <div className="grid gap-2 pt-1" style={{ gridTemplateColumns: `repeat(${bots}, minmax(0, 1fr))` }}>
        {Array.from({ length: bots }, (_, i) => i + 1).map((p) => (
          <Seat key={p} p={p} view={view} count={visibleCount(p)} ow={ow} seatW={width / bots - 24} dealing={dealing} />
        ))}
      </div>

      {/* centre table */}
      <div className="relative flex items-center justify-center" style={{ minHeight: cw * CARD_RATIO + 44 }}>
        <DirectionRing dir={view.dir} size={cw * 3.1} />
        <div className="relative z-10 flex items-center gap-[calc(var(--cw)*0.28)]">
          <button
            type="button"
            data-anchor="draw"
            aria-label={`Draw pile, ${drawCount} cards`}
            disabled={!(myTurn && view.drawn === null)}
            onClick={ctrl.humanDraw}
            className={`relative rounded-[10px] transition ${myTurn && view.drawn === null ? "cursor-pointer hover:-translate-y-1" : "cursor-default"} disabled:opacity-100`}
            style={{ width: cw, height: cw * CARD_RATIO }}
          >
            {[2, 1, 0].map((o) => (
              <div key={o} className="absolute" style={{ left: -o * 1.2, top: -o * 1.6, width: cw, height: cw * CARD_RATIO, borderRadius: cw * 0.12, filter: "drop-shadow(0 3px 4px rgba(0,0,0,.4))" }}>
                <CardBack />
              </div>
            ))}
            {myTurn && view.drawn === null && playable.size === 0 && (
              <span className="pointer-events-none absolute -inset-1 animate-pulse rounded-xl ring-2 ring-moss/80" />
            )}
            <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-2 py-0.5 font-mono text-[10px] tabular-nums text-paper">{drawCount}</span>
          </button>

          <div className="relative" style={{ width: cw, height: cw * CARD_RATIO }}>
            <motion.div
              className="pointer-events-none absolute -inset-[7px] rounded-[18px]"
              animate={{ boxShadow: `0 0 0 4px ${COLOR_HEX[view.color]}, 0 0 28px 6px ${COLOR_HEX[view.color]}aa` }}
              transition={{ duration: 0.35 }}
              style={{ borderRadius: cw * 0.2 }}
              data-uno-color={view.color}
            />
            <div data-anchor="discard" className="absolute inset-0">
              {view.discard.slice(-3, -1).map((c, i, arr) => (
                <div key={c.id} className="absolute inset-0" style={{ transform: `rotate(${landingRot(c.id) * 1.2}deg)`, opacity: 0.75 - (arr.length - 1 - i) * 0.2 }}>
                  <UnoCard card={c} w={cw} />
                </div>
              ))}
              <AnimatePresence initial={false}>
                {!dealing && (
                  <motion.div key={topCard(view).id} className="absolute inset-0" initial={false} style={{ rotate: landingRot(topCard(view).id) }} data-uno-top={`${topCard(view).color ?? "wild"}-${topCard(view).value}`}>
                    <UnoCard card={topCard(view)} w={cw} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <span
              className="absolute -bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-black/70 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-paper"
              style={{ top: "auto" }}
            >
              <i className="inline-block h-2 w-2 rounded-full" style={{ background: COLOR_HEX[view.color] }} />
              {COLOR_NAME[view.color]}
              {view.pending > 0 && <b className="text-ember">+{view.pending}</b>}
            </span>
          </div>
        </div>
      </div>

      {/* status + actions */}
      <div className="mt-3 flex min-h-[2.75rem] flex-col items-center justify-center gap-1.5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={ctrl.toast ? `t${ctrl.toast.key}` : status}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={`max-w-full text-center text-xs ${ctrl.toast ? "rounded-full bg-ember/15 px-3 py-1 font-semibold text-ember" : myTurn ? "font-semibold text-moss" : "text-paper-dim"}`}
            role="status"
            data-uno-status
          >
            {ctrl.toast ? ctrl.toast.text : status}
          </motion.p>
        </AnimatePresence>
        <div className="flex min-h-9 flex-wrap items-center justify-center gap-2">
          {showUno && (
            <motion.button
              type="button"
              onClick={ctrl.humanUno}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: [1, 1.08, 1], opacity: 1 }}
              transition={{ scale: { repeat: Infinity, duration: 0.9 }, opacity: { duration: 0.15 } }}
              className="rounded-full bg-gradient-to-b from-[#ff7a3d] to-[#e0360f] px-6 py-2 font-display text-lg font-black italic tracking-wide text-white shadow-[0_8px_26px_-6px_#ff4e1f] ring-2 ring-white/70"
              data-uno-btn="uno"
            >
              UNO!
            </motion.button>
          )}
          {unoDone && <span className="rounded-full bg-moss/15 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-moss">UNO called ✓</span>}
          {showCatch && (
            <motion.button
              type="button"
              onClick={ctrl.humanCatch}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: [1, 1.06, 1], opacity: 1 }}
              transition={{ scale: { repeat: Infinity, duration: 0.7 }, opacity: { duration: 0.15 } }}
              className="rounded-full bg-paper px-5 py-2 text-sm font-black text-ink shadow-[0_8px_26px_-8px_#fff]"
              data-uno-btn="catch"
            >
              Catch {SEATS[view.vulnerable as number].name}!
            </motion.button>
          )}
          {myTurn && view.drawn !== null && (
            <button type="button" onClick={ctrl.humanPass} className="rounded-full border border-line-strong bg-white/[0.06] px-5 py-2 text-sm font-semibold text-paper hover:bg-white/10" data-uno-btn="pass">
              Pass
            </button>
          )}
          {myTurn && view.pending > 0 && (
            <>
              {view.challenge && (
                <button type="button" onClick={ctrl.humanChallenge} className="rounded-full bg-ember px-5 py-2 text-sm font-bold text-ink hover:brightness-110" data-uno-btn="challenge">
                  Challenge
                </button>
              )}
              <button type="button" onClick={ctrl.humanAccept} className="rounded-full border border-line-strong bg-white/[0.06] px-5 py-2 text-sm font-semibold text-paper hover:bg-white/10" data-uno-btn="accept">
                Draw {view.pending}
              </button>
            </>
          )}
        </div>
      </div>

      {/* my hand */}
      <Hand
        cards={myCards}
        cw={cw}
        width={Math.max(120, width - 24)}
        view={view}
        playable={playable}
        myTurn={myTurn}
        canInteract={canInteract}
        hidden={ctrl.hidden}
        selected={selected && selected.turn === view.turnCount ? selected.id : null}
        hovered={hovered}
        setHovered={setHovered}
        onCard={onCard}
        onPointer={(t) => (touch.current = t === "touch" || t === "pen")}
        shake={ctrl.handShake}
        winnerUnoPulse={view.hands[0].length === 1}
      />

      {/* overlays */}
      <FlashLayer ctrl={ctrl} />
      <AnimatePresence>
        {chooser && (
          <motion.div
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setChooser(null)}
            role="dialog"
            aria-label={chooser.kind === "color" ? "Choose a colour" : "Choose a player to swap hands with"}
          >
            <div onClick={(e) => e.stopPropagation()}>
              {chooser.kind === "color" ? <ColorPicker onPick={pickColor} cw={cw} /> : <TargetPicker view={view} onPick={pickTarget} />}
              <button type="button" onClick={() => setChooser(null)} className="mx-auto mt-3 block text-xs text-paper-dim underline-offset-2 hover:text-paper hover:underline">
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* flying cards */}
      <div className="pointer-events-none absolute inset-0 z-40 overflow-visible" aria-hidden>
        {ctrl.flights.map((f) => (
          <motion.div
            key={f.key}
            className="absolute left-0 top-0"
            style={{ width: cw, height: cw * CARD_RATIO, marginLeft: -cw / 2, marginTop: -(cw * CARD_RATIO) / 2 }}
            initial={{ x: f.x0, y: f.y0, rotate: f.r0, scale: f.s0, opacity: 0 }}
            animate={{ x: f.x1, y: f.y1, rotate: f.r1, scale: f.s1, opacity: 1 }}
            transition={{ default: { duration: f.dur, delay: f.delay, ease: [0.2, 0.85, 0.3, 1.06] }, opacity: { duration: 0.01, delay: f.delay } }}
          >
            <UnoCard card={f.card} w={cw} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Seat({ p, view, count, ow, seatW, dealing }: { p: number; view: UnoState; count: number; ow: number; seatW: number; dealing: boolean }) {
  const active = view.current === p && view.winner === null && !dealing;
  const m = Math.min(count, 10);
  const step = m > 1 ? Math.min(ow * 0.4, Math.max(4, (seatW - ow) / (m - 1))) : 0;
  const fanW = ow + Math.max(0, m - 1) * step;
  const uno = count === 1;
  const caught = view.vulnerable === p;
  return (
    <div className="relative flex min-w-0 flex-col items-center gap-1.5" data-uno-seat={p} data-uno-count={count}>
      <div data-anchor={`seat-${p}`} className="relative" style={{ width: fanW, height: ow * CARD_RATIO + 4 }}>
        {m === 0 && <div className="absolute inset-0 rounded-lg border border-dashed border-white/15" style={{ width: ow }} />}
        {Array.from({ length: m }, (_, i) => {
          const mid = (m - 1) / 2;
          return (
            <div key={i} className="absolute top-0" style={{ left: i * step, width: ow, height: ow * CARD_RATIO, transform: `rotate(${(i - mid) * Math.min(5, 28 / m)}deg)`, transformOrigin: "50% 130%", borderRadius: ow * 0.12, filter: "drop-shadow(0 2px 3px rgba(0,0,0,.45))" }}>
              <CardBack />
            </div>
          );
        })}
      </div>
      <div className={`flex max-w-full items-center gap-1.5 rounded-full border px-2 py-1 transition ${active ? "border-moss bg-moss/15 shadow-[0_0_22px_-4px_var(--moss)]" : "border-white/10 bg-black/30"}`}>
        <span className="text-base leading-none">{SEATS[p].emoji}</span>
        <span className={`truncate text-[11px] font-semibold ${active ? "text-moss" : "text-paper"}`}>{SEATS[p].name}</span>
        <span className="rounded-full bg-white/10 px-1.5 font-mono text-[10px] tabular-nums text-paper" aria-label={`${count} cards`}>
          {count}
        </span>
        {active && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-moss" />}
      </div>
      {uno && (
        <span className={`absolute -top-1 right-1 rotate-6 rounded-md px-1.5 py-0.5 font-display text-[10px] font-black italic text-white ${caught ? "animate-pulse bg-paper !text-ink" : "bg-ember"}`}>{caught ? "NO UNO!" : "UNO"}</span>
      )}
    </div>
  );
}

function DirectionRing({ dir, size }: { dir: 1 | -1; size: number }) {
  return (
    <motion.div className="pointer-events-none absolute" style={{ width: size, height: size, left: "50%", top: "50%", marginLeft: -size / 2, marginTop: -size / 2 }} animate={{ scaleX: dir === 1 ? 1 : -1 }} transition={{ type: "spring", stiffness: 160, damping: 16 }} data-uno-dir={dir}>
      <svg viewBox="-50 -50 100 100" className="h-full w-full animate-[spin_26s_linear_infinite] motion-reduce:animate-none" aria-hidden>
        <g fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.6" strokeLinecap="round">
          <path d="M 0 -44 A 44 44 0 0 1 38 -22" />
          <path d="M 0 44 A 44 44 0 0 1 -38 22" />
        </g>
        <g fill="rgba(255,255,255,0.2)">
          <path d="M 41 -26 L 33 -24 L 40 -17 Z" />
          <path d="M -41 26 L -33 24 L -40 17 Z" />
        </g>
      </svg>
    </motion.div>
  );
}

function Hand({
  cards,
  cw,
  width,
  view,
  playable,
  myTurn,
  canInteract,
  hidden,
  selected,
  hovered,
  setHovered,
  onCard,
  onPointer,
  shake,
}: {
  cards: Card[];
  cw: number;
  width: number;
  view: UnoState;
  playable: Set<number>;
  myTurn: boolean;
  canInteract: boolean;
  hidden: number[];
  selected: number | null;
  hovered: number | null;
  setHovered: (id: number | null) => void;
  onCard: (c: Card) => void;
  onPointer: (type: string) => void;
  shake: number;
  winnerUnoPulse: boolean;
}) {
  const sorted = useMemo(() => sortHand(cards), [cards]);
  const m = sorted.length;
  const ch = cw * CARD_RATIO;
  const natural = cw * 0.64;
  const step = m > 1 ? Math.min(natural, (width - cw) / (m - 1)) : 0;
  const spread = (m - 1) * step + cw;
  const left0 = (width - spread) / 2;
  const fan = Math.min(3.4, 26 / Math.max(m, 1));
  const lift = ch * 0.34;
  return (
    <motion.div
      key={shake}
      className="relative mx-auto"
      style={{ width, height: ch + lift + 8 }}
      animate={shake ? { x: [0, -7, 7, -4, 4, 0] } : undefined}
      transition={{ duration: 0.35 }}
      data-anchor="seat-0"
    >
      {sorted.map((c, i) => {
        const mid = (m - 1) / 2;
        const rel = i - mid;
        const can = playable.has(c.id) && myTurn;
        const jump = !myTurn && canInteract && canJumpIn(view, 0, c);
        const dim = myTurn && !can;
        const isSel = selected === c.id;
        const isHover = hovered === c.id && canInteract;
        const up = isSel || isHover ? lift * 0.9 : can || jump ? lift * 0.3 : 0;
        const isHidden = hidden.includes(c.id);
        return (
          <motion.button
            key={c.id}
            type="button"
            data-uno-card={c.id}
            data-playable={can || jump ? "true" : "false"}
            aria-label={`${cardLabel(c)}${can ? ", playable" : ""}`}
            onPointerDown={(e) => onPointer(e.pointerType)}
            onClick={() => onCard(c)}
            onMouseEnter={() => setHovered(c.id)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(c.id)}
            onBlur={() => setHovered(null)}
            className="absolute top-0 cursor-pointer rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-moss"
            style={{ left: 0, width: cw, height: ch, transformOrigin: "50% 140%", zIndex: isHover || isSel ? 200 : i, opacity: isHidden ? 0 : 1, touchAction: "manipulation" }}
            initial={{ x: left0 + i * step, y: lift + 20, rotate: rel * fan, opacity: 0, scale: 0.85 }}
            animate={{ x: left0 + i * step, y: lift - up + Math.abs(rel) * Math.abs(rel) * (fan * 0.05) * (cw / 40), rotate: isHover || isSel ? 0 : rel * fan, scale: isHover || isSel ? 1.1 : 1, opacity: isHidden ? 0 : 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.7 }}
          >
            <div className="h-full w-full transition-[filter,opacity] duration-200" style={{ filter: dim ? "brightness(0.55) saturate(0.7)" : undefined, borderRadius: cw * 0.12, boxShadow: can ? "0 0 0 2px rgba(205,251,94,0.65), 0 6px 18px -4px rgba(205,251,94,0.35)" : jump ? "0 0 0 2px rgba(255,255,255,0.8)" : "0 4px 10px -3px rgba(0,0,0,.6)" }}>
              <UnoCard card={c} w={cw} style={{ filter: "none" }} />
            </div>
          </motion.button>
        );
      })}
    </motion.div>
  );
}

function FlashLayer({ ctrl }: { ctrl: Ctrl }) {
  const { flash, banner } = ctrl;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden" aria-hidden>
      <AnimatePresence>
        {flash && (
          <motion.div
            key={flash.key}
            initial={{ scale: 0.3, rotate: -10, opacity: 0 }}
            animate={{ scale: 1, rotate: -5, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0, transition: { duration: 0.3 } }}
            transition={{ type: "spring", stiffness: 380, damping: 16 }}
            className="font-display font-black italic"
            style={{ fontSize: "clamp(44px, 13cqw, 120px)", color: FLASH_COLOR[flash.tone], WebkitTextStroke: "3px rgba(0,0,0,0.55)", paintOrder: "stroke fill", textShadow: `0 8px 40px ${FLASH_COLOR[flash.tone]}99, 0 4px 0 rgba(0,0,0,.35)`, letterSpacing: "0.02em" }}
            data-uno-flash={flash.text}
          >
            {flash.text}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {banner && (
          <motion.div
            key={banner.key}
            initial={{ y: 40, scale: 0.5, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 20 }}
            className="absolute top-[38%] rounded-2xl bg-gradient-to-b from-[#ff7a3d] to-[#e0360f] px-5 py-2 font-display text-2xl font-black italic text-white shadow-[0_14px_50px_-8px_#ff4e1f] ring-2 ring-white/80"
            data-uno-banner
          >
            {SEATS[banner.p].emoji} {banner.p === 0 ? "UNO!" : `${SEATS[banner.p].name}: UNO!`}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ColorPicker({ onPick, cw }: { onPick: (c: Color) => void; cw: number }) {
  const size = Math.max(190, Math.min(260, cw * 2.8));
  const r = 48;
  const path = (i: number) => {
    // quadrant order: red (top-left), yellow (top-right), green (bottom-right), blue (bottom-left)
    const a0 = Math.PI + (i * Math.PI) / 2;
    const a1 = a0 + Math.PI / 2;
    const gap = 0.05;
    const p = (a: number, rad: number) => `${Math.cos(a) * rad} ${Math.sin(a) * rad}`;
    return `M ${p(a0 + gap, 12)} L ${p(a0 + gap, r)} A ${r} ${r} 0 0 1 ${p(a1 - gap, r)} L ${p(a1 - gap, 12)} A 12 12 0 0 0 ${p(a0 + gap, 12)} Z`;
  };
  return (
    <motion.div initial={{ scale: 0.6, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 340, damping: 22 }} className="flex flex-col items-center">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-paper-dim">Choose a colour</p>
      <svg viewBox="-52 -52 104 104" width={size} height={size} className="overflow-visible drop-shadow-[0_20px_40px_rgba(0,0,0,.6)]">
        {COLORS.map((c, i) => (
          <motion.path
            key={c}
            d={path(i)}
            fill={COLOR_HEX[c]}
            stroke="#fbfaf6"
            strokeWidth={1.2}
            role="button"
            tabIndex={0}
            aria-label={COLOR_NAME[c]}
            data-uno-pick={c}
            style={{ cursor: "pointer", transformBox: "fill-box", transformOrigin: "0px 0px" }}
            whileHover={{ scale: 1.08, filter: "brightness(1.15)" }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onPick(c)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onPick(c)}
          />
        ))}
        <circle r="9" fill="#15151c" stroke="#fbfaf6" strokeWidth="1.2" />
        <g transform="scale(0.28)">
          <QuadPie r={20} />
        </g>
      </svg>
    </motion.div>
  );
}

function TargetPicker({ view, onPick }: { view: UnoState; onPick: (p: number) => void }) {
  return (
    <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-3 rounded-2xl border border-line-strong bg-ink-2/95 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-paper-dim">Swap hands with…</p>
      <div className="flex flex-wrap justify-center gap-2">
        {Array.from({ length: view.n - 1 }, (_, i) => i + 1).map((p) => (
          <button key={p} type="button" onClick={() => onPick(p)} data-uno-target={p} className="flex min-w-20 flex-col items-center gap-1 rounded-xl border border-line-strong bg-white/[0.05] px-3 py-2 transition hover:border-moss hover:bg-moss/10">
            <span className="text-2xl">{SEATS[p].emoji}</span>
            <span className="text-xs font-semibold text-paper">{SEATS[p].name}</span>
            <span className="font-mono text-[10px] text-paper-dim">{view.hands[p].length} cards</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
