// Pure Ludo rules engine — no React/DOM. All functions return new states (inputs are never mutated).
import { absOf, HOME, LAST_TRACK, SAFE_ABS, YARD, type Color } from "./board";

export type Mode = "classic" | "quick";
export type Difficulty = "easy" | "medium" | "hard";
export type Kind = "human" | "bot";

export interface PlayerCfg {
  color: Color;
  kind: Kind;
}

export interface Settings {
  mode: Mode;
  /** three sixes in a row forfeit the turn and cancel the last move */
  tripleSix: boolean;
  /** two tokens of one colour on a square form a block opponents can't pass or land on */
  blocks: boolean;
  /** move automatically when only one legal move exists (UI behaviour) */
  autoMove: boolean;
  /** keep playing after the first finisher until every rank is known */
  playOn: boolean;
  difficulty: Difficulty;
}

export const DEFAULT_SETTINGS: Settings = {
  mode: "classic",
  tripleSix: true,
  blocks: false,
  autoMove: true,
  playOn: false,
  difficulty: "medium",
};

export interface Snapshot {
  tokens: number[][];
  captures: number[];
}

export interface GameState {
  players: PlayerCfg[];
  settings: Settings;
  /** tokens[playerIndex][tokenIndex] = position (see board.ts) */
  tokens: number[][];
  turn: number;
  phase: "roll" | "move" | "over";
  /** the roll waiting to be used (phase "move"), else 0 */
  dice: number;
  /** consecutive sixes rolled in the current turn chain */
  sixes: number;
  /** state before the last move of this chain, for the three-sixes rule */
  undo: Snapshot | null;
  /** player indices in the order they finished */
  rank: number[];
  /** complete ranking once the game is over */
  finalRank: number[] | null;
  captures: number[];
  turns: number[];
  /** consecutive turns nobody could move (deadlock guard) */
  idle: number;
  stalemate: boolean;
}

export const tokensPerPlayer = (mode: Mode): number => (mode === "quick" ? 2 : 4);

export function newGame(players: PlayerCfg[], settings: Settings, rng: () => number = Math.random): GameState {
  const n = tokensPerPlayer(settings.mode);
  const first = Math.floor(rng() * players.length);
  const turns = players.map((_, i) => (i === first ? 1 : 0));
  return {
    players,
    settings,
    tokens: players.map(() => Array.from({ length: n }, () => YARD)),
    turn: first,
    phase: "roll",
    dice: 0,
    sixes: 0,
    undo: null,
    rank: [],
    finalRank: null,
    captures: players.map(() => 0),
    turns,
    idle: 0,
    stalemate: false,
  };
}

const IDLE_LIMIT = 120;

/** Does some opponent of `pi` hold a block (>=2 of one colour) on this absolute square? */
function blockedFor(s: GameState, pi: number, abs: number): boolean {
  for (let q = 0; q < s.players.length; q++) {
    if (q === pi) continue;
    let c = 0;
    const col = s.players[q].color;
    for (const p of s.tokens[q]) if (absOf(col, p) === abs) c++;
    if (c >= 2) return true;
  }
  return false;
}

/** Destination position for token t of player pi with roll d, or null when the move is illegal. */
export function targetOf(s: GameState, pi: number, t: number, d: number): number | null {
  const p = s.tokens[pi][t];
  const col = s.players[pi].color;
  if (p === HOME) return null;
  if (p === YARD) {
    if (d !== 6) return null;
    if (s.settings.blocks && blockedFor(s, pi, absOf(col, 0)!)) return null;
    return 0;
  }
  const np = p + d;
  if (np > HOME) return null;
  if (s.settings.blocks) {
    for (let q = p + 1; q <= Math.min(np, LAST_TRACK); q++) if (blockedFor(s, pi, absOf(col, q)!)) return null;
  }
  return np;
}

export function legalMovesFor(s: GameState, pi: number, d: number): number[] {
  const out: number[] = [];
  for (let t = 0; t < s.tokens[pi].length; t++) if (targetOf(s, pi, t, d) !== null) out.push(t);
  return out;
}

/** Legal token indices for the current roll (phase "move"). */
export function legalMoves(s: GameState): number[] {
  return s.phase === "move" ? legalMovesFor(s, s.turn, s.dice) : [];
}

export function progress(s: GameState, pi: number): number {
  return s.tokens[pi].reduce((a, p) => a + p + 1, 0);
}

const clone = (t: number[][]) => t.map((r) => r.slice());

function advanceTurn(s: GameState): GameState {
  const n = s.players.length;
  let next = s.turn;
  for (let i = 1; i <= n; i++) {
    const c = (s.turn + i) % n;
    if (!s.rank.includes(c)) {
      next = c;
      break;
    }
  }
  const turns = s.turns.slice();
  turns[next]++;
  return { ...s, turn: next, phase: "roll", dice: 0, sixes: 0, undo: null, turns };
}

