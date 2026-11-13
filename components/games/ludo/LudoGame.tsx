"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Dices, LayoutGrid, RotateCcw } from "lucide-react";
import { GameButton, ResultOverlay } from "@/components/games/shared/ResultOverlay";
import { unlockAudio } from "@/lib/games/audio";
import { COLOR_NAMES, COLORS, HOME, pointOf, type Color } from "@/lib/games/ludo/board";
import { chooseMove } from "@/lib/games/ludo/bot";
import { applyMove, applyRoll, legalMoves, newGame, tokensPerPlayer, type GameState, type PlayerCfg } from "@/lib/games/ludo/engine";
import { ludoSounds } from "@/lib/games/ludo/sounds";
import { recordBest, recordResult, useGameStats } from "@/lib/games/scores";
import { LudoBoard, type Burst } from "./Board";
import { Die, nextOrientation, type Orientation } from "./Dice";
import { LudoSetup } from "./Setup";
import { addCaptures, DEFAULT_PREFS, loadCaptures, loadPrefs, savePrefs, type Prefs } from "./storage";
import { SWATCH } from "./theme";

const STEP_MS = 215;
const ordinal = (n: number) => ["", "1st", "2nd", "3rd", "4th"][n] ?? `${n}th`;

interface ResultInfo {
  outcome: "win" | "loss" | "draw";
  title: string;
  reason: string;
  newBest: boolean;
  stats: { label: string; value: string }[];
  ranking: { pi: number; place: number }[];
}

const CSS = `
.ludo-tok{transition:transform .2s cubic-bezier(.4,0,.3,1)}
.ludo-tok-fly{transition:transform .75s cubic-bezier(.3,.1,.2,1)}
.ludo-hop{transform-origin:0 .25px;animation:ludo-hop .21s ease-out}
.ludo-flyarc{transform-origin:0 .25px;animation:ludo-flyarc .75s ease-in-out}
.ludo-bob{animation:ludo-bob .7s ease-in-out infinite alternate}
.ludo-ring{transform-origin:0 0;animation:ludo-ring 1s ease-in-out infinite}
.ludo-glow{stroke:currentColor;filter:drop-shadow(0 0 .3px currentColor);animation:ludo-glow 1.4s ease-in-out infinite}
.ludo-burst{transform-origin:0 0;animation:ludo-burst .65s ease-out forwards}
.ludo-spark{animation:ludo-spark .75s ease-out forwards}
.ludo-die-hop{animation:ludo-die-hop .8s ease-out}
.ludo-toast{animation:ludo-toast .25s ease-out}
@keyframes ludo-hop{0%{transform:translateY(0) scale(1.04,.94)}40%{transform:translateY(-.36px) scale(.94,1.08)}100%{transform:translateY(0) scale(1,1)}}
@keyframes ludo-flyarc{0%{transform:scale(1)}40%{transform:scale(1.55) translateY(-.4px)}100%{transform:scale(1)}}
@keyframes ludo-bob{from{transform:translateY(0)}to{transform:translateY(-.13px)}}
@keyframes ludo-ring{0%,100%{transform:scale(.92);opacity:.95}50%{transform:scale(1.12);opacity:.35}}
@keyframes ludo-glow{0%,100%{opacity:.25}50%{opacity:.95}}
@keyframes ludo-burst{from{transform:scale(.3);opacity:1}to{transform:scale(2.4);opacity:0}}
@keyframes ludo-spark{from{transform:translate(0,0);opacity:1}to{transform:translate(var(--dx),var(--dy));opacity:0}}
@keyframes ludo-die-hop{0%{transform:translateY(0)}25%{transform:translateY(-34px)}45%{transform:translateY(0)}60%{transform:translateY(-14px)}78%{transform:translateY(0)}90%{transform:translateY(-3px)}100%{transform:translateY(0)}}
@keyframes ludo-toast{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:none}}
.ludo-left{width:100%}
.ludo-bw{width:min(100%,72vh)}
@container (min-width:42rem){.ludo-left{width:min(calc(100% - 19.5rem),72vh)}.ludo-bw{width:100%}}
@media (prefers-reduced-motion:reduce){.ludo-bob,.ludo-glow,.ludo-ring,.ludo-die-hop{animation:none}.ludo-glow{opacity:.8}}
`;

