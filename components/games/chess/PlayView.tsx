"use client";

// One game in progress: board, player bars with clocks, move list with history navigation, controls,
// eval bar, the bot (in a worker), sounds, and the game-over card.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Flag, Handshake, RefreshCw, RotateCcw, Settings2, Undo2, X } from "lucide-react";
import { ResultOverlay, GameButton } from "@/components/games/shared/ResultOverlay";
import { recordBest, recordResult, useGameStats } from "@/lib/games/scores";
import { unlockAudio } from "@/lib/games/audio";
import { EngineClient } from "@/lib/games/chess/engineClient";
import { botById, BOTS } from "@/lib/games/chess/bots";
import { resultText, type PlayedMove } from "@/lib/games/chess/game";
import { Match, isVsBot, type MatchConfig } from "@/lib/games/chess/match";
import { F_CASTLE, Position, moveFlags, moveFrom, movePromo, moveTo, sq64, type Color } from "@/lib/games/chess/position";
import { chessSfx } from "@/lib/games/chess/sounds";
import { Board, type Target } from "./Board";
import { EvalBar, MoveList, PlayerBar } from "./Panels";
import { SettingsPanel } from "./SettingsPanel";
import { countModeResult, usePrefs } from "./settings";

export const MODE_LABEL: Record<string, string> = {
  bot: "Classic",
  pass: "Pass & Play",
  "960": "Chess960",
  koth: "King of the Hill",
  threecheck: "Three-Check",
  ladder: "Bot Ladder",
};

function boardArray(p: Position): number[] {
  const out = new Array<number>(64);
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) out[r * 8 + f] = p.board[r * 16 + f];
  return out;
}

/** UI move targets for the side to move. 960: castle by dropping the king on its rook (or the landing square when unambiguous). */
function buildTargets(p: Position, chess960: boolean): Map<number, Target[]> {
  const map = new Map<number, Target[]>();
  const legal = p.legalMoves();
  const add = (from: number, to: number, m: number) => {
    const list = map.get(from) ?? [];
    let t = list.find((x) => x.to === to);
    if (!t) {
      t = { to, moves: [], promos: [] };
      list.push(t);
    }
    if (!t.moves.includes(m)) {
      t.moves.push(m);
      t.promos.push(movePromo(m));
    }
    map.set(from, list);
  };
  for (const m of legal) {
    const from = sq64(moveFrom(m));
    if (moveFlags(m) & F_CASTLE) {
      const l = Position.landing(m)!;
      add(from, sq64(l.rookFrom), m);
      const landing = sq64(l.kingTo);
      const clash = legal.some((o) => o !== m && moveFrom(o) === moveFrom(m) && !(moveFlags(o) & F_CASTLE) && moveTo(o) === l.kingTo);
      if (landing !== from && (!chess960 || !clash)) add(from, landing, m);
    } else add(from, sq64(moveTo(m)), m);
  }
  return map;
}

function playMoveSound(pm: PlayedMove, mine: boolean) {
  if (pm.check) chessSfx.check();
  else if (moveFlags(pm.move) & F_CASTLE) chessSfx.castle();
  else if (movePromo(pm.move)) chessSfx.promote();
  else if (pm.captured) chessSfx.capture();
  else if (mine) chessSfx.move();
  else chessSfx.opponentMove();
}

export interface LadderInfo {
  rung: number;
  onWin: () => void;
  onLose: () => void;
}

