"use client";

// Puzzle Rush: solve as many machine-verified puzzles as possible in 3 minutes; 3 wrong moves end the run.
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { GameButton, ResultOverlay } from "@/components/games/shared/ResultOverlay";
import { recordBest, useGameStats } from "@/lib/games/scores";
import { unlockAudio } from "@/lib/games/audio";
import { Game } from "@/lib/games/chess/game";
import { PUZZLES, type Puzzle } from "@/lib/games/chess/puzzles";
import { F_CASTLE, Position, moveFlags, moveFrom, movePromo, sq64 } from "@/lib/games/chess/position";
import { chessSfx } from "@/lib/games/chess/sounds";
import { Board, type Target } from "./Board";
import { formatClock } from "./Panels";
import { usePrefs } from "./settings";

const RUSH_MS = 180_000;
const MAX_STRIKES = 3;

function shuffled<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/** Easy first, then progressively harder; random order inside each tier. */
function buildRun(): Puzzle[] {
  const out: Puzzle[] = [];
  for (const tier of [1, 2, 3, 4]) out.push(...shuffled(PUZZLES.filter((p) => p.tier === tier)));
  return out;
}

function boardArray(p: Position): number[] {
  const out = new Array<number>(64);
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) out[r * 8 + f] = p.board[r * 16 + f];
  return out;
}

function targetsFor(p: Position): Map<number, Target[]> {
  const map = new Map<number, Target[]>();
  for (const m of p.legalMoves()) {
    const from = sq64(moveFrom(m));
    const to = sq64(Position.dest(m));
    const list = map.get(from) ?? [];
    let t = list.find((x) => x.to === to);
    if (!t) list.push((t = { to, moves: [], promos: [] }));
    t.moves.push(m);
    t.promos.push(movePromo(m));
    map.set(from, list);
  }
  return map;
}

