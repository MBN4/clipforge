import { Chess, type Move } from "chess.js";

const PIECE_VALUES: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

// Small positional nudge tables (white's perspective; mirrored for black).
const PAWN_TABLE = [
  0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, -10, -10, 10, 10, 5, 5, -5, -10, 0, 0, -10, -5, 5, 0, 0, 0,
  20, 20, 0, 0, 0, 5, 5, 10, 25, 25, 10, 5, 5, 10, 10, 20, 30, 30, 20, 10, 10, 50, 50, 50, 50, 50,
  50, 50, 50, 0, 0, 0, 0, 0, 0, 0, 0,
];

function evaluateBoard(game: Chess): number {
  if (game.isCheckmate()) return game.turn() === "w" ? -100000 : 100000;
  if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition()) return 0;

  let score = 0;
  const board = game.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const sq = board[r][f];
      if (!sq) continue;
      const base = PIECE_VALUES[sq.type] ?? 0;
      let positional = 0;
      if (sq.type === "p") {
        const idx = sq.color === "w" ? r * 8 + f : (7 - r) * 8 + f;
        positional = PAWN_TABLE[idx] ?? 0;
      }
      const value = base + positional;
      score += sq.color === "w" ? value : -value;
    }
  }
  return score;
}

function orderMoves(moves: Move[]): Move[] {
  return [...moves].sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));
}

function negamax(game: Chess, depth: number, alpha: number, beta: number, sign: 1 | -1): number {
  if (depth === 0 || game.isGameOver()) {
    return sign * evaluateBoard(game);
  }
  let best = -Infinity;
  const moves = orderMoves(game.moves({ verbose: true }) as Move[]);
  for (const m of moves) {
    game.move(m.san);
    const score = -negamax(game, depth - 1, -beta, -alpha, (sign * -1) as 1 | -1);
    game.undo();
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export type Difficulty = "easy" | "medium" | "hard";

const DIFFICULTY_SETTINGS: Record<Difficulty, { depth: number; blunderChance: number }> = {
  easy: { depth: 1, blunderChance: 0.35 },
  medium: { depth: 2, blunderChance: 0.05 },
  hard: { depth: 3, blunderChance: 0 },
};

/** Picks a move for the side to move, searching ahead according to `difficulty`. */
export function pickBestMove(fen: string, difficulty: Difficulty = "medium"): string | null {
  const game = new Chess(fen);
  const moves = orderMoves(game.moves({ verbose: true }) as Move[]);
  if (!moves.length) return null;

  const { depth, blunderChance } = DIFFICULTY_SETTINGS[difficulty];

  if (Math.random() < blunderChance) {
    return moves[Math.floor(Math.random() * moves.length)].san;
  }

  const sign: 1 | -1 = game.turn() === "w" ? 1 : -1;
  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const m of moves) {
    game.move(m.san);
    const score = -negamax(game, depth - 1, -Infinity, Infinity, (sign * -1) as 1 | -1);
    game.undo();
    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
  }

  return bestMove.san;
}
