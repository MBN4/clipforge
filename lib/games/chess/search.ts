// Alpha-beta engine: iterative deepening, PVS, transposition table, quiescence search, null-move pruning,
// late-move reductions, check extensions, MVV-LVA + killer + history move ordering, and a time budget.
// Knows the King-of-the-Hill and Three-Check win conditions. Pure TS — runs in a Worker or in node.
import { evaluate, ORDER_VAL } from "./evaluate";
import { insufficientMaterial } from "./game";
import {
  F_CAPTURE,
  F_EP,
  KING,
  PAWN,
  type Position,
  isHill,
  moveFlags,
  moveFrom,
  movePromo,
  moveTo,
  pieceType,
} from "./position";

export const MATE = 30000;
export const MATE_BOUND = MATE - 1000;
const INF = 32000;
const MAX_PLY = 96;

const TT_BITS = 19;
const TT_SIZE = 1 << TT_BITS;
const TT_MASK = TT_SIZE - 1;
const EXACT = 1;
const LOWER = 2;
const UPPER = 3;

export interface SearchLimits {
  maxDepth?: number;
  timeMs?: number;
  /** hard node cap */
  maxNodes?: number;
}

export interface SearchResult {
  move: number;
  /** centipawns from the side to move's point of view (mate scores ±(MATE - plies)) */
  score: number;
  depth: number;
  nodes: number;
  pv: number[];
}

class Abort extends Error {}

export class Searcher {
  private ttKey = new Int32Array(TT_SIZE);
  private ttMove = new Int32Array(TT_SIZE);
  private ttScore = new Int16Array(TT_SIZE);
  private ttDepth = new Int8Array(TT_SIZE);
  private ttFlag = new Int8Array(TT_SIZE);
  private killers = new Int32Array(MAX_PLY * 2);
  private history = new Int32Array(128 * 128);
  private stackLo = new Int32Array(MAX_PLY + 600);
  private stackHi = new Int32Array(MAX_PLY + 600);
  private stackLen = 0;
  private gameLen = 0;
  nodes = 0;
  private deadline = 0;
  private maxNodes = Infinity;
  private pos!: Position;
  private stopped = false;

  clear() {
    this.ttKey.fill(0);
    this.ttFlag.fill(0);
    this.history.fill(0);
  }

  /** `history` = repetition keys of earlier game positions [lo, hi] (excluding the current one). */
  setGameHistory(hist: [number, number][]) {
    const h = hist.slice(-500);
    for (let i = 0; i < h.length; i++) {
      this.stackLo[i] = h[i][0];
      this.stackHi[i] = h[i][1];
    }
    this.gameLen = h.length;
  }

  search(pos: Position, limits: SearchLimits): SearchResult {
    this.pos = pos;
    this.nodes = 0;
    this.stopped = false;
    this.killers.fill(0);
    for (let i = 0; i < this.history.length; i++) this.history[i] >>= 2;
    const start = Date.now();
    this.deadline = limits.timeMs ? start + limits.timeMs : Infinity;
    this.maxNodes = limits.maxNodes ?? Infinity;
    const maxDepth = Math.min(limits.maxDepth ?? 64, MAX_PLY - 4);
    const roots = pos.legalMoves();
    let best: SearchResult = { move: roots[0] ?? 0, score: 0, depth: 0, nodes: 0, pv: roots[0] ? [roots[0]] : [] };
    if (roots.length === 0) return best;
    for (let depth = 1; depth <= maxDepth; depth++) {
      try {
        this.stackLen = this.gameLen;
        const score = this.negamax(depth, -INF, INF, 0, true);
        const pv = this.extractPv(depth);
        if (pv.length && roots.includes(pv[0])) best = { move: pv[0], score, depth, nodes: this.nodes, pv };
        // stop early on a found mate or when the next iteration surely won't finish
        if (Math.abs(score) > MATE_BOUND && depth > MATE - Math.abs(score) + 1) break;
        if (roots.length === 1 && depth >= 4) break;
        if (this.deadline !== Infinity && Date.now() - start > (this.deadline - start) * 0.55) break;
      } catch (e) {
        if (!(e instanceof Abort)) throw e;
        // restore the position: unwind whatever the aborted search left made
        break;
      }
    }
    best.nodes = this.nodes;
    return best;
  }

