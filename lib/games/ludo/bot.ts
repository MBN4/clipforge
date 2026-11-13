// Bot move selection (pure). Easy: mostly random. Medium: priority heuristic.
// Hard: same priorities plus risk-awareness (avoid stopping 1-6 squares ahead of opponents).
import { absOf, HOME, LAST_TRACK, TRACK_LEN, YARD } from "./board";
import { applyMove, isSafePos, legalMoves, type Difficulty, type GameState } from "./engine";

/** Opponent tokens that could hit a token of `pi` standing at absolute square `abs` with one roll of 1-6. */
function threats(s: GameState, pi: number, abs: number, tokens: number[][]): number {
  let n = 0;
  for (let q = 0; q < s.players.length; q++) {
    if (q === pi) continue;
    const qc = s.players[q].color;
    for (const p of tokens[q]) {
      if (p < 0 || p > LAST_TRACK) continue;
      const at = absOf(qc, p)!;
      const d = (abs - at + TRACK_LEN) % TRACK_LEN;
      if (d >= 1 && d <= 6 && p + d <= LAST_TRACK) n++;
    }
  }
  return n;
}

function dangerAt(s: GameState, pi: number, pos: number, tokens: number[][]): number {
  if (isSafePos(s.players[pi].color, pos)) return 0;
  return threats(s, pi, absOf(s.players[pi].color, pos)!, tokens);
}

/** Rival tokens 1-6 squares ahead of absolute-position `pos` for player pi (capturable targets next turn). */
function chasing(s: GameState, pi: number, pos: number): number {
  const col = s.players[pi].color;
  const abs = absOf(col, pos);
  if (abs === null || pos >= LAST_TRACK) return 0;
  let n = 0;
  for (let q = 0; q < s.players.length; q++) {
    if (q === pi) continue;
    const qc = s.players[q].color;
    for (const p of s.tokens[q]) {
      const a = absOf(qc, p);
      if (a === null || isSafePos(qc, p)) continue;
      const d = (a - abs + TRACK_LEN) % TRACK_LEN;
      if (d >= 1 && d <= 6 && pos + d <= LAST_TRACK) n++;
    }
  }
  return n;
}

export function scoreMove(s: GameState, t: number, difficulty: Difficulty): number {
  const pi = s.turn;
  const res = applyMove(s, t);
  const { from, to } = res;
  let score = 0;
  if (res.reachedHome) score += 1000;
  if (res.captured.length) score += 800 + res.captured.reduce((a, c) => a + Math.max(0, c.from), 0) * 2;
  if (from === YARD) score += 600;
  const wasSafe = isSafePos(s.players[pi].color, from);
  const nowSafe = isSafePos(s.players[pi].color, to);
  if (nowSafe && !wasSafe && to !== HOME) score += 300;
  const dangerBefore = dangerAt(s, pi, from, s.tokens);
  const dangerAfter = dangerAt(s, pi, to, res.state.tokens);
  if (dangerBefore > 0 && dangerAfter === 0) score += 250 + from;
  score += to; // push the leader
  if (difficulty === "hard") {
    score -= dangerAfter * 250;
    if (dangerAfter > 0 && dangerBefore === 0) score -= 80;
    score += chasing(s, pi, to) * 45; // sit behind a rival to threaten a capture next turn
  } else {
    score -= dangerAfter * 40;
  }
  return score;
}

/** Choose a token index to move; the state must be in phase "move" with at least one legal move. */
export function chooseMove(s: GameState, difficulty: Difficulty = s.settings.difficulty, rng: () => number = Math.random): number {
  const moves = legalMoves(s);
  if (moves.length === 0) throw new Error("no legal moves");
  if (moves.length === 1) return moves[0];
  if (difficulty === "easy" && rng() < 0.75) return moves[Math.floor(rng() * moves.length)];
  let best = moves[0];
  let bestScore = -Infinity;
  for (const t of moves) {
    const sc = scoreMove(s, t, difficulty) + rng() * (difficulty === "hard" ? 0.5 : 6);
    if (sc > bestScore) {
      bestScore = sc;
      best = t;
    }
  }
  return best;
}
