// A chess game: start position, the move list (with SAN), every intermediate position (for history
// navigation, takebacks and repetition), and result detection for all supported variants.
import {
  BISHOP,
  BLACK,
  F_CAPTURE,
  F_CASTLE,
  KING,
  KNIGHT,
  PAWN,
  Position,
  QUEEN,
  ROOK,
  WHITE,
  isHill,
  moveFlags,
  moveFrom,
  movePromo,
  moveTo,
  pieceColor,
  pieceType,
  sqFile,
  sqRank,
  type Color,
  type Variant,
} from "./position";

export type EndReason =
  | "checkmate"
  | "stalemate"
  | "insufficient"
  | "repetition"
  | "fifty"
  | "timeout"
  | "timeout-insufficient"
  | "resign"
  | "agreement"
  | "koth"
  | "threecheck";

export interface GameResult {
  /** winning colour, or null for a draw */
  winner: Color | null;
  reason: EndReason;
}

export interface PlayedMove {
  move: number;
  san: string;
  uci: string;
  color: Color;
  /** piece type captured (0 = none) */
  captured: number;
  check: boolean;
  /** piece type that moved */
  piece: number;
}

export class Game {
  readonly startFen: string;
  readonly variant: Variant;
  readonly chess960: boolean;
  positions: Position[];
  moves: PlayedMove[] = [];
  result: GameResult | null = null;

  constructor(startFen: string, variant: Variant = "standard", chess960 = false) {
    this.startFen = startFen;
    this.variant = variant;
    this.chess960 = chess960;
    this.positions = [Position.fromFen(startFen, variant, chess960)];
    this.result = this.detectResult();
  }

  get pos(): Position {
    return this.positions[this.positions.length - 1];
  }
  get turn(): Color {
    return this.pos.side;
  }
  get ply(): number {
    return this.moves.length;
  }

  legalMoves(): number[] {
    return this.result ? [] : this.pos.legalMoves();
  }

  /** Play a legal move. Returns the recorded move, or null if illegal / game over. */
  play(m: number): PlayedMove | null {
    if (this.result) return null;
    const p = this.pos;
    const legal = p.legalMoves();
    if (!legal.includes(m)) return null;
    const san = p.san(m, legal);
    const uci = p.uci(m);
    const next = p.clone();
    const piece = pieceType(p.board[moveFrom(m)]);
    next.make(m);
    const captured = moveFlags(m) & F_CASTLE ? 0 : pieceType(next.lastCaptured());
    const pm: PlayedMove = { move: m, san, uci, color: p.side, captured, check: next.inCheck(), piece };
    // a fresh Position with an empty undo stack keeps snapshots independent
    this.positions.push(next);
    this.moves.push(pm);
    this.result = this.detectResult();
    return pm;
  }

  /** Undo the last `n` plies (clears a result). */
  undo(n = 1) {
    for (let i = 0; i < n && this.moves.length; i++) {
      this.moves.pop();
      this.positions.pop();
    }
    this.result = this.detectResult();
  }

  /** Declare an external result (resign / timeout / agreement). */
  end(result: GameResult) {
    if (!this.result) this.result = result;
  }

  repetitionCount(): number {
    const k = this.pos.key();
    let n = 0;
    for (const p of this.positions) if (p.key() === k) n++;
    return n;
  }

  detectResult(): GameResult | null {
    const p = this.pos;
    const mover = (p.side ^ 1) as Color;
    if (this.moves.length) {
      if (this.variant === "koth" && isHill(p.kings[mover])) return { winner: mover, reason: "koth" };
      if (this.variant === "threecheck" && p.checks[mover] >= 3) return { winner: mover, reason: "threecheck" };
    }
    if (!p.hasLegalMove()) {
      return p.inCheck() ? { winner: mover, reason: "checkmate" } : { winner: null, reason: "stalemate" };
    }
    if (insufficientMaterial(p)) return { winner: null, reason: "insufficient" };
    if (p.halfmove >= 100) return { winner: null, reason: "fifty" };
    if (this.repetitionCount() >= 3) return { winner: null, reason: "repetition" };
    return null;
  }

  /** Result when `flagged` runs out of time. */
  timeoutResult(flagged: Color): GameResult {
    const other = (flagged ^ 1) as Color;
    if (!canEverWin(this.pos, other)) return { winner: null, reason: "timeout-insufficient" };
    return { winner: other, reason: "timeout" };
  }