  /** Score every root move with a full-window search of `depth` (used by the human-like bots). */
  scoreRootMoves(pos: Position, depth: number): { move: number; score: number }[] {
    this.pos = pos;
    this.stopped = false;
    this.deadline = Infinity;
    this.maxNodes = Infinity;
    this.killers.fill(0);
    this.stackLen = this.gameLen;
    const out: { move: number; score: number }[] = [];
    const us = pos.side;
    for (const m of pos.genPseudo([])) {
      pos.make(m);
      if (pos.isAttacked(pos.kings[us], (us ^ 1) as 0 | 1)) {
        pos.unmake();
        continue;
      }
      this.push();
      let s: number;
      if (depth <= 0) s = this.variantLoss() ? MATE - 1 : -evaluate(pos);
      else if (depth === 1) s = -this.qsearch(-INF, INF, 1, 0);
      else s = -this.negamax(depth - 1, -INF, INF, 1, true);
      if (depth <= 0 && !pos.hasLegalMove()) s = pos.inCheck() ? MATE - 1 : 0;
      this.stackLen--;
      pos.unmake();
      out.push({ move: m, score: s });
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  }

  private push() {
    this.stackLo[this.stackLen] = this.pos.hashLo;
    this.stackHi[this.stackLen] = this.pos.hashHi;
    this.stackLen++;
  }

  private isRepetition(): boolean {
    const p = this.pos;
    const lo = p.hashLo;
    const hi = p.hashHi;
    // only positions since the last irreversible move can repeat
    const lim = Math.max(0, this.stackLen - 1 - p.halfmove);
    for (let i = this.stackLen - 2; i >= lim; i--) if (this.stackLo[i] === lo && this.stackHi[i] === hi) return true;
    return false;
  }

  private checkTime() {
    if ((this.nodes & 1023) === 0) {
      if (Date.now() > this.deadline || this.nodes > this.maxNodes) {
        this.stopped = true;
      }
    }
    if (this.stopped) throw new Abort();
  }

  /** Variant terminal check: has the side that just moved already won? */
  private variantLoss(): boolean {
    const p = this.pos;
    const them = p.side ^ 1;
    if (p.variant === "koth") return isHill(p.kings[them]);
    if (p.variant === "threecheck") return p.checks[them] >= 3;
    return false;
  }

  private negamax(depth: number, alpha: number, beta: number, ply: number, allowNull: boolean): number {
    const p = this.pos;
    this.nodes++;
    if (this.stopped || (this.nodes & 1023) === 0) this.checkTime();
    if (ply > 0) {
      if (this.variantLoss()) return -MATE + ply;
      if (p.halfmove >= 100 || this.isRepetition() || insufficientMaterial(p)) return 0;
      // mate distance pruning
      alpha = Math.max(alpha, -MATE + ply);
      beta = Math.min(beta, MATE - ply - 1);
      if (alpha >= beta) return alpha;
    }
    const us = p.side;
    const inCheck = p.isAttacked(p.kings[us], (us ^ 1) as 0 | 1);
    if (inCheck) depth++;
    if (depth <= 0 || ply >= MAX_PLY - 2) return this.qsearch(alpha, beta, ply, 0);

    // transposition table
    const idx = p.hashLo & TT_MASK;
    let ttMove = 0;
    if (this.ttFlag[idx] && this.ttKey[idx] === p.hashHi) {
      ttMove = this.ttMove[idx];
      if (ply > 0 && this.ttDepth[idx] >= depth) {
        let s = this.ttScore[idx];
        if (s > MATE_BOUND) s -= ply;
        else if (s < -MATE_BOUND) s += ply;
        const f = this.ttFlag[idx];
        if (f === EXACT || (f === LOWER && s >= beta) || (f === UPPER && s <= alpha)) return s;
      }
    }
    const pvNode = beta - alpha > 1;

    // null-move pruning
    if (allowNull && !pvNode && !inCheck && depth >= 3 && ply > 0 && this.hasPieces(us)) {
      const stat = evaluate(p);
      if (stat >= beta) {
        p.makeNull();
        this.push();
        const R = depth > 6 ? 3 : 2;
        let s: number;
        try {
          s = -this.negamax(depth - 1 - R, -beta, -beta + 1, ply + 1, false);
        } finally {
          this.stackLen--;
          p.unmakeNull();
        }
        if (s >= beta && Math.abs(s) < MATE_BOUND) return beta;
      }
    }

    const moves = p.genPseudo([]);
    const scores = this.orderScores(moves, ttMove, ply);
    let bestScore = -INF;
    let bestMove = 0;
    let legal = 0;
    const origAlpha = alpha;
    for (let i = 0; i < moves.length; i++) {
      // selection sort step
      let bi = i;
      for (let j = i + 1; j < moves.length; j++) if (scores[j] > scores[bi]) bi = j;
      if (bi !== i) {
        const tm = moves[i];
        moves[i] = moves[bi];
        moves[bi] = tm;
        const ts = scores[i];
        scores[i] = scores[bi];
        scores[bi] = ts;
      }
      const m = moves[i];
      p.make(m);
      if (p.isAttacked(p.kings[us], (us ^ 1) as 0 | 1)) {
        p.unmake();
        continue;
      }
      legal++;
      this.push();
      const quiet = !(moveFlags(m) & F_CAPTURE) && !movePromo(m);
      let s: number;
      try {
        if (legal === 1) {
          s = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true);
        } else {
          let r = 0;
          if (quiet && depth >= 3 && legal > 3 && !inCheck && !p.isAttacked(p.kings[p.side], us)) {
            r = legal > 8 ? 2 : 1;
          }
          s = -this.negamax(depth - 1 - r, -alpha - 1, -alpha, ply + 1, true);
          if (s > alpha && r > 0) s = -this.negamax(depth - 1, -alpha - 1, -alpha, ply + 1, true);
          if (s > alpha && s < beta) s = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true);
        }
      } finally {
        this.stackLen--;
        p.unmake();
      }
      if (s > bestScore) {
        bestScore = s;
        bestMove = m;
        if (s > alpha) {
          alpha = s;
          if (s >= beta) {
            if (quiet) {
              if (this.killers[ply * 2] !== m) {
                this.killers[ply * 2 + 1] = this.killers[ply * 2];
                this.killers[ply * 2] = m;
              }
              this.history[moveFrom(m) * 128 + moveTo(m)] += depth * depth;
            }
            break;
          }
        }
      }
    }
    if (legal === 0) return inCheck ? -MATE + ply : 0;