export function PuzzleRush({ onExit, onRestart }: { onExit: () => void; onRestart: () => void }) {
  const [prefs] = usePrefs();
  const stats = useGameStats("chess");
  const [run] = useState(buildRun);
  const [index, setIndex] = useState(0);
  const [game, setGame] = useState(() => new Game(run[0].fen));
  const [step, setStep] = useState(0); // index into puzzle.line of the move the player must make
  const [ready, setReady] = useState(false); // pre-move played, player to move
  const [ver, bump] = useReducer((x: number) => x + 1, 0);
  const [score, setScore] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [history, setHistory] = useState<boolean[]>([]);
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);
  const [endAt] = useState(() => Date.now() + RUSH_MS);
  const [now, setNow] = useState(() => Date.now());
  const [over, setOver] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const puzzle = run[index % run.length];

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  useEffect(() => {
    const list = timers.current;
    return () => list.forEach(clearTimeout);
  }, []);

  // play the opponent's "pre" move shortly after each puzzle appears
  useEffect(() => {
    if (over) return;
    const id = setTimeout(() => {
      const m = game.pos.fromUci(puzzle.pre);
      if (m !== null) {
        const pm = game.play(m);
        if (pm?.captured) chessSfx.capture();
        else chessSfx.opponentMove();
      }
      setReady(true);
      bump();
    }, 450);
    return () => clearTimeout(id);
  }, [game, puzzle, over]);

  // end + record the run exactly once
  const done = useRef(false);
  const scoreRef = useRef(0);
  const endRun = () => {
    if (done.current) return;
    done.current = true;
    const nb = recordBest("chess", "puzzleRush", scoreRef.current);
    setNewBest(nb);
    setOver(true);
    if (scoreRef.current > 0) chessSfx.win();
    else chessSfx.loss();
  };

  // the 3-minute clock
  useEffect(() => {
    if (over) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endAt) endRun();
    }, 100);
    return () => clearInterval(id);
     
  }, [over, endAt]);

  const nextPuzzle = () => {
    const ni = index + 1;
    setIndex(ni);
    setGame(new Game(run[ni % run.length].fen));
    setStep(0);
    setReady(false);
    setFlash(null);
  };

  const playerColor = (() => {
    const p = Position.fromFen(puzzle.fen);
    return (p.side ^ 1) as 0 | 1;
  })();

  const onMove = (m: number) => {
    unlockAudio();
    if (!ready || over) return;
    const expected = puzzle.line[step];
    const u = game.pos.uci(m);
    const pm = game.play(m);
    if (!pm) return;
    const mates = game.result?.reason === "checkmate";
    if (u === expected || mates) {
      if (pm.check) chessSfx.check();
      else if (pm.captured) chessSfx.capture();
      else if (moveFlags(m) & F_CASTLE) chessSfx.castle();
      else chessSfx.move();
      if (step + 1 >= puzzle.line.length || mates) {
        scoreRef.current += 1;
        setScore(scoreRef.current);
        setHistory((h) => [...h, true]);
        setFlash("ok");
        chessSfx.correct();
        setReady(false);
        later(nextPuzzle, 550);
      } else {
        setReady(false);
        later(() => {
          const r = game.pos.fromUci(puzzle.line[step + 1]);
          if (r !== null) {
            const rp = game.play(r);
            if (rp?.captured) chessSfx.capture();
            else chessSfx.opponentMove();
          }
          setStep(step + 2);
          setReady(true);
          bump();
        }, 380);
      }
    } else {
      chessSfx.move();
      chessSfx.wrong();
      setFlash("bad");
      setReady(false);
      setHistory((h) => [...h, false]);
      const s = strikes + 1;
      setStrikes(s);
      if (s >= MAX_STRIKES) later(endRun, 700);
      else later(nextPuzzle, 900);
    }
    bump();
  };

  const pos = game.pos;
  const board = useMemo(() => boardArray(pos), [pos, ver]); // eslint-disable-line react-hooks/exhaustive-deps
  const last = game.moves[game.ply - 1];
  const lastMove = last ? { from: sq64(moveFrom(last.move)), to: sq64(Position.dest(last.move)) } : null;
  const checkSq = pos.inCheck() ? sq64(pos.kings[pos.side]) : null;
  const targets = useMemo(() => (ready && !over ? targetsFor(pos) : null), [ready, over, pos, ver]); // eslint-disable-line react-hooks/exhaustive-deps
  const left = Math.max(0, endAt - now);

  return (
    <div className="relative flex w-full flex-col gap-3 @2xl:flex-row @2xl:items-start" data-puzzle-rush>
      <div className="mx-auto w-full max-w-[min(100%,72vh)] @2xl:mx-0 @2xl:flex-1">
        <div className="mb-2 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
            <div className={`h-full rounded-full transition-[width] duration-200 ${left < 20_000 ? "bg-red-400" : "bg-moss"}`} style={{ width: `${(left / RUSH_MS) * 100}%` }} />
          </div>
          <span className={`font-mono text-sm tabular-nums ${left < 20_000 ? "text-red-300" : "text-paper"}`} data-rush-clock>
            {formatClock(left)}
          </span>
        </div>
        <div className="relative">
          <Board
            board={board}
            posKey={`${index}:${game.ply}:${pos.key()}`}
            orientation={playerColor}
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
          {flash && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <span className={`grid h-16 w-16 place-items-center rounded-full shadow-xl ${flash === "ok" ? "bg-moss text-ink" : "bg-red-500 text-white"}`}>
                {flash === "ok" ? <Check size={36} strokeWidth={3} /> : <X size={36} strokeWidth={3} />}
              </span>
            </div>
          )}
          <ResultOverlay
            open={over}
            outcome={newBest ? "win" : score > 0 ? "draw" : "loss"}
            title={`${score} solved`}
            reason={strikes >= MAX_STRIKES ? "Three strikes — run over" : "Time's up!"}
            newBest={newBest && score > 0}
            stats={[
              { label: "Score", value: score },
              { label: "Best", value: Math.max(stats.best.puzzleRush ?? 0, score) },
            ]}
          >
            <GameButton variant="primary" onClick={onRestart}>
              Play again
            </GameButton>
            <GameButton onClick={onExit}>Menu</GameButton>
          </ResultOverlay>
        </div>
        <p className="mt-2 text-center text-sm text-paper-dim" data-status>
          {over ? "Run over" : ready ? `${playerColor === 0 ? "White" : "Black"} to move — find the best move` : flash === "bad" ? "Not quite…" : flash === "ok" ? "Correct!" : "…"}
        </p>
      </div>
      <div className="flex w-full flex-col gap-2 @2xl:w-56">
        <div className="flex items-center justify-between rounded-lg bg-white/[0.04] px-4 py-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper-dim">Score</p>
            <p className="font-display text-4xl font-semibold tabular-nums text-paper" data-rush-score>
              {score}
            </p>
          </div>
          <div className="flex gap-1.5" aria-label={`${strikes} of 3 strikes`}>
            {Array.from({ length: MAX_STRIKES }, (_, i) => (
              <span key={i} className={`grid h-7 w-7 place-items-center rounded-full ${i < strikes ? "bg-red-500 text-white" : "bg-white/[0.07] text-paper-dim/40"}`}>
                <X size={16} strokeWidth={3} />
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg bg-black/20 p-2">
          {history.length === 0 && <span className="text-xs text-paper-dim">Results appear here</span>}
          {history.map((ok, i) => (
            <span key={i} className={`grid h-6 w-6 place-items-center rounded ${ok ? "bg-moss/80 text-ink" : "bg-red-500/80 text-white"}`}>
              {ok ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}
            </span>
          ))}
        </div>
        <p className="px-1 text-xs text-paper-dim">Best: {stats.best.puzzleRush ?? 0}</p>
        <GameButton onClick={endRun} variant="ghost" disabled={over}>
          End run
        </GameButton>
      </div>
    </div>
  );
}
