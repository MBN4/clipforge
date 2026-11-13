// A match = a Game + players + clocks. Pure and time-injected (pass `now`) so it is testable in node.
// Clock rule (lichess-style): no clock runs until both sides have made their first move.
import { Game, type GameResult, type PlayedMove } from "./game";
import { START_FEN, chess960Fen, type Color, type Variant } from "./position";

export type ModeId = "bot" | "pass" | "960" | "koth" | "threecheck" | "ladder";

export interface TimeControl {
  id: string;
  label: string;
  group: string;
  /** base ms (0 = unlimited) */
  base: number;
  inc: number;
}

export const TIME_CONTROLS: TimeControl[] = [
  { id: "none", label: "No clock", group: "Casual", base: 0, inc: 0 },
  { id: "1+0", label: "1 min", group: "Bullet", base: 60_000, inc: 0 },
  { id: "3+0", label: "3 min", group: "Blitz", base: 180_000, inc: 0 },
  { id: "3+2", label: "3 | 2", group: "Blitz", base: 180_000, inc: 2_000 },
  { id: "5+0", label: "5 min", group: "Blitz", base: 300_000, inc: 0 },
  { id: "10+0", label: "10 min", group: "Rapid", base: 600_000, inc: 0 },
  { id: "15+10", label: "15 | 10", group: "Rapid", base: 900_000, inc: 10_000 },
];
export const tcById = (id: string) => TIME_CONTROLS.find((t) => t.id === id) ?? TIME_CONTROLS[0];

export interface MatchConfig {
  mode: ModeId;
  /** opponent bot (bot / 960 / koth / threecheck / ladder) */
  botId: string;
  /** the human's colour (pass & play: the bottom side at start) */
  humanColor: Color;
  tc: TimeControl;
  /** Chess960 start position number */
  pos960?: number;
}

export const modeVariant = (m: ModeId): Variant => (m === "koth" ? "koth" : m === "threecheck" ? "threecheck" : "standard");
export const isVsBot = (m: ModeId) => m !== "pass";

export function startFenFor(cfg: MatchConfig): string {
  return cfg.mode === "960" ? chess960Fen(cfg.pos960 ?? 518) : START_FEN;
}

export class Match {
  readonly cfg: MatchConfig;
  readonly game: Game;
  /** remaining ms per colour, as of `turnStart` */
  clocks: [number, number];
  /** clocks after each ply (index = ply) for takebacks */
  clockHist: [number, number][];
  /** when the side to move's clock started running (null = not running) */
  turnStart: number | null = null;

  constructor(cfg: MatchConfig) {
    this.cfg = cfg;
    this.game = new Game(startFenFor(cfg), modeVariant(cfg.mode), cfg.mode === "960");
    this.clocks = [cfg.tc.base, cfg.tc.base];
    this.clockHist = [[cfg.tc.base, cfg.tc.base]];
  }

  get timed() {
    return this.cfg.tc.base > 0;
  }
  get over() {
    return this.game.result !== null;
  }

  remaining(c: Color, now: number): number {
    if (!this.timed) return Infinity;
    const base = this.clocks[c];
    if (this.turnStart !== null && this.game.turn === c && !this.over) return Math.max(0, base - (now - this.turnStart));
    return Math.max(0, base);
  }

  play(m: number, now: number): PlayedMove | null {
    if (this.over) return null;
    if (this.timed && this.checkFlag(now)) return null;
    const mover = this.game.turn;
    const left = this.remaining(mover, now);
    const pm = this.game.play(m);
    if (!pm) return null;
    if (this.timed) {
      this.clocks[mover] = left === Infinity ? 0 : left + (this.game.ply > 2 ? this.cfg.tc.inc : 0);
      if (this.game.ply >= 2) this.turnStart = now;
    }
    this.clockHist.push([this.clocks[0], this.clocks[1]]);
    if (this.over) this.turnStart = null;
    return pm;
  }

  /** Ends the game on time if the side to move has flagged. Returns true if it did. */
  checkFlag(now: number): boolean {
    if (!this.timed || this.over || this.turnStart === null) return false;
    const c = this.game.turn;
    if (this.remaining(c, now) > 0) return false;
    this.clocks[c] = 0;
    this.game.end(this.game.timeoutResult(c));
    this.turnStart = null;
    return true;
  }

  /** Take back `n` plies; clocks return to what they were, the side to move's clock restarts now. */
  takeback(n: number, now: number) {
    const k = Math.min(n, this.game.ply);
    if (k <= 0) return;
    this.game.undo(k);
    this.clockHist.length = this.game.ply + 1;
    const c = this.clockHist[this.game.ply];
    this.clocks = [c[0], c[1]];
    this.turnStart = this.timed && this.game.ply >= 2 ? now : null;
  }

  resign(c: Color) {
    this.finish({ winner: (c ^ 1) as Color, reason: "resign" });
  }
  agreeDraw() {
    this.finish({ winner: null, reason: "agreement" });
  }
  private finish(r: GameResult) {
    if (this.over) return;
    this.game.end(r);
    this.turnStart = null;
  }
}