    // store
    let st = bestScore;
    if (st > MATE_BOUND) st += ply;
    else if (st < -MATE_BOUND) st -= ply;
    this.ttKey[idx] = p.hashHi;
    this.ttMove[idx] = bestMove;
    this.ttScore[idx] = st;
    this.ttDepth[idx] = depth;
    this.ttFlag[idx] = bestScore >= beta ? LOWER : bestScore > origAlpha ? EXACT : UPPER;
    return bestScore;
  }

  private qsearch(alpha: number, beta: number, ply: number, qd: number): number {
    const p = this.pos;
    this.nodes++;
    if (this.stopped || (this.nodes & 1023) === 0) this.checkTime();
    if (this.variantLoss()) return -MATE + ply;
    const us = p.side;
    const inCheck = qd < 3 && p.isAttacked(p.kings[us], (us ^ 1) as 0 | 1);
    let best = -INF;
    if (!inCheck) {
      const stand = evaluate(p);
      if (stand >= beta || ply >= MAX_PLY - 1) return stand;
      if (stand > alpha) alpha = stand;
      best = stand;
    }
    const moves = p.genPseudo([], !inCheck);
    const scores = this.orderScores(moves, 0, ply);
    let legal = 0;
    for (let i = 0; i < moves.length; i++) {
      let bi = i;
      for (let j = i + 1; j < moves.length; j++) if (scores[j] > scores[bi]) bi = j;
      if (bi !== i) {
        const tm = moves[i];
        moves[i] = moves[bi];
        moves[bi] = tm;
        const ts = scores[i];
        scores[i] = scores[bi];
        scores[bi] = ts;
      }
      const m = moves[i];
      // skip under-promotions in quiescence
      const pr = movePromo(m);
      if (!inCheck && pr && pr !== 5) continue;
      p.make(m);
      if (p.isAttacked(p.kings[us], (us ^ 1) as 0 | 1)) {
        p.unmake();
        continue;
      }
      legal++;
      let s: number;
      try {
        s = -this.qsearch(-beta, -alpha, ply + 1, qd + 1);
      } finally {
        p.unmake();
      }
      if (s > best) {
        best = s;
        if (s > alpha) {
          alpha = s;
          if (s >= beta) break;
        }
      }
    }
    if (inCheck && legal === 0) return -MATE + ply;
    return best;
  }

  private hasPieces(c: number): boolean {
    const b = this.pos.board;
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) continue;
      const pc = b[s];
      if (pc && pc >> 3 === c) {
        const t = pc & 7;
        if (t !== PAWN && t !== KING) return true;
      }
    }
    return false;
  }

  private orderScores(moves: number[], ttMove: number, ply: number): Int32Array {
    const b = this.pos.board;
    const out = new Int32Array(moves.length);
    const k1 = ply < MAX_PLY ? this.killers[ply * 2] : 0;
    const k2 = ply < MAX_PLY ? this.killers[ply * 2 + 1] : 0;
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      if (m === ttMove) {
        out[i] = 10_000_000;
        continue;
      }
      const fl = moveFlags(m);
      const from = moveFrom(m);
      const to = moveTo(m);
      let s = 0;
      if (fl & F_CAPTURE) {
        const victim = fl & F_EP ? PAWN : pieceType(b[to]);
        s = 1_000_000 + ORDER_VAL[victim] * 10 - ORDER_VAL[pieceType(b[from])] / 10;
      } else if (m === k1) s = 900_000;
      else if (m === k2) s = 800_000;
      else s = Math.min(700_000, this.history[from * 128 + to]);
      const pr = movePromo(m);
      if (pr) s += pr === 5 ? 2_000_000 : -500_000;
      out[i] = s;
    }
    return out;
  }

  private extractPv(depth: number): number[] {
    const p = this.pos;
    const pv: number[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < depth + 4; i++) {
      const idx = p.hashLo & TT_MASK;
      if (!this.ttFlag[idx] || this.ttKey[idx] !== p.hashHi) break;
      const m = this.ttMove[idx];
      if (!m) break;
      const legal = p.legalMoves();
      if (!legal.includes(m)) break;
      const k = p.key();
      if (seen.has(k)) break;
      seen.add(k);
      pv.push(m);
      p.make(m);
    }
    for (let i = 0; i < pv.length; i++) p.unmake();
    return pv;
  }
}

export const isMateScore = (s: number) => Math.abs(s) > MATE_BOUND;
/** plies to mate → moves to mate (positive = side to move mates) */
export const mateIn = (s: number) => (s > 0 ? Math.ceil((MATE - s) / 2) : -Math.ceil((MATE + s) / 2));
