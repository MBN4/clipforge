"use client";

import { useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { motion, AnimatePresence } from "framer-motion";
import { pickBestMove, type Difficulty } from "@/lib/games/chessAi";
import { MODES, startingFen, checkModeWin, type GameMode } from "@/lib/games/chessModes";
import { ChessPiece } from "./ChessPieces";
import { sfx } from "@/lib/sound";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];
const CENTER_SQUARES = new Set(["d4", "d5", "e4", "e5"]);

const DIFFICULTIES: { key: Difficulty; label: string }[] = [
  { key: "easy", label: "Easy" },
  { key: "medium", label: "Medium" },
  { key: "hard", label: "Hard" },
];

export function Chessboard() {
  const [mode, setMode] = useState<GameMode>("classic");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const gameRef = useRef(new Chess(startingFen("classic")));
  const [fen, setFen] = useState(gameRef.current.fen());
  const [selected, setSelected] = useState<Square | null>(null);
  const [thinking, setThinking] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [checkCounts, setCheckCounts] = useState({ w: 0, b: 0 });
  const [winner, setWinner] = useState<{ color: "w" | "b"; reason: string } | null>(null);

  const game = gameRef.current;

  function startGame(nextMode: GameMode) {
    gameRef.current = new Chess(startingFen(nextMode));
    setMode(nextMode);
    setFen(gameRef.current.fen());
    setSelected(null);
    setLastMove(null);
    setCheckCounts({ w: 0, b: 0 });
    setWinner(null);
    setThinking(false);
  }

  const legalTargets = useMemo(() => {
    if (!selected) return new Set<string>();
    const moves = game.moves({ square: selected, verbose: true });
    return new Set(moves.map((m) => m.to));
  }, [selected, fen, game]);

  function status(): string {
    if (winner) return `${winner.color === "w" ? "White" : "Black"} wins — ${winner.reason}`;
    if (game.isCheckmate()) return `Checkmate — ${game.turn() === "w" ? "black" : "white"} wins`;
    if (game.isStalemate()) return "Stalemate";
    if (game.isDraw()) return "Draw";
    if (thinking) return "Thinking…";
    if (game.isCheck()) return `${game.turn() === "w" ? "White" : "Black"} is in check`;
    return game.turn() === "w" ? "Your move" : "Black's move";
  }

  function applyMoveEffects(moverColor: "w" | "b", captured: boolean) {
    const deliveredCheck = game.isCheck();
    if (deliveredCheck) sfx.check();
    else if (captured) sfx.capture();
    else sfx.move();

    const result = checkModeWin(mode, moverColor, game.board(), deliveredCheck, checkCounts);
    if (deliveredCheck && mode === "threecheck") {
      setCheckCounts((c) => {
        const next = { ...c, [moverColor]: c[moverColor] + 1 };
        return next;
      });
    }
    if (result.winner) {
      setWinner({ color: result.winner, reason: result.reason });
      sfx.win();
      return true;
    }
    if (game.isGameOver()) {
      sfx.win();
      return true;
    }
    return false;
  }

  function afterPlayerMove(captured: boolean) {
    const over = applyMoveEffects("w", captured);
    setFen(game.fen());
    if (over || game.turn() !== "b") return;

    setThinking(true);
    setTimeout(() => {
      const san = pickBestMove(game.fen(), difficulty);
      if (san) {
        const move = game.move(san);
        if (move) {
          setLastMove({ from: move.from, to: move.to });
          applyMoveEffects("b", !!move.captured);
        }
      }
      setFen(game.fen());
      setThinking(false);
    }, 320);
  }

  function onSquareClick(square: Square) {
    if (thinking || game.turn() !== "w" || game.isGameOver() || winner) return;
    const piece = game.get(square);

    if (selected && legalTargets.has(square)) {
      const move = game.move({ from: selected, to: square, promotion: "q" });
      if (move) {
        setLastMove({ from: move.from, to: move.to });
        setSelected(null);
        afterPlayerMove(!!move.captured);
        return;
      }
    }

    if (piece && piece.color === "w") {
      if (square !== selected) sfx.click();
      setSelected(square === selected ? null : square);
    } else {
      setSelected(null);
    }
  }

  const board = game.board();

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {MODES.map((m) => (
          <button
            key={m.key}
            title={m.blurb}
            onClick={() => startGame(m.key)}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
              mode === m.key ? "bg-ember text-ink" : "border border-line-strong text-paper-dim hover:text-paper"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="inline-flex rounded-full border border-line-strong bg-ink-3 p-1 text-xs">
        {DIFFICULTIES.map((d) => (
          <button
            key={d.key}
            onClick={() => setDifficulty(d.key)}
            className={`rounded-full px-3 py-1 font-semibold transition ${
              difficulty === d.key ? "bg-paper text-ink" : "text-paper-dim hover:text-paper"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {mode === "threecheck" && (
        <div className="flex gap-4 font-mono text-[11px] text-paper-dim">
          <span>White checks: {checkCounts.w}/3</span>
          <span>Black checks: {checkCounts.b}/3</span>
        </div>
      )}

      <div className="relative grid aspect-square w-full max-w-[360px] grid-cols-8 overflow-hidden rounded-xl border border-line-strong shadow-xl shadow-black/40">
        {(winner || game.isGameOver()) && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-ink/85 backdrop-blur-sm">
            <p className="font-display text-lg font-semibold text-paper">
              {winner
                ? `${winner.color === "w" ? "White" : "Black"} wins`
                : game.isCheckmate()
                ? `Checkmate — ${game.turn() === "w" ? "black" : "white"} wins`
                : "Game over"}
            </p>
            {winner && <p className="max-w-[220px] text-center text-xs text-paper-dim">{winner.reason}</p>}
            <button
              onClick={() => startGame(mode)}
              className="rounded-full bg-ember px-4 py-2 text-xs font-semibold text-ink transition hover:brightness-110"
            >
              Play again
            </button>
          </div>
        )}
        {RANKS.map((rank, r) =>
          FILES.map((file, f) => {
            const square = `${file}${rank}` as Square;
            const piece = board[r][f];
            const dark = (r + f) % 2 === 1;
            const isSelected = selected === square;
            const isTarget = legalTargets.has(square);
            const isLast = lastMove && (lastMove.from === square || lastMove.to === square);
            const isHill = mode === "koth" && CENTER_SQUARES.has(square);

            return (
              <button
                key={square}
                onClick={() => onSquareClick(square)}
                className="relative flex aspect-square items-center justify-center"
                style={{ background: dark ? "var(--ink-3)" : "rgba(245,239,227,0.9)" }}
              >
                {isHill && <div className="absolute inset-1 rounded-sm border-2 border-dashed border-moss/60" />}
                {isLast && <div className="absolute inset-0 bg-ember/25" />}
                {isSelected && <div className="absolute inset-0 bg-ember/40" />}
                {isTarget && (
                  <div
                    className={`absolute rounded-full ${
                      piece ? "inset-1 border-4 border-ember/70" : "h-3 w-3 bg-ember/70"
                    }`}
                  />
                )}
                {piece && <ChessPiece type={piece.type as any} color={piece.color} size={38} />}
              </button>
            );
          })
        )}
      </div>

      <div className="flex w-full max-w-[360px] items-center justify-between">
        <AnimatePresence mode="wait">
          <motion.p
            key={status()}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="font-mono text-xs text-paper-dim"
          >
            {status()}
          </motion.p>
        </AnimatePresence>
        <button
          onClick={() => startGame(mode)}
          className="rounded-full border border-line-strong px-3 py-1 text-xs font-semibold text-paper-dim transition hover:text-paper"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