export function PlayView({
  cfg,
  onNewGame,
  onRematch,
  onExit,
  ladder,
}: {
  cfg: MatchConfig;
  onNewGame: () => void;
  onRematch: () => void;
  onExit: () => void;
  ladder?: LadderInfo;
}) {
  const [prefs, setPrefs] = usePrefs();
  const stats = useGameStats("chess");
  const [match] = useState(() => new Match(cfg));
  const [ver, bump] = useReducer((x: number) => x + 1, 0);
  const [viewPly, setViewPly] = useState<number | null>(null);
  const [thinking, setThinking] = useState(false);
  const [evalInfo, setEvalInfo] = useState<{ ply: number; white: number; mate: number | null } | null>(null);
  const [flipped, setFlipped] = useState(cfg.humanColor === 1);
  const [now, setNow] = useState(() => Date.now());
  const [showResult, setShowResult] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const botClient = useRef<EngineClient | null>(null);
  const evalClient = useRef<EngineClient | null>(null);
  const lastBotScore = useRef(0);
  const recorded = useRef(false);
  const lowTimeTick = useRef(-1);

  const game = match.game;
  const vsBot = isVsBot(cfg.mode);
  const bot = botById(cfg.botId);
  const human: Color = cfg.humanColor;
  const botColor = (human ^ 1) as Color;
  const live = viewPly === null || viewPly === game.ply;
  const shownPly = viewPly ?? game.ply;
  const over = match.over;

  // engine clients live exactly as long as the view (StrictMode-safe: created/disposed per effect run)
  useEffect(() => {
    botClient.current = new EngineClient();
    evalClient.current = new EngineClient();
    return () => {
      botClient.current?.dispose();
      evalClient.current?.dispose();
      botClient.current = null;
      evalClient.current = null;
    };
  }, []);

  // dev-only test hook (used by the headless-browser tests to script positions and clocks)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const w = window as unknown as { __chess?: unknown };
    w.__chess = {
      match,
      play: (uci: string) => {
        const m = match.game.pos.fromUci(uci);
        if (m === null) return false;
        const pm = match.play(m, Date.now());
        bump();
        return !!pm;
      },
      usingWorker: () => botClient.current?.usingWorker,
      setClock: (c: Color, ms: number) => {
        match.clocks[c] = ms;
        match.turnStart = Date.now();
        bump();
      },
    };
    return () => {
      delete w.__chess;
    };
  }, [match]);

  const showToast = useCallback((t: string) => setToast(t), []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  const historyFor = (ply: number): [number, number][] => game.positions.slice(0, ply).map((p) => [p.hashLo, p.hashHi]);

  // ---- bot's turn -----------------------------------------------------------------------------------------
  const botToMove = vsBot && !over && game.turn === botColor;
  useEffect(() => {
    if (!botToMove) return;
    const client = botClient.current;
    if (!client) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();
    const ply = game.ply;
    const p = game.pos;
    setThinking(true);
    const remaining = match.remaining(botColor, Date.now());
    const budget = isFinite(remaining) ? Math.max(80, remaining / 35 + (cfg.tc.inc * 0.6)) : undefined;
    client
      .request({ kind: "bot", fen: p.fen(), variant: game.variant, chess960: game.chess960, history: historyFor(ply), botId: bot.id, plyCount: ply, maxTimeMs: budget })
      .then((res) => {
        if (cancelled || !res || !res.uci) return;
        // feel human: weaker bots take a moment, never longer than the clock allows
        const minDelay = bot.timeMs > 0 ? 250 : 380 + Math.random() * 520;
        const cap = isFinite(remaining) ? Math.max(0, remaining / 50) : Infinity;
        const wait = Math.max(0, Math.min(minDelay, cap) - (Date.now() - startedAt));
        lastBotScore.current = res.whiteScore * (botColor === 0 ? 1 : -1);
        timer = setTimeout(() => {
          if (cancelled || match.game.ply !== ply || match.over) return;
          const m = match.game.pos.fromUci(res.uci!);
          if (m === null) return;
          const pm = match.play(m, Date.now());
          setThinking(false);
          if (pm) playMoveSound(pm, false);
          bump();
        }, wait);
      });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      client.cancel();
      setThinking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botToMove, ver]);

  // ---- evaluation bar ---------------------------------------------------------------------------------------
  useEffect(() => {
    if (!prefs.showEval) return;
    const client = evalClient.current;
    if (!client) return;
    const ply = shownPly;
    const p = game.positions[ply];
    let cancelled = false;
    const id = setTimeout(() => {
      if (game.result && ply === game.ply) {
        // final position: show the result itself
        const r = game.result;
        if (r.reason === "checkmate" || r.reason === "koth" || r.reason === "threecheck") setEvalInfo({ ply, white: r.winner === 0 ? 10000 : -10000, mate: r.reason === "checkmate" ? 0 : null });
        else if (r.winner === null) setEvalInfo({ ply, white: 0, mate: null });
        return;
      }
      client.request({ kind: "analyze", fen: p.fen(), variant: game.variant, chess960: game.chess960, history: historyFor(ply), timeMs: 350 }).then((r) => {
        if (!cancelled && r && !r.error) setEvalInfo({ ply, white: r.whiteScore, mate: r.mate });
      });
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownPly, ver, prefs.showEval]);

  // ---- clocks -------------------------------------------------------------------------------------------------
  const clockRunning = match.timed && !over && match.turnStart !== null;
  useEffect(() => {
    if (!clockRunning) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (match.checkFlag(t)) {
        bump();
        return;
      }
      // low-time ticks for the human's clock
      const side = match.game.turn;
      const mineLow = (!vsBot || side === human) && match.remaining(side, t) < 10_000;
      if (mineLow) {
        const sec = Math.ceil(match.remaining(side, t) / 1000);
        if (sec !== lowTimeTick.current) {
          lowTimeTick.current = sec;
          chessSfx.tick();
        }
      }
    }, 100);
    return () => clearInterval(id);
  }, [clockRunning, match, vsBot, human, ver]);

  // ---- game over: record once, sound, card -----------------------------------------------------------------
  useEffect(() => {
    if (!over || recorded.current) return;
    recorded.current = true;
    const r = game.result!;
    const outcome = r.winner === null ? "draw" : !vsBot ? "win" : r.winner === human ? "win" : "loss";
    if (vsBot && cfg.mode !== "ladder") {
      recordResult("chess", outcome);
    }
    countModeResult(cfg.mode, outcome === "win" ? "w" : outcome === "loss" ? "l" : "d");
    let best = false;
    if (ladder) {
      if (outcome === "win") {
        best = recordBest("chess", "ladder", ladder.rung + 1);
        ladder.onWin();
      } else if (outcome === "loss") ladder.onLose();
    }
    if (!vsBot) chessSfx.draw();
    else if (outcome === "win") chessSfx.win();
    else if (outcome === "loss") chessSfx.loss();
    else chessSfx.draw();
    const id = setTimeout(() => {
      setNewBest(best);
      setViewPly(null);
      setShowResult(true);
    }, 700);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over]);

  // ---- user actions ------------------------------------------------------------------------------------------
  const humanCanMove = !over && live && (!vsBot || game.turn === human);
  const targets = useMemo(
    () => (humanCanMove ? buildTargets(game.pos, game.chess960) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [humanCanMove, ver]
  );

  const onMove = (m: number) => {
    unlockAudio();
    if (!humanCanMove) return;
    const pm = match.play(m, Date.now());
    if (!pm) {
      chessSfx.illegal();
      return;
    }
    if (game.ply === 1 && !vsBot) chessSfx.gameStart();
    playMoveSound(pm, true);
    if (!vsBot && prefs.autoFlip && !match.over) setFlipped(game.turn === 1);
    bump();
  };

  const navigate = useCallback(
    (ply: number) => {
      const p = Math.max(0, Math.min(game.ply, ply));
      setViewPly(p === game.ply ? null : p);
      const pm = game.moves[p - 1];
      if (pm && p !== shownPly) {
        if (pm.captured) chessSfx.capture();
        else chessSfx.opponentMove();
      }
    },
    [game, shownPly]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "ArrowLeft") navigate(shownPly - 1);
      else if (e.key === "ArrowRight") navigate(shownPly + 1);
      else if (e.key === "Home") navigate(0);
      else if (e.key === "End") navigate(game.ply);
      else if (e.key === "f" && !e.ctrlKey && !e.metaKey) setFlipped((f) => !f);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, shownPly, game]);

  const canTakeback = !over && (vsBot ? game.ply >= (game.turn === human ? 2 : 1) && game.moves.some((m) => m.color === human) : game.ply >= 1);
  const takeback = () => {
    if (!canTakeback) return;
    botClient.current?.cancel();
    const n = vsBot ? (game.turn === human ? 2 : 1) : 1;
    match.takeback(n, Date.now());
    setViewPly(null);
    chessSfx.opponentMove();
    if (!vsBot && prefs.autoFlip) setFlipped(game.turn === 1);
    bump();
  };

  const resign = () => {
    if (over) return;
    if (!confirmResign) {
      setConfirmResign(true);
      return;
    }
    setConfirmResign(false);
    botClient.current?.cancel();
    match.resign(vsBot ? human : game.turn);
    bump();
  };
  useEffect(() => {
    if (!confirmResign) return;
    const id = setTimeout(() => setConfirmResign(false), 3000);
    return () => clearTimeout(id);
  }, [confirmResign]);

  const offerDraw = () => {
    if (over) return;
    if (!vsBot) {
      match.agreeDraw();
      bump();
      return;
    }
    if (game.ply < 6) {
      showToast(`${bot.name} declines — too early for a draw.`);
      return;
    }
    // the bot accepts when it is equal or worse by its own last evaluation
    if (lastBotScore.current <= 25) {
      botClient.current?.cancel();
      match.agreeDraw();
      bump();
    } else showToast(`${bot.name} declines the draw.`);
  };

  // ---- derived display ---------------------------------------------------------------------------------------
  const shownPos = game.positions[shownPly];
  const boardArr = useMemo(() => boardArray(shownPos), [shownPos]);
  const lastPm = game.moves[shownPly - 1];
  const lastMove = useMemo(() => {
    if (!lastPm) return null;
    const m = lastPm.move;
    return { from: sq64(moveFrom(m)), to: sq64(Position.dest(m)) };
  }, [lastPm]);
  const checkSq = shownPos.inCheck() ? sq64(shownPos.kings[shownPos.side]) : null;
  const mat = useMemo(() => game.material(shownPly), [game, shownPly]);
  const orientation: 0 | 1 = flipped ? 1 : 0;
  const bottomColor = orientation === 0 ? 0 : 1;
  const topColor = (bottomColor ^ 1) as Color;
  const result = game.result;

  const playerInfo = (c: Color) => {
    if (vsBot && c === botColor) return { name: bot.name, sub: `(${bot.rating})`, avatar: bot.emoji };
    if (vsBot) return { name: "You", sub: undefined, avatar: "🙂" };
    return { name: c === 0 ? "White" : "Black", sub: undefined, avatar: c === 0 ? "♔" : "♚" };
  };
  const bar = (c: Color) => {
    const info = playerInfo(c);
    const adv = c === 0 ? mat.balance : -mat.balance;
    return (
      <PlayerBar
        {...info}
        color={c as 0 | 1}
        captured={mat.captured[c]}
        advantage={adv}
        clockMs={match.remaining(c, now)}
        clockActive={match.timed && !over && game.turn === c && match.turnStart !== null}
        showClock={match.timed}
        thinking={vsBot && c === botColor && thinking}
        pieceSet={prefs.pieceSet}
        checks={game.variant === "threecheck" ? shownPos.checks[c] : undefined}
      />
    );
  };

  let status: string;
  if (result) {
    const who = result.winner === null ? "Draw" : vsBot ? (result.winner === human ? "You won" : `${bot.name} won`) : `${result.winner === 0 ? "White" : "Black"} won`;
    status = `${who} ${resultText(result)}`;
  } else if (!live) status = `Reviewing move ${Math.ceil(shownPly / 2)} — press → or End to return`;
  else if (vsBot && game.turn === botColor) status = `${bot.name} is thinking…`;
  else if (game.pos.inCheck()) status = "Check!";
  else if (vsBot) status = "Your move";
  else status = `${game.turn === 0 ? "White" : "Black"} to move`;
  if (!result && live && game.pos.inCheck() && vsBot && game.turn === botColor) status = `Check! ${bot.name} is thinking…`;

  let outcome: "win" | "loss" | "draw" = "draw";
  let title = "Draw";
  if (result && result.winner !== null) {
    if (vsBot) {
      outcome = result.winner === human ? "win" : "loss";
      title = outcome === "win" ? "You won!" : "You lost";
    } else {
      outcome = "win";
      title = `${result.winner === 0 ? "White" : "Black"} won!`;
    }
  }
  const reasonLine = result ? `${result.winner === null ? "Draw" : (result.winner === 0 ? "White" : "Black") + " wins"} ${resultText(result)}` : "";
  const record = vsBot
    ? [
        { label: "Record", value: `${stats.wins}W ${stats.losses}L ${stats.draws}D` },
        { label: ladder ? "Ladder" : "Streak", value: ladder ? `Rung ${ladder.rung + (outcome === "win" ? 2 : 1)}/${BOTS.length}` : `${stats.streak} (best ${stats.bestStreak})` },
      ]
    : [{ label: "Moves", value: Math.ceil(game.ply / 2) }];

  const evalForShown = evalInfo;

  return (
    <div className="relative flex w-full flex-col gap-3 @2xl:flex-row @2xl:items-start" data-chess-play>
      {/* board column */}
      <div className="mx-auto w-full max-w-[min(100%,calc(72vh+2rem))] @2xl:mx-0 @2xl:flex-1">
        {bar(topColor)}
        <div className="relative flex gap-1.5 @lg:gap-2">
          {prefs.showEval && <EvalBar
              whiteScore={evalForShown?.white ?? 0}
              mate={evalForShown?.mate ?? null}
              orientation={orientation}
              final={result && shownPly === game.ply ? (result.winner === null ? "½-½" : result.winner === 0 ? "1-0" : "0-1") : undefined}
            />}
          <div className="relative min-w-0 flex-1">
            <Board
              board={boardArr}
              posKey={`${shownPly}:${shownPos.key()}:${game.ply}`}
              orientation={orientation}
              lastMove={lastMove}
              checkSq={checkSq}
              targets={targets}
              onMove={onMove}
              onIllegal={() => chessSfx.illegal()}
              theme={prefs.theme}
              pieceSet={prefs.pieceSet}
              showLegal={prefs.showLegal}
              showCoords={prefs.showCoords}
              autoQueen={prefs.autoQueen}
            />
            <div className="contents" data-chess-result>
            <ResultOverlay open={showResult && !!result} outcome={outcome} title={title} reason={reasonLine} stats={record} newBest={newBest}>
              {ladder ? (
                outcome === "win" && ladder.rung + 1 < BOTS.length ? (
                  <GameButton variant="primary" onClick={onNewGame}>
                    Next rung: {BOTS[ladder.rung + 1].name}
                  </GameButton>
                ) : (
                  <GameButton variant="primary" onClick={onRematch}>
                    {outcome === "draw" ? "Try again" : "New ladder run"}
                  </GameButton>
                )
              ) : (
                <GameButton variant="primary" onClick={onRematch}>
                  Rematch {vsBot ? "(swap colours)" : ""}
                </GameButton>
              )}
              <div className="grid grid-cols-2 gap-2">
                <GameButton onClick={onExit}>New game</GameButton>
                <GameButton onClick={() => setShowResult(false)}>Review</GameButton>
              </div>
            </ResultOverlay>
            </div>
          </div>
        </div>
        {bar(bottomColor as Color)}
        <p className={`mt-1 min-h-5 text-center text-sm ${result ? "font-semibold text-paper" : "text-paper-dim"}`} data-status aria-live="polite">
          {status}
        </p>
      </div>

      {/* side panel */}
      <div className="flex w-full flex-col gap-2 @2xl:w-64 @2xl:self-stretch @3xl:w-72">
        <div className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper-dim">{MODE_LABEL[cfg.mode]}{ladder ? ` · rung ${ladder.rung + 1}` : ""}</p>
            <p className="truncate text-sm font-semibold text-paper">{vsBot ? `vs ${bot.name} ${bot.emoji}` : "Two players"} · {cfg.tc.base ? cfg.tc.label : "No clock"}</p>
          </div>
          <button type="button" onClick={() => setSettingsOpen((s) => !s)} className="rounded-full p-1.5 text-paper-dim transition hover:bg-white/10 hover:text-paper" aria-label="Board settings" data-settings-btn>
            {settingsOpen ? <X size={16} /> : <Settings2 size={16} />}
          </button>
        </div>
        {settingsOpen && <SettingsPanel prefs={prefs} setPrefs={setPrefs} passAndPlay={!vsBot} />}
        <MoveList moves={game.moves} current={shownPly} onSelect={navigate} />
        <div className="grid grid-cols-4 gap-1">
          <NavBtn label="First move" onClick={() => navigate(0)} disabled={shownPly === 0}>
            <ChevronFirst size={18} />
          </NavBtn>
          <NavBtn label="Previous move" onClick={() => navigate(shownPly - 1)} disabled={shownPly === 0}>
            <ChevronLeft size={18} />
          </NavBtn>
          <NavBtn label="Next move" onClick={() => navigate(shownPly + 1)} disabled={shownPly >= game.ply}>
            <ChevronRight size={18} />
          </NavBtn>
          <NavBtn label="Last move" onClick={() => navigate(game.ply)} disabled={shownPly >= game.ply}>
            <ChevronLast size={18} />
          </NavBtn>
        </div>
        <div className="grid grid-cols-2 gap-1.5 @sm:grid-cols-4 @2xl:grid-cols-2">
          <CtrlBtn onClick={() => setFlipped((f) => !f)} icon={<RefreshCw size={14} />} label="Flip" />
          <CtrlBtn onClick={takeback} disabled={!canTakeback} icon={<Undo2 size={14} />} label="Takeback" />
          <CtrlBtn onClick={offerDraw} disabled={over} icon={<Handshake size={14} />} label={vsBot ? "Offer draw" : "Draw"} />
          <CtrlBtn onClick={resign} disabled={over} icon={<Flag size={14} />} label={confirmResign ? "Confirm?" : "Resign"} danger={confirmResign} />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {over ? (
            <CtrlBtn onClick={() => setShowResult(true)} icon={<Flag size={14} />} label="Show result" />
          ) : (
            <span />
          )}
          <CtrlBtn onClick={onExit} icon={<RotateCcw size={14} />} label="New game" primary />
        </div>
        {toast && (
          <p className="rounded-lg bg-white/[0.06] px-3 py-2 text-center text-xs text-paper" role="status">
            {toast}
          </p>
        )}
      </div>
    </div>
  );
}

function NavBtn({ children, onClick, disabled, label }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-9 place-items-center rounded-md bg-white/[0.06] text-paper transition hover:bg-white/[0.12] disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function CtrlBtn({ onClick, disabled, icon, label, danger, primary }: { onClick: () => void; disabled?: boolean; icon: React.ReactNode; label: string; danger?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-9 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition disabled:opacity-30 ${
        danger ? "bg-red-500 text-white" : primary ? "bg-ember text-ink hover:brightness-110" : "bg-white/[0.06] text-paper hover:bg-white/[0.12]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