  /** Captured pieces (by the colour that captured them) + material balance (white - black, pawns=1). */
  material(ply = this.ply) {
    const p = this.positions[ply];
    const counts = [
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
    ];
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) continue;
      const pc = p.board[s];
      if (pc) counts[pieceColor(pc)][pieceType(pc)]++;
    }
    const start = this.positions[0];
    const init = [
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
    ];
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) continue;
      const pc = start.board[s];
      if (pc) init[pieceColor(pc)][pieceType(pc)]++;
    }
    const VAL = [0, 1, 3, 3, 5, 9, 0];
    // captured[c] = pieces of the opponent that colour c has taken. Promotions can make "missing" negative: clamp.
    const captured: number[][] = [[], []];
    for (const c of [WHITE, BLACK] as Color[]) {
      const opp = c ^ 1;
      for (const t of [QUEEN, ROOK, BISHOP, KNIGHT, PAWN]) {
        let missing = init[opp][t] - counts[opp][t];
        if (t === PAWN) {
          // promoted pawns appear as extra pieces: count them as captured pawns only when really taken
          let promoted = 0;
          for (const u of [QUEEN, ROOK, BISHOP, KNIGHT]) promoted += Math.max(0, counts[opp][u] - init[opp][u]);
          missing -= promoted;
        }
        for (let i = 0; i < missing; i++) captured[c].push(t);
      }
    }
    let score = 0;
    for (let t = PAWN; t <= QUEEN; t++) score += VAL[t] * (counts[WHITE][t] - counts[BLACK][t]);
    return { captured, balance: score };
  }

  /** Did the last move at `ply` (1-based ply count) capture/castle/promote/check? */
  moveAt(ply: number): PlayedMove | undefined {
    return this.moves[ply - 1];
  }
}

/** Dead-position rules used by chess.com: K v K, K+minor v K, K+B v K+B with same-coloured bishops. */
export function insufficientMaterial(p: Position): boolean {
  if (p.variant === "koth") return false; // the king can always walk to the hill
  const minors: { c: Color; t: number; sqColor: number }[] = [];
  for (let s = 0; s < 128; s++) {
    if (s & 0x88) continue;
    const pc = p.board[s];
    if (!pc) continue;
    const t = pieceType(pc);
    if (t === KING) continue;
    if (t === PAWN || t === ROOK || t === QUEEN) return false;
    minors.push({ c: pieceColor(pc), t, sqColor: (sqFile(s) + sqRank(s)) & 1 });
  }
  if (p.variant === "threecheck") return minors.length === 0; // a lone minor can still give checks
  if (minors.length <= 1) return true;
  // only bishops, all on the same colour → no mate possible
  return minors.every((m) => m.t === BISHOP) && minors.every((m) => m.sqColor === minors[0].sqColor);
}

/** Can colour `c` still possibly win (has mating material)? Used for timeout-vs-insufficient-material. */
export function canEverWin(p: Position, c: Color): boolean {
  if (p.variant === "koth") return true;
  let minors = 0;
  for (let s = 0; s < 128; s++) {
    if (s & 0x88) continue;
    const pc = p.board[s];
    if (!pc || pieceColor(pc) !== c) continue;
    const t = pieceType(pc);
    if (t === PAWN || t === ROOK || t === QUEEN) return true;
    if (t === KNIGHT || t === BISHOP) minors++;
  }
  if (p.variant === "threecheck") return minors > 0;
  return minors >= 2;
}

export const isCaptureMove = (m: number) => (moveFlags(m) & F_CAPTURE) !== 0;
export { moveFrom, moveTo, movePromo };

export function resultText(r: GameResult): string {
  switch (r.reason) {
    case "checkmate":
      return "by checkmate";
    case "stalemate":
      return "by stalemate";
    case "insufficient":
      return "by insufficient material";
    case "repetition":
      return "by repetition";
    case "fifty":
      return "by the 50-move rule";
    case "timeout":
      return "on time";
    case "timeout-insufficient":
      return "timeout vs insufficient material";
    case "resign":
      return "by resignation";
    case "agreement":
      return "by agreement";
    case "koth":
      return "king reached the hill";
    case "threecheck":
      return "by three checks";
  }
}
