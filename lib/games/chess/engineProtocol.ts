// Messages between the UI and the engine (worker or main-thread fallback), plus the handler that
// runs a request. Pure TS: the worker and the fallback both call `runEngineRequest`.
import { botById, chooseBotMove } from "./bots";
import { Position, type Variant } from "./position";
import { MATE_BOUND, Searcher, mateIn } from "./search";

export interface EngineRequestBase {
  id: number;
  fen: string;
  variant: Variant;
  chess960: boolean;
  /** [hashLo, hashHi] of earlier positions in the game (repetition detection) */
  history: [number, number][];
}
export interface BotRequest extends EngineRequestBase {
  kind: "bot";
  botId: string;
  plyCount: number;
  /** cap on think time for strong bots (clock management) */
  maxTimeMs?: number;
}
export interface AnalyzeRequest extends EngineRequestBase {
  kind: "analyze";
  timeMs: number;
}
export type EngineRequest = BotRequest | AnalyzeRequest;

export interface EngineResponse {
  id: number;
  /** best / chosen move as UCI (960 castling = king→rook) */
  uci: string | null;
  /** score from WHITE's point of view in centipawns */
  whiteScore: number;
  /** moves to mate from white's POV (+ white mates), or null */
  mate: number | null;
  error?: string;
}

let searcher: Searcher | null = null;

export function runEngineRequest(req: EngineRequest): EngineResponse {
  try {
    if (!searcher) searcher = new Searcher();
    const pos = Position.fromFen(req.fen, req.variant, req.chess960);
    searcher.setGameHistory(req.history);
    let move = 0;
    let score = 0;
    if (req.kind === "bot") {
      const bot = botById(req.botId);
      const def = req.maxTimeMs !== undefined && bot.timeMs > 0 ? { ...bot, timeMs: Math.max(60, Math.min(bot.timeMs, req.maxTimeMs)) } : bot;
      const r = chooseBotMove(searcher, pos, def, Math.random, req.plyCount);
      move = r.move;
      score = r.score;
    } else {
      const r = searcher.search(pos, { timeMs: req.timeMs, maxDepth: 30 });
      move = r.move;
      score = r.score;
    }
    const white = pos.side === 0 ? score : -score;
    const mate = Math.abs(score) > MATE_BOUND ? (pos.side === 0 ? mateIn(score) : -mateIn(score)) : null;
    return { id: req.id, uci: move ? pos.uci(move) : null, whiteScore: white, mate };
  } catch (e) {
    return { id: req.id, uci: null, whiteScore: 0, mate: null, error: String(e) };
  }
}