export function LudoGame() {
  const reduced = !!useReducedMotion();
  const stats = useGameStats("ludo");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [captures, setCaptures] = useState(0);
  const [screen, setScreen] = useState<"setup" | "play">("setup");
  const [game, setGame] = useState<GameState | null>(null);
  const [view, setView] = useState<number[][] | null>(null);
  const [busy, setBusy] = useState(false);
  const [dice, setDice] = useState<{ value: number; rolling: boolean; orient: Orientation }>({ value: 0, rolling: false, orient: { rx: 0, ry: 0 } });
  const [history, setHistory] = useState<{ color: Color; value: number }[]>([]);
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const [hop, setHop] = useState<{ id: string; n: number } | null>(null);
  const [flying, setFlying] = useState<ReadonlySet<string>>(new Set());
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [result, setResult] = useState<ResultInfo | null>(null);

  const gen = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const busyRef = useRef(false);
  const counter = useRef(0);
  const recorded = useRef(-1);
  const gameId = useRef(0);

  // preferences live in localStorage; read after mount to keep SSR markup stable
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefs(loadPrefs());
    setCaptures(loadCaptures());
  }, []);

  const sleep = useCallback(
    (ms: number) =>
      new Promise<boolean>((res) => {
        const g = gen.current;
        const id = setTimeout(() => {
          timers.current.delete(id);
          res(g === gen.current);
        }, ms);
        timers.current.add(id);
      }),
    []
  );
  const later = useCallback((ms: number, fn: () => void) => {
    const g = gen.current;
    const id = setTimeout(() => {
      timers.current.delete(id);
      if (g === gen.current) fn();
    }, ms);
    timers.current.add(id);
  }, []);

  const cancelAll = useCallback(() => {
    gen.current++;
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    busyRef.current = false;
    setBusy(false);
    setView(null);
    setHop(null);
    setFlying(new Set());
    setBursts([]);
    setToast(null);
    setDice((d) => ({ ...d, rolling: false }));
  }, []);

  useEffect(() => cancelAll, [cancelAll]);

  const showToast = useCallback(
    (text: string, ms = 1100) => {
      const key = ++counter.current;
      setToast({ text, key });
      later(ms, () => setToast((t) => (t && t.key === key ? null : t)));
    },
    [later]
  );
  const addBurst = useCallback(
    (x: number, y: number, color: Color, kind: Burst["kind"]) => {
      const key = ++counter.current;
      setBursts((b) => [...b, { key, x, y, color, kind }]);
      later(1000, () => setBursts((b) => b.filter((q) => q.key !== key)));
    },
    [later]
  );

  const finalize = useCallback((g: GameState) => {
    if (recorded.current === gameId.current || !g.finalRank) return;
    recorded.current = gameId.current;
    const rank = g.finalRank;
    const humans = g.players.map((p, i) => (p.kind === "human" ? i : -1)).filter((i) => i >= 0);
    const name = (pi: number) => COLOR_NAMES[g.players[pi].color];
    const ranking = rank.map((pi, i) => ({ pi, place: i + 1 }));
    const caps = humans.reduce((a, i) => a + g.captures[i], 0);
    if (caps > 0) setCaptures(addCaptures(caps));
    let info: ResultInfo;
    if (g.stalemate) {
      if (humans.length === 1) recordResult("ludo", "draw");
      info = { outcome: "draw", title: "Stalemate", reason: "Nobody could move for too long, so it ends here.", newBest: false, stats: [], ranking };
    } else if (humans.length === 1) {
      const hp = humans[0];
      const place = rank.indexOf(hp) + 1;
      const won = place === 1;
      recordResult("ludo", won ? "win" : "loss");
      let newBest = false;
      if (won) newBest = recordBest("ludo", g.settings.mode === "quick" ? "fewestTurnsQuick" : "fewestTurns", g.turns[hp], { lowerIsBetter: true });
      info = {
        outcome: won ? "win" : "loss",
        title: won ? "You won!" : `You finished ${ordinal(place)}`,
        reason: won ? "All your tokens made it home." : `${name(rank[0])} got all tokens home first.`,
        newBest,
        stats: [
          { label: "Your turns", value: String(g.turns[hp]) },
          { label: "Captures", value: String(g.captures[hp]) },
        ],
        ranking,
      };
    } else {
      const w = rank[0];
      info = {
        outcome: "win",
        title: `${name(w)} wins`,
        reason: "First to bring every token home.",
        newBest: false,
        stats: [
          { label: "Winner's turns", value: String(g.turns[w]) },
          { label: "Winner's captures", value: String(g.captures[w]) },
        ],
        ranking,
      };
    }
    setResult(info);
    if (info.outcome === "win") ludoSounds.win();
    else if (info.outcome === "loss") ludoSounds.lose();
  }, []);

  const doRoll = useCallback(
    async (g: GameState) => {
      if (busyRef.current || g.phase !== "roll") return;
      busyRef.current = true;
      setBusy(true);
      const value = 1 + Math.floor(Math.random() * 6);
      setDice((d) => ({ value, rolling: true, orient: nextOrientation(d.orient, value) }));
      ludoSounds.rattle();
      if (!(await sleep(800))) return;
      setDice((d) => ({ ...d, rolling: false }));
      ludoSounds.settle();
      if (value === 6) ludoSounds.six();
      setHistory((h) => [...h.slice(-7), { color: g.players[g.turn].color, value }]);
      const r = applyRoll(g, value);
      if (r.kind === "moves") {
        setGame(r.state);
        busyRef.current = false;
        setBusy(false);
        return;
      }
      showToast(r.kind === "triple" ? "Three sixes - turn lost!" : "No moves", 1000);
      ludoSounds.nomove();
      if (!(await sleep(r.kind === "triple" ? 1250 : 1000))) return;
      setGame(r.state);
      if (r.state.phase === "over") {
        finalize(r.state);
      }
      busyRef.current = false;
      setBusy(false);
    },
    [sleep, showToast, finalize]
  );

  const doMove = useCallback(
    async (g: GameState, t: number) => {
      if (busyRef.current || g.phase !== "move") return;
      if (!legalMoves(g).includes(t)) return;
      busyRef.current = true;
      setBusy(true);
      const res = applyMove(g, t);
      const col = g.players[res.pi].color;
      const id = `${res.pi}-${t}`;
      let v = g.tokens.map((r) => r.slice());
      setView(v);
      for (let i = 0; i < res.path.length; i++) {
        v = v.map((r) => r.slice());
        v[res.pi][t] = res.path[i];
        setView(v);
        setHop({ id, n: ++counter.current });
        if (res.enteredBoard) ludoSounds.yard();
        else ludoSounds.step(i);
        if (!(await sleep(res.enteredBoard ? 420 : STEP_MS))) return;
      }
      setHop(null);
      if (res.captured.length) {
        ludoSounds.capture();
        const [bx, by] = pointOf(col, res.to, 0);
        addBurst(bx, by, col, "capture");
        v = v.map((r) => r.slice());
        for (const c of res.captured) v[c.pi][c.t] = -1;
        setFlying(new Set(res.captured.map((c) => `${c.pi}-${c.t}`)));
        setView(v);
        if (!(await sleep(780))) return;
        setFlying(new Set());
      }
      if (res.reachedHome) {
        ludoSounds.home();
        const slot = g.tokens[res.pi].length === 2 ? [1, 2][t] : t;
        const [hx, hy] = pointOf(col, HOME, slot);
        addBurst(hx, hy, col, "home");
        if (!(await sleep(500))) return;
      }
      setGame(res.state);
      setView(null);
      if (res.bonus) {
        showToast(res.captured.length ? "Captured! Roll again" : "Six! Roll again", 1000);
        if (res.captured.length) ludoSounds.ding();
      }
      if (res.gameOver) {
        if (!(await sleep(res.reachedHome ? 800 : 600))) return;
        finalize(res.state);
      }
      busyRef.current = false;
      setBusy(false);
    },
    [sleep, addBurst, showToast, finalize]
  );

  const start = useCallback(() => {
    unlockAudio();
    cancelAll();
    const players: PlayerCfg[] = COLORS.filter((c) => prefs.seats[c] !== "off").map((c) => ({ color: c, kind: prefs.seats[c] === "bot" ? "bot" : "human" }));
    gameId.current++;
    setResult(null);
    setHistory([]);
    setDice({ value: 0, rolling: false, orient: { rx: 0, ry: 0 } });
    setGame(newGame(players, prefs.settings));
    setScreen("play");
  }, [cancelAll, prefs]);

  const toMenu = useCallback(() => {
    cancelAll();
    gameId.current++;
    setResult(null);
    setGame(null);
    setScreen("setup");
  }, [cancelAll]);

  const updatePrefs = useCallback((p: Prefs) => {
    setPrefs(p);
    savePrefs(p);
  }, []);

  // bots roll/move on a short, human-feeling delay; single legal moves auto-play
  useEffect(() => {
    if (screen !== "play" || !game || busy || result || game.phase === "over") return;
    const pl = game.players[game.turn];
    let id: ReturnType<typeof setTimeout> | undefined;
    if (game.phase === "roll") {
      if (pl.kind === "bot") id = setTimeout(() => void doRoll(game), 400 + Math.random() * 500);
    } else {
      const moves = legalMoves(game);
      if (pl.kind === "bot") id = setTimeout(() => void doMove(game, chooseMove(game)), 450 + Math.random() * 450);
      else if (game.settings.autoMove && moves.length === 1) id = setTimeout(() => void doMove(game, moves[0]), 420);
    }
    return () => clearTimeout(id);
  }, [screen, game, busy, result, doRoll, doMove]);

  if (screen === "setup" || !game) {
    return (
      <div className="relative w-full">
        <style>{CSS}</style>
        <LudoSetup prefs={prefs} onChange={updatePrefs} onStart={start} stats={stats} captures={captures} />
      </div>
    );
  }

  const cur = game.players[game.turn];
  const humans = game.players.filter((p) => p.kind === "human").length;
  const isHumanTurn = cur.kind === "human" && game.phase !== "over";
  const canRoll = isHumanTurn && game.phase === "roll" && !busy && !result;
  const movableSet = new Set<string>();
  if (isHumanTurn && game.phase === "move" && !busy && !result) for (const t of legalMoves(game)) movableSet.add(`${game.turn}-${t}`);
  const shown = view ?? game.tokens;
  const ntok = tokensPerPlayer(game.settings.mode);
  const curName = COLOR_NAMES[cur.color];
  const turnLabel = humans === 1 ? (cur.kind === "human" ? "Your turn" : `${curName} (bot)`) : `${curName}'s turn`;
  const hint = result
    ? "Game over"
    : cur.kind === "bot"
      ? `${curName} is ${game.phase === "move" ? "choosing" : "rolling"}...`
      : game.phase === "roll"
        ? `${humans > 1 ? `${curName}, tap` : "Tap"} the dice or press Roll`
        : movableSet.size
          ? "Pick a glowing token to move"
          : "";
  const pick = (pi: number, t: number) => {
    if (pi !== game.turn || !movableSet.has(`${pi}-${t}`)) return;
    unlockAudio();
    void doMove(game, t);
  };
  const roll = () => {
    if (!canRoll) return;
    unlockAudio();
    void doRoll(game);
  };

  return (
    <div className="relative w-full" data-ludo="play" data-turn={game.turn} data-phase={game.phase} data-busy={busy ? "1" : "0"} data-color={cur.color}>
      <style>{CSS}</style>
      <div className="flex w-full flex-col items-center gap-3 @2xl:flex-row @2xl:items-start @2xl:justify-center">
        <div className="ludo-left flex flex-col items-center gap-2.5">
          {/* turn bar */}
          <div className="flex w-full items-center gap-3 rounded-2xl border border-line-strong bg-ink-2/80 px-3 py-2 backdrop-blur" style={{ width: "min(100%,72vh)" }}>
            <motion.span
              key={game.turn}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 22 }}
              className="h-6 w-6 shrink-0 rounded-full"
              style={{ background: `radial-gradient(circle at 35% 30%, ${SWATCH[cur.color].light}, ${SWATCH[cur.color].base} 55%, ${SWATCH[cur.color].dark})`, boxShadow: `0 0 14px ${SWATCH[cur.color].base}99` }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-semibold text-paper" data-ludo-turn>
                {result ? "Game over" : turnLabel}
              </p>
              <p className="truncate text-[11px] text-paper-dim">{hint}</p>
            </div>
            <div className="flex items-center gap-1" aria-label="Recent rolls">
              {history.slice(-6).map((h, i, arr) => (
                <span
                  key={history.length - arr.length + i}
                  className="grid h-6 w-6 place-items-center rounded-md border font-mono text-[11px] font-semibold tabular-nums"
                  style={{ borderColor: `${SWATCH[h.color].base}aa`, color: SWATCH[h.color].light, background: `${SWATCH[h.color].base}22`, opacity: 0.55 + (i / Math.max(1, arr.length - 1)) * 0.45 }}
                >
                  {h.value}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={start} title="Restart" aria-label="Restart" className="rounded-full p-1.5 text-paper-dim transition hover:bg-white/10 hover:text-paper">
                <RotateCcw className="h-4 w-4" />
              </button>
              <button type="button" onClick={toMenu} title="New game" aria-label="New game" className="rounded-full p-1.5 text-paper-dim transition hover:bg-white/10 hover:text-paper">
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="ludo-bw relative aspect-square">
            <LudoBoard
              players={game.players}
              tokens={shown}
              activePi={result ? null : game.turn}
              movable={movableSet}
              onPick={pick}
              hop={hop}
              flying={flying}
              bursts={bursts}
              reduced={reduced}
            />
            <AnimatePresence>
              {toast && (
                <motion.div
                  key={toast.key}
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-white/20 bg-ink/90 px-4 py-2 font-display text-sm font-semibold text-paper shadow-[0_10px_40px_-10px_rgba(0,0,0,0.9)] backdrop-blur"
                  data-ludo-toast
                >
                  {toast.text}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* side panel */}
        <div className="flex w-full max-w-[72vh] flex-col gap-3 @2xl:w-72 @2xl:max-w-none">
          <div className="flex items-center gap-4 rounded-2xl border border-line-strong bg-ink-2/80 p-4">
            <button
              type="button"
              onClick={roll}
              disabled={!canRoll}
              aria-label="Roll the dice"
              className="relative grid h-[92px] w-[92px] shrink-0 place-items-center rounded-2xl outline-none transition focus-visible:ring-2 focus-visible:ring-ember disabled:cursor-default"
            >
              <Die orient={dice.orient} rolling={dice.rolling} size={58} dim={!dice.rolling && game.phase === "roll" && dice.value !== 0 && !canRoll} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper-dim">{dice.rolling ? "Rolling" : dice.value ? "Last roll" : "Dice"}</p>
              <p className="font-display text-3xl font-semibold tabular-nums text-paper" data-ludo-dice>
                {dice.rolling || !dice.value ? "-" : dice.value}
              </p>
              <GameButton variant="primary" onClick={roll} disabled={!canRoll} className="mt-2 !px-4 !py-1.5 text-xs">
                <Dices className="h-3.5 w-3.5" /> Roll
              </GameButton>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-1">
            {game.players.map((pl, pi) => {
              const home = game.tokens[pi].filter((p) => p === HOME).length;
              const placed = game.rank.indexOf(pi);
              const isCur = pi === game.turn && !result;
              return (
                <div
                  key={pi}
                  className="flex items-center gap-2.5 rounded-xl border px-3 py-2 transition"
                  style={{ borderColor: isCur ? `${SWATCH[pl.color].base}` : "rgba(245,239,227,0.12)", background: isCur ? `${SWATCH[pl.color].base}1f` : "transparent" }}
                  data-player={pi}
                >
                  <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, ${SWATCH[pl.color].light}, ${SWATCH[pl.color].base} 60%, ${SWATCH[pl.color].dark})` }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-paper">
                      {COLOR_NAMES[pl.color]}
                      <span className="ml-1.5 font-normal text-paper-dim">{pl.kind === "bot" ? "Bot" : humans === 1 ? "You" : "Player"}</span>
                    </p>
                    <div className="mt-1 flex gap-1">
                      {Array.from({ length: ntok }, (_, k) => (
                        <span key={k} className="h-1.5 flex-1 rounded-full" style={{ background: k < home ? SWATCH[pl.color].base : "rgba(245,239,227,0.12)" }} />
                      ))}
                    </div>
                  </div>
                  <span className="font-mono text-[10px] tabular-nums text-paper-dim">{placed >= 0 ? ordinal(placed + 1) : `${home}/${ntok}`}</span>
                </div>
              );
            })}
          </div>
          <p className="hidden px-1 text-[11px] leading-relaxed text-paper-dim @2xl:block">
            Six to leave the yard and roll again. Stars and start squares are safe. Land exactly on home.
          </p>
        </div>
      </div>

      <ResultOverlay open={!!result} outcome={result?.outcome ?? "win"} title={result?.title ?? ""} reason={result?.reason} stats={result?.stats} newBest={result?.newBest}>
        {result && (
          <ol className="mb-1 space-y-1 text-left" data-ludo-ranking>
            {result.ranking.map((r) => (
              <li key={r.pi} className="flex items-center gap-2 rounded-lg bg-ink/60 px-3 py-1.5 text-xs text-paper">
                <span className="w-7 font-mono text-paper-dim">{ordinal(r.place)}</span>
                <span className="h-3 w-3 rounded-full" style={{ background: SWATCH[game.players[r.pi].color].base }} />
                <span className="font-semibold">{COLOR_NAMES[game.players[r.pi].color]}</span>
                <span className="ml-auto text-paper-dim">{game.players[r.pi].kind === "bot" ? "Bot" : humans === 1 ? "You" : "Player"}</span>
              </li>
            ))}
          </ol>
        )}
        <GameButton variant="primary" onClick={start}>
          Rematch
        </GameButton>
        <GameButton onClick={toMenu}>New game</GameButton>
      </ResultOverlay>
    </div>
  );
}
