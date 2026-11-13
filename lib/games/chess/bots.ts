// Bot personalities (chess.com-style) and the human-like move picker built on the engine.
// Weak bots don't play random garbage: they score every move with a shallow search and pick among the
// decent ones with a temperature, and sometimes "miss" a deeper tactic by looking only one ply ahead.
// From 800 up a blunder guard stops them from hanging the queen (or a rook) in one move.
import { MATE_BOUND, Searcher, type SearchResult } from "./search";
import type { Position } from "./position";

export interface BotDef {
  id: string;
  name: string;
  emoji: string;
  rating: number;
  blurb: string;
  /** search depth for the scored-moves picker (human-like levels) */
  depth: number;
  /** think time for strong levels (ms); 0 = use the human-like picker */
  timeMs: number;
  /** softmax temperature in centipawns: higher → more inaccuracies */
  temperature: number;
  /** chance per move of only looking `blunderDepth` plies ahead */
  blunderRate: number;
  blunderDepth: number;
  /** never choose a move that loses more than this many cp vs the best at a 2-ply look (0 = no guard) */
  guard: number;
}

export const BOTS: BotDef[] = [
  { id: "pip", name: "Pip", emoji: "🐣", rating: 400, blurb: "Just learned how the horsey moves.", depth: 1, timeMs: 0, temperature: 140, blunderRate: 0.45, blunderDepth: 0, guard: 0 },
  { id: "rusty", name: "Rusty", emoji: "🤖", rating: 800, blurb: "Loves to attack, forgets to defend.", depth: 2, timeMs: 0, temperature: 70, blunderRate: 0.25, blunderDepth: 1, guard: 650 },
  { id: "nova", name: "Nova", emoji: "🦊", rating: 1200, blurb: "Tricky club player. Watch for forks.", depth: 3, timeMs: 0, temperature: 35, blunderRate: 0.12, blunderDepth: 1, guard: 450 },
  { id: "sage", name: "Sage", emoji: "🦉", rating: 1600, blurb: "Solid, patient, punishes mistakes.", depth: 4, timeMs: 0, temperature: 14, blunderRate: 0.05, blunderDepth: 2, guard: 250 },
  { id: "titan", name: "Titan", emoji: "🐉", rating: 2000, blurb: "Calculates deep. Rarely errs.", depth: 64, timeMs: 900, temperature: 0, blunderRate: 0, blunderDepth: 0, guard: 0 },
  { id: "max", name: "Max", emoji: "👑", rating: 2400, blurb: "Full strength engine. Good luck.", depth: 64, timeMs: 2500, temperature: 0, blunderRate: 0, blunderDepth: 0, guard: 0 },
];

export const botById = (id: string) => BOTS.find((b) => b.id === id) ?? BOTS[2];

export type Rng = () => number;

export interface BotMove {
  move: number;
  /** engine eval of the position from the bot's point of view (cp) */
  score: number;
}

function pickSoftmax(scored: { move: number; score: number }[], temperature: number, rng: Rng) {
  if (temperature <= 0 || scored.length === 1) return scored[0];
  const best = scored[0].score;
  // mates dominate everything
  if (best > MATE_BOUND) return scored[0];
  const ws = scored.map((s) => Math.exp(Math.max(-30, (s.score - best) / temperature)));
  const total = ws.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < scored.length; i++) {
    r -= ws[i];
    if (r <= 0) return scored[i];
  }
  return scored[0];
}

export function chooseBotMove(searcher: Searcher, pos: Position, bot: BotDef, rng: Rng = Math.random, plyCount = 99): BotMove {
  if (bot.timeMs > 0) {
    // strong bots: a little opening variety among near-equal moves, otherwise the engine's best move
    if (plyCount < 8) {
      const scored = searcher.scoreRootMoves(pos, 3);
      const near = scored.filter((s) => s.score >= scored[0].score - 25);
      if (near.length > 1) {
        const pick = near[Math.floor(rng() * near.length)];
        return { move: pick.move, score: pick.score };
      }
    }
    const r: SearchResult = searcher.search(pos, { timeMs: bot.timeMs, maxDepth: bot.depth });
    return { move: r.move, score: r.score };
  }
  const full = searcher.scoreRootMoves(pos, bot.depth);
  if (full.length === 0) return { move: 0, score: 0 };
  let pool = full;
  if (bot.blunderRate > 0 && rng() < bot.blunderRate && full[0].score < MATE_BOUND) {
    // tunnel vision: judge moves by a shallower look (static eval only for the weakest bot)
    pool = bot.blunderDepth <= 0 ? searcher.scoreRootMoves(pos, 0) : searcher.scoreRootMoves(pos, bot.blunderDepth);
  }
  let pick = pickSoftmax(pool, bot.temperature, rng);
  if (bot.guard > 0) {
    const guardScores = bot.depth >= 2 ? full : searcher.scoreRootMoves(pos, 2);
    const best = guardScores[0].score;
    const mine = guardScores.find((s) => s.move === pick.move);
    if (mine && mine.score < best - bot.guard) {
      // fall back to a random move among the "safe" ones, still human-like
      const safe = guardScores.filter((s) => s.score >= best - bot.guard);
      pick = pickSoftmax(safe, bot.temperature, rng);
    }
  }
  const real = full.find((s) => s.move === pick.move) ?? pick;
  return { move: pick.move, score: real.score };
}
