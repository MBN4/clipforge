"use client";

import { useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { motion, AnimatePresence } from "framer-motion";
import { pickBestMove } from "@/lib/games/chessAi";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

const GLYPHS: Record<string, string> = {
  wp: "♙", wn: "♘", wb: "♗", wr: "♖", wq: "♕", wk: "♔",
  bp: "♟", bn: "♞", bb: "♝", br: "♜", bq: "♛", bk: "♚",
};

export function Chessboard() {
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [selected, setSelected] = useState<Square | null>(null);
  const [thinking, setThinking] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  const game = gameRef.current;

  const legalTargets = useMemo(() => {
    if (!selected) return new Set<string>();
    const moves = game.moves({ square: selected, verbose: true });
    return new Set(moves.map((m) => m.to));
  }, [selected, fen, game]);

  function status(): string {
    if (game.isCheckmate()) return `Checkmate — ${game.turn() === "w" ? "black" : "white"} wins`;
    if (game.isStalemate()) return "Stalemate";
    if (game.isDraw()) return "Draw";
    if (thinking) return "Thinking…";
    if (game.isCheck()) return `${game.turn() === "w" ? "White" : "Black"} is in check`;
    return game.turn() === "w" ? "Your move" : "Black's move";
  }

  function afterPlayerMove() {
    setFen(game.fen());
    if (game.isGameOver() || game.turn() !== "b") return;
    setThinking(true);
    setTimeout(() => {
      const san = pickBestMove(game.fen(), 2);
      if (san) {
        const move = game.move(san);
        if (move) setLastMove({ from: move.from, to: move.to });
      }
      setFen(game.fen());
      setThinking(false);
    }, 280);
  }

  function onSquareClick(square: Square) {
    if (thinking || game.turn() !== "w" || game.isGameOver()) return;
    const piece = game.get(square);

    if (selected && legalTargets.has(square)) {
      const move = game.move({ from: selected, to: square, promotion: "q" });
      if (move) {
        setLastMove({ from: move.from, to: move.to });
        setSelected(null);
        afterPlayerMove();
        return;
      }
    }

    if (piece && piece.color === "w") {
      setSelected(square === selected ? null : square);
    } else {
      setSelected(null);
    }
  }

  function reset() {
    gameRef.current = new Chess();
    setFen(gameRef.current.fen());
    setSelected(null);
    setLastMove(null);
    setThinking(false);
  }

  const board = game.board();

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="grid aspect-square w-full max-w-[360px] grid-cols-8 overflow-hidden rounded-xl border border-line-strong shadow-xl shadow-black/40">
        {RANKS.map((rank, r) =>
          FILES.map((file, f) => {
            const square = `${file}${rank}` as Square;
            const piece = board[r][f];
            const dark = (r + f) % 2 === 1;
            const isSelected = selected === square;
            const isTarget = legalTargets.has(square);
            const isLast = lastMove && (lastMove.from === square || lastMove.to === square);

            return (
              <button
                key={square}
                onClick={() => onSquareClick(square)}
                className="relative flex aspect-square items-center justify-center"
                style={{ background: dark ? "var(--ink-3)" : "rgba(245,239,227,0.9)" }}
              >
                {isLast && <div className="absolute inset-0 bg-ember/25" />}
                {isSelected && <div className="absolute inset-0 bg-ember/40" />}
                {isTarget && (
                  <div
                    className={`absolute rounded-full ${
                      piece ? "inset-1 border-4 border-ember/70" : "h-3 w-3 bg-ember/70"
                    }`}
                  />
                )}
                {piece && (
                  <span
                    className="relative text-3xl leading-none sm:text-4xl"
                    style={{
                      color: piece.color === "w" ? "#f5efe3" : "#141210",
                      filter:
                        piece.color === "w"
                          ? "drop-shadow(0 1px 1px rgba(0,0,0,0.8))"
                          : "drop-shadow(0 1px 1px rgba(245,239,227,0.5))",
                    }}
                  >
                    {GLYPHS[`${piece.color}${piece.type}`]}
                  </span>
                )}
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
          onClick={reset}
          className="rounded-full border border-line-strong px-3 py-1 text-xs font-semibold text-paper-dim transition hover:text-paper"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