function finishGame(s: GameState): GameState {
  const rest = s.players.map((_, i) => i).filter((i) => !s.rank.includes(i));
  rest.sort((a, b) => progress(s, b) - progress(s, a));
  return { ...s, phase: "over", dice: 0, finalRank: [...s.rank, ...rest] };
}

export type RollKind = "moves" | "nomoves" | "triple";

/** Apply a dice roll (value 1..6) for the current player. */
export function applyRoll(s: GameState, value: number): { state: GameState; kind: RollKind } {
  if (s.phase !== "roll") throw new Error("not in roll phase");
  const sixes = value === 6 ? s.sixes + 1 : 0;
  if (value === 6 && s.settings.tripleSix && sixes >= 3) {
    let st: GameState = { ...s, sixes: 0 };
    if (s.undo) st = { ...st, tokens: clone(s.undo.tokens), captures: s.undo.captures.slice() };
    st = { ...st, idle: st.idle + 1 };
    return { state: bumpIdle(advanceTurn(st)), kind: "triple" };
  }
  const withRoll: GameState = { ...s, sixes, dice: value, phase: "move" };
  if (legalMovesFor(withRoll, s.turn, value).length > 0) return { state: withRoll, kind: "moves" };
  return { state: bumpIdle(advanceTurn({ ...s, sixes: 0, idle: s.idle + 1 })), kind: "nomoves" };
}

function bumpIdle(s: GameState): GameState {
  if (s.idle >= IDLE_LIMIT) return { ...finishGame(s), stalemate: true };
  return s;
}

export interface MoveResult {
  state: GameState;
  pi: number;
  t: number;
  from: number;
  to: number;
  /** positions the token visits, in order (one per step) */
  path: number[];
  captured: { pi: number; t: number; from: number }[];
  enteredBoard: boolean;
  reachedHome: boolean;
  /** the mover finished all tokens */
  finished: boolean;
  /** the mover rolls again */
  bonus: boolean;
  gameOver: boolean;
}

/** Move token t of the current player by the pending roll. */
export function applyMove(s: GameState, t: number): MoveResult {
  if (s.phase !== "move") throw new Error("not in move phase");
  const pi = s.turn;
  const to = targetOf(s, pi, t, s.dice);
  if (to === null) throw new Error("illegal move");
  const col = s.players[pi].color;
  const from = s.tokens[pi][t];
  const tokens = clone(s.tokens);
  const captures = s.captures.slice();
  tokens[pi][t] = to;
  const path: number[] = from === YARD ? [0] : [];
  if (from !== YARD) for (let p = from + 1; p <= to; p++) path.push(p);
  const captured: MoveResult["captured"] = [];
  const abs = absOf(col, to);
  if (abs !== null && !SAFE_ABS.has(abs)) {
    for (let q = 0; q < s.players.length; q++) {
      if (q === pi) continue;
      const qc = s.players[q].color;
      for (let u = 0; u < tokens[q].length; u++) {
        if (absOf(qc, tokens[q][u]) === abs) {
          captured.push({ pi: q, t: u, from: tokens[q][u] });
          tokens[q][u] = YARD;
        }
      }
    }
    captures[pi] += captured.length;
  }
  const reachedHome = to === HOME;
  const finished = tokens[pi].every((p) => p === HOME);
  const bonus = !finished && (s.dice === 6 || captured.length > 0);
  let st: GameState = { ...s, tokens, captures, undo: { tokens: clone(s.tokens), captures: s.captures.slice() }, idle: 0 };
  let gameOver = false;
  if (finished) {
    st = { ...st, rank: [...st.rank, pi] };
    const remaining = st.players.map((_, i) => i).filter((i) => !st.rank.includes(i));
    const humansLeft = remaining.some((i) => st.players[i].kind === "human");
    if (remaining.length <= 1 || !st.settings.playOn || !humansLeft) {
      st = finishGame(st);
      gameOver = true;
    } else st = advanceTurn({ ...st, dice: 0 });
  } else if (bonus) {
    st = { ...st, phase: "roll", dice: 0 };
  } else {
    st = advanceTurn({ ...st, dice: 0 });
  }
  return { state: st, pi, t, from, to, path, captured, enteredBoard: from === YARD, reachedHome, finished, bonus, gameOver };
}

/** Is a token (by player/position) standing on a non-safe, shared square? helper for tests and AI. */
export function isSafePos(color: Color, pos: number): boolean {
  if (pos === YARD || pos === HOME || pos > LAST_TRACK) return true;
  return SAFE_ABS.has(absOf(color, pos)!);
}
