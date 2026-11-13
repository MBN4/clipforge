// Core chess rules on a 0x88 board: move generation (incl. Chess960 castling), make/unmake,
// attack detection, Zobrist hashing, FEN and SAN. Pure TS (no DOM) so it runs in node tests,
// in the engine Web Worker and in the UI. Cross-checked against chess.js in the test-suite.

export const WHITE = 0;
export const BLACK = 1;
export type Color = 0 | 1;

export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;

export type Variant = "standard" | "koth" | "threecheck";

/** move flags */
export const F_CAPTURE = 1;
export const F_EP = 2;
export const F_CASTLE = 4;
export const F_DOUBLE = 8;

export const moveFrom = (m: number) => m & 127;
export const moveTo = (m: number) => (m >> 7) & 127;
export const movePromo = (m: number) => (m >> 14) & 7;
export const moveFlags = (m: number) => m >> 17;
const mk = (from: number, to: number, promo: number, flags: number) => from | (to << 7) | (promo << 14) | (flags << 17);

export const pieceType = (p: number) => p & 7;
export const pieceColor = (p: number) => (p >> 3) as Color;
export const makePiece = (c: Color, t: number) => t | (c << 3);

export const sqFile = (s: number) => s & 7;
export const sqRank = (s: number) => s >> 4;
export const sq = (file: number, rank: number) => rank * 16 + file;
export const onBoard = (s: number) => (s & 0x88) === 0;
export const sqName = (s: number) => "abcdefgh"[s & 7] + String((s >> 4) + 1);
export function parseSq(name: string): number {
  const f = name.charCodeAt(0) - 97;
  const r = name.charCodeAt(1) - 49;
  if (f < 0 || f > 7 || r < 0 || r > 7 || name.length !== 2) return -1;
  return r * 16 + f;
}
/** 0..63 index (a1 = 0, h8 = 63) */
export const sq64 = (s: number) => (s >> 4) * 8 + (s & 7);

const KNIGHT_D = [33, 31, 18, 14, -33, -31, -18, -14];
const KING_D = [1, -1, 16, -16, 15, 17, -15, -17];
const BISHOP_D = [15, 17, -15, -17];
const ROOK_D = [1, -1, 16, -16];

// ---- Zobrist keys (two 32-bit halves → ~64-bit keys) -------------------------------------------------------
let seed = 0x9e3779b9;
function rnd32() {
  seed ^= seed << 13;
  seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  seed >>>= 0;
  return seed;
}
const ZP_LO = new Int32Array(16 * 128);
const ZP_HI = new Int32Array(16 * 128);
for (let i = 0; i < ZP_LO.length; i++) {
  ZP_LO[i] = rnd32() | 0;
  ZP_HI[i] = rnd32() | 0;
}
const Z_SIDE_LO = rnd32() | 0;
const Z_SIDE_HI = rnd32() | 0;
const ZC_LO = new Int32Array(32); // castle slot (0..3) × rook file
const ZC_HI = new Int32Array(32);
const ZE_LO = new Int32Array(8);
const ZE_HI = new Int32Array(8);
const ZK_LO = new Int32Array(8); // three-check counters: color*4 + count
const ZK_HI = new Int32Array(8);
for (let i = 0; i < 32; i++) {
  ZC_LO[i] = rnd32() | 0;
  ZC_HI[i] = rnd32() | 0;
}
for (let i = 0; i < 8; i++) {
  ZE_LO[i] = rnd32() | 0;
  ZE_HI[i] = rnd32() | 0;
  ZK_LO[i] = rnd32() | 0;
  ZK_HI[i] = rnd32() | 0;
}

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const HILL = new Set([parseSq("d4"), parseSq("e4"), parseSq("d5"), parseSq("e5")]);
export const isHill = (s: number) => HILL.has(s);

const MAX_PLY = 1024;

export class Position {
  board = new Int8Array(128);
  side: Color = WHITE;
  /** castling rook squares: [white kingside, white queenside, black kingside, black queenside]; -1 = no right */
  castle = new Int16Array([-1, -1, -1, -1]);
  ep = -1;
  halfmove = 0;
  fullmove = 1;
  kings = new Int16Array([-1, -1]);
  /** checks delivered by each colour (three-check) */
  checks = new Int8Array(2);
  variant: Variant = "standard";
  chess960 = false;
  hashLo = 0;
  hashHi = 0;

  // undo stack
  private ply = 0;
  private uMove = new Int32Array(MAX_PLY);
  private uCap = new Int8Array(MAX_PLY);
  private uCastle = new Int16Array(MAX_PLY * 4);
  private uEp = new Int16Array(MAX_PLY);
  private uHalf = new Int16Array(MAX_PLY);
  private uLo = new Int32Array(MAX_PLY);
  private uHi = new Int32Array(MAX_PLY);
  private uChecks = new Int8Array(MAX_PLY * 2);

  static fromFen(fen: string, variant: Variant = "standard", chess960 = false): Position {
    const p = new Position();
    p.variant = variant;
    p.chess960 = chess960;
    p.loadFen(fen);
    return p;
  }

  clone(): Position {
    const p = new Position();
    p.board.set(this.board);
    p.side = this.side;
    p.castle.set(this.castle);
    p.ep = this.ep;
    p.halfmove = this.halfmove;
    p.fullmove = this.fullmove;
    p.kings.set(this.kings);
    p.checks.set(this.checks);
    p.variant = this.variant;
    p.chess960 = this.chess960;
    p.hashLo = this.hashLo;
    p.hashHi = this.hashHi;
    return p;
  }

  /** Repetition key (position + side + castling + ep + check counters). */
  key(): string {
    return (this.hashLo >>> 0).toString(36) + ":" + (this.hashHi >>> 0).toString(36);
  }

  loadFen(fen: string) {
    const parts = fen.trim().split(/\s+/);
    if (parts.length < 4) throw new Error("bad FEN: " + fen);
    this.board.fill(0);
    this.kings[0] = this.kings[1] = -1;
    const rows = parts[0].split("/");
    if (rows.length !== 8) throw new Error("bad FEN board: " + fen);
    for (let r = 0; r < 8; r++) {
      let f = 0;
      for (const ch of rows[r]) {
        if (ch >= "1" && ch <= "8") {
          f += Number(ch);
          continue;
        }
        const t = "pnbrqk".indexOf(ch.toLowerCase()) + 1;
        if (t === 0 || f > 7) throw new Error("bad FEN piece: " + fen);
        const c: Color = ch === ch.toLowerCase() ? BLACK : WHITE;
        const s = sq(f, 7 - r);
        this.board[s] = makePiece(c, t);
        if (t === KING) this.kings[c] = s;
        f++;
      }
      if (f !== 8) throw new Error("bad FEN rank: " + fen);
    }
    if (this.kings[0] < 0 || this.kings[1] < 0) throw new Error("FEN needs both kings");
    this.side = parts[1] === "b" ? BLACK : WHITE;
    this.castle.fill(-1);
    if (parts[2] !== "-") {
      for (const ch of parts[2]) {
        const c: Color = ch === ch.toLowerCase() ? BLACK : WHITE;
        const rank = c === WHITE ? 0 : 7;
        const k = this.kings[c];
        if (sqRank(k) !== rank) continue;
        const rook = makePiece(c, ROOK);
        const lc = ch.toLowerCase();
        let rs = -1;
        if (lc === "k") {
          for (let f = 7; f > sqFile(k); f--) if (this.board[sq(f, rank)] === rook) { rs = sq(f, rank); break; }
        } else if (lc === "q") {
          for (let f = 0; f < sqFile(k); f++) if (this.board[sq(f, rank)] === rook) { rs = sq(f, rank); break; }
        } else if (lc >= "a" && lc <= "h") {
          const s = sq(lc.charCodeAt(0) - 97, rank);
          if (this.board[s] === rook) rs = s;
        }
        if (rs < 0) continue;
        const slot = c * 2 + (sqFile(rs) > sqFile(k) ? 0 : 1);
        this.castle[slot] = rs;
      }
    }
    this.ep = parts[3] !== "-" ? parseSq(parts[3]) : -1;
    this.halfmove = parts[4] ? Number(parts[4]) || 0 : 0;
    this.fullmove = parts[5] ? Number(parts[5]) || 1 : 1;
    this.checks[0] = this.checks[1] = 0;
    // optional three-check counter field "+W+B" (checks given by white / black)
    if (parts[6] && /^\+\d\+\d$/.test(parts[6])) {
      this.checks[0] = Number(parts[6][1]);
      this.checks[1] = Number(parts[6][3]);
    }
    if (this.ep >= 0 && !this.epCapturable(this.ep)) this.ep = -1;
    this.ply = 0;
    this.computeHash();
  }

  /** true when a pawn of the side to move stands ready to capture en passant on `ep` (pseudo-legal) */
  private epCapturable(ep: number): boolean {
    const us = this.side;
    const pawn = makePiece(us, PAWN);
    const from1 = us === WHITE ? ep - 15 : ep + 15;
    const from2 = us === WHITE ? ep - 17 : ep + 17;
    return (onBoard(from1) && this.board[from1] === pawn) || (onBoard(from2) && this.board[from2] === pawn);
  }

  computeHash() {
    let lo = 0;
    let hi = 0;
    for (let s = 0; s < 128; s++) {
      if (!onBoard(s)) continue;
      const p = this.board[s];
      if (p) {
        lo ^= ZP_LO[p * 128 + s];
        hi ^= ZP_HI[p * 128 + s];
      }
    }
    if (this.side === BLACK) {
      lo ^= Z_SIDE_LO;
      hi ^= Z_SIDE_HI;
    }
    for (let i = 0; i < 4; i++) {
      if (this.castle[i] >= 0) {
        lo ^= ZC_LO[i * 8 + sqFile(this.castle[i])];
        hi ^= ZC_HI[i * 8 + sqFile(this.castle[i])];
      }
    }
    if (this.ep >= 0) {
      lo ^= ZE_LO[sqFile(this.ep)];
      hi ^= ZE_HI[sqFile(this.ep)];
    }
    if (this.variant === "threecheck") {
      lo ^= ZK_LO[this.checks[0]] ^ ZK_LO[4 + this.checks[1]];
      hi ^= ZK_HI[this.checks[0]] ^ ZK_HI[4 + this.checks[1]];
    }
    this.hashLo = lo;
    this.hashHi = hi;
  }

  fen(): string {
    let out = "";
    for (let r = 7; r >= 0; r--) {
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.board[sq(f, r)];
        if (!p) {
          empty++;
          continue;
        }
        if (empty) out += empty;
        empty = 0;
        const ch = " pnbrqk"[pieceType(p)];
        out += pieceColor(p) === WHITE ? ch.toUpperCase() : ch;
      }
      if (empty) out += empty;
      if (r) out += "/";
    }
    let cs = "";
    for (let i = 0; i < 4; i++) {
      const rs = this.castle[i];
      if (rs < 0) continue;
      const c = (i >> 1) as Color;
      const kside = (i & 1) === 0;
      // outermost rook → K/Q, otherwise the rook's file letter (Shredder/X-FEN)
      let outer = true;
      const rank = sqRank(rs);
      const rook = makePiece(c, ROOK);
      if (kside) {
        for (let f = sqFile(rs) + 1; f < 8; f++) if (this.board[sq(f, rank)] === rook) outer = false;
      } else {
        for (let f = 0; f < sqFile(rs); f++) if (this.board[sq(f, rank)] === rook) outer = false;
      }
      let ch = outer ? (kside ? "k" : "q") : "abcdefgh"[sqFile(rs)];
      if (c === WHITE) ch = ch.toUpperCase();
      cs += ch;
    }
    let s = `${out} ${this.side === WHITE ? "w" : "b"} ${cs || "-"} ${this.ep >= 0 ? sqName(this.ep) : "-"} ${this.halfmove} ${this.fullmove}`;
    if (this.variant === "threecheck") s += ` +${this.checks[0]}+${this.checks[1]}`;
    return s;
  }

  // ---- attacks ---------------------------------------------------------------------------------------------
  isAttacked(s: number, by: Color): boolean {
    const b = this.board;
    // pawns
    if (by === WHITE) {
      if (onBoard(s - 15) && b[s - 15] === PAWN) return true;
      if (onBoard(s - 17) && b[s - 17] === PAWN) return true;
    } else {
      const bp = makePiece(BLACK, PAWN);
      if (onBoard(s + 15) && b[s + 15] === bp) return true;
      if (onBoard(s + 17) && b[s + 17] === bp) return true;
    }
    const kn = makePiece(by, KNIGHT);
    for (let i = 0; i < 8; i++) {
      const t = s + KNIGHT_D[i];
      if (onBoard(t) && b[t] === kn) return true;
    }
    const kg = makePiece(by, KING);
    for (let i = 0; i < 8; i++) {
      const t = s + KING_D[i];
      if (onBoard(t) && b[t] === kg) return true;
    }
    const bi = makePiece(by, BISHOP);
    const qu = makePiece(by, QUEEN);
    const ro = makePiece(by, ROOK);
    for (let i = 0; i < 4; i++) {
      const d = BISHOP_D[i];
      let t = s + d;
      while (onBoard(t)) {
        const p = b[t];
        if (p) {
          if (p === bi || p === qu) return true;
          break;
        }
        t += d;
      }
    }
    for (let i = 0; i < 4; i++) {
      const d = ROOK_D[i];
      let t = s + d;
      while (onBoard(t)) {
        const p = b[t];
        if (p) {
          if (p === ro || p === qu) return true;
          break;
        }
        t += d;
      }
    }
    return false;
  }

  inCheck(c: Color = this.side): boolean {
    return this.isAttacked(this.kings[c], (c ^ 1) as Color);
  }

  // ---- move generation -------------------------------------------------------------------------------------
  /** Pseudo-legal moves appended to `out` (castling is fully checked). capturesOnly → captures + promotions. */
  genPseudo(out: number[], capturesOnly = false): number[] {
    const b = this.board;
    const us = this.side;
    const them = (us ^ 1) as Color;
    const fwd = us === WHITE ? 16 : -16;
    const startRank = us === WHITE ? 1 : 6;
    const promoRank = us === WHITE ? 7 : 0;
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) {
        s += 7;
        continue;
      }
      const p = b[s];
      if (!p || pieceColor(p) !== us) continue;
      const t = pieceType(p);
      if (t === PAWN) {
        const one = s + fwd;
        if (onBoard(one) && !b[one]) {
          if (sqRank(one) === promoRank) {
            for (let pr = QUEEN; pr >= KNIGHT; pr--) out.push(mk(s, one, pr, 0));
          } else if (!capturesOnly) {
            out.push(mk(s, one, 0, 0));
            const two = one + fwd;
            if (sqRank(s) === startRank && !b[two]) out.push(mk(s, two, 0, F_DOUBLE));
          }
        }
        for (const d of [fwd - 1, fwd + 1]) {
          const to = s + d;
          if (!onBoard(to)) continue;
          const q = b[to];
          if (q && pieceColor(q) === them) {
            if (sqRank(to) === promoRank) {
              for (let pr = QUEEN; pr >= KNIGHT; pr--) out.push(mk(s, to, pr, F_CAPTURE));
            } else out.push(mk(s, to, 0, F_CAPTURE));
          } else if (to === this.ep) {
            out.push(mk(s, to, 0, F_CAPTURE | F_EP));
          }
        }
        continue;
      }
      if (t === KNIGHT || t === KING) {
        const ds = t === KNIGHT ? KNIGHT_D : KING_D;
        for (let i = 0; i < 8; i++) {
          const to = s + ds[i];
          if (!onBoard(to)) continue;
          const q = b[to];
          if (!q) {
            if (!capturesOnly) out.push(mk(s, to, 0, 0));
          } else if (pieceColor(q) === them) out.push(mk(s, to, 0, F_CAPTURE));
        }
        continue;
      }
      const dirs = t === BISHOP ? BISHOP_D : t === ROOK ? ROOK_D : KING_D;
      for (let i = 0; i < dirs.length; i++) {
        const d = dirs[i];
        let to = s + d;
        while (onBoard(to)) {
          const q = b[to];
          if (!q) {
            if (!capturesOnly) out.push(mk(s, to, 0, 0));
          } else {
            if (pieceColor(q) === them) out.push(mk(s, to, 0, F_CAPTURE));
            break;
          }
          to += d;
        }
      }
    }
    if (!capturesOnly) this.genCastles(out);
    return out;
  }

  private genCastles(out: number[]) {
    const us = this.side;
    const them = (us ^ 1) as Color;
    const kf = this.kings[us];
    const rank = us === WHITE ? 0 : 7;
    if (sqRank(kf) !== rank) return;
    let checked = false;
    for (let i = 0; i < 2; i++) {
      const rf = this.castle[us * 2 + i];
      if (rf < 0) continue;
      if (!checked) {
        if (this.isAttacked(kf, them)) return;
        checked = true;
      }
      const kt = sq(i === 0 ? 6 : 2, rank);
      const rt = sq(i === 0 ? 5 : 3, rank);
      const lo = Math.min(sqFile(kf), sqFile(kt), sqFile(rf), sqFile(rt));
      const hi = Math.max(sqFile(kf), sqFile(kt), sqFile(rf), sqFile(rt));
      let ok = true;
      for (let f = lo; f <= hi && ok; f++) {
        const s = sq(f, rank);
        if (s !== kf && s !== rf && this.board[s]) ok = false;
      }
      if (!ok) continue;
      // king's path (origin .. destination) must not be attacked; lift king + rook so they don't shield rays
      const kp = this.board[kf];
      const rp = this.board[rf];
      this.board[kf] = 0;
      this.board[rf] = 0;
      const step = sqFile(kt) > sqFile(kf) ? 1 : -1;
      for (let f = sqFile(kf); ; f += step) {
        if (this.isAttacked(sq(f, rank), them)) {
          ok = false;
          break;
        }
        if (f === sqFile(kt)) break;
      }
      this.board[kf] = kp;
      this.board[rf] = rp;
      if (ok) out.push(mk(kf, rf, 0, F_CASTLE));
    }
  }

  /** All legal moves. */
  legalMoves(): number[] {
    const pseudo = this.genPseudo([]);
    const out: number[] = [];
    const us = this.side;
    for (const m of pseudo) {
      this.make(m);
      if (!this.isAttacked(this.kings[us], (us ^ 1) as Color)) out.push(m);
      this.unmake();
    }
    return out;
  }

  hasLegalMove(): boolean {
    const pseudo = this.genPseudo([]);
    const us = this.side;
    for (const m of pseudo) {
      this.make(m);
      const ok = !this.isAttacked(this.kings[us], (us ^ 1) as Color);
      this.unmake();
      if (ok) return true;
    }
    return false;
  }

  // ---- make / unmake ---------------------------------------------------------------------------------------
  private put(s: number, p: number) {
    this.board[s] = p;
    this.hashLo ^= ZP_LO[p * 128 + s];
    this.hashHi ^= ZP_HI[p * 128 + s];
  }
  private lift(s: number) {
    const p = this.board[s];
    this.board[s] = 0;
    this.hashLo ^= ZP_LO[p * 128 + s];
    this.hashHi ^= ZP_HI[p * 128 + s];
    return p;
  }

  make(m: number) {
    const i = this.ply++;
    const from = moveFrom(m);
    const to = moveTo(m);
    const fl = moveFlags(m);
    const us = this.side;
    const them = (us ^ 1) as Color;
    this.uMove[i] = m;
    this.uEp[i] = this.ep;
    this.uHalf[i] = this.halfmove;
    this.uLo[i] = this.hashLo;
    this.uHi[i] = this.hashHi;
    for (let k = 0; k < 4; k++) this.uCastle[i * 4 + k] = this.castle[k];
    this.uChecks[i * 2] = this.checks[0];
    this.uChecks[i * 2 + 1] = this.checks[1];
    this.uCap[i] = 0;

    // remove ep + castle + check-counter keys; re-add after
    if (this.ep >= 0) {
      this.hashLo ^= ZE_LO[sqFile(this.ep)];
      this.hashHi ^= ZE_HI[sqFile(this.ep)];
    }
    for (let k = 0; k < 4; k++)
      if (this.castle[k] >= 0) {
        this.hashLo ^= ZC_LO[k * 8 + sqFile(this.castle[k])];
        this.hashHi ^= ZC_HI[k * 8 + sqFile(this.castle[k])];
      }
    const three = this.variant === "threecheck";
    if (three) {
      this.hashLo ^= ZK_LO[this.checks[0]] ^ ZK_LO[4 + this.checks[1]];
      this.hashHi ^= ZK_HI[this.checks[0]] ^ ZK_HI[4 + this.checks[1]];
    }
    this.ep = -1;
    this.halfmove++;

    if (fl & F_CASTLE) {
      const rank = sqRank(from);
      const kside = sqFile(to) > sqFile(from);
      const kt = sq(kside ? 6 : 2, rank);
      const rt = sq(kside ? 5 : 3, rank);
      const k = this.lift(from);
      const r = this.lift(to);
      this.put(kt, k);
      this.put(rt, r);
      this.kings[us] = kt;
      this.castle[us * 2] = -1;
      this.castle[us * 2 + 1] = -1;
    } else {
      const p = this.lift(from);
      if (fl & F_EP) {
        const cs = us === WHITE ? to - 16 : to + 16;
        this.uCap[i] = this.lift(cs);
      } else if (this.board[to]) {
        this.uCap[i] = this.lift(to);
      }
      const pr = movePromo(m);
      this.put(to, pr ? makePiece(us, pr) : p);
      const t = pieceType(p);
      if (t === KING) {
        this.kings[us] = to;
        this.castle[us * 2] = -1;
        this.castle[us * 2 + 1] = -1;
      }
      if (t === PAWN || this.uCap[i]) this.halfmove = 0;
      for (let k = 0; k < 4; k++) if (this.castle[k] === from || this.castle[k] === to) this.castle[k] = -1;
      if (fl & F_DOUBLE) {
        const e = (from + to) >> 1;
        this.side = them; // epCapturable looks from the side to move
        if (this.epCapturable(e)) this.ep = e;
        this.side = us;
      }
    }
    if (this.ep >= 0) {
      this.hashLo ^= ZE_LO[sqFile(this.ep)];
      this.hashHi ^= ZE_HI[sqFile(this.ep)];
    }
    for (let k = 0; k < 4; k++)
      if (this.castle[k] >= 0) {
        this.hashLo ^= ZC_LO[k * 8 + sqFile(this.castle[k])];
        this.hashHi ^= ZC_HI[k * 8 + sqFile(this.castle[k])];
      }
    if (three) {
      if (this.isAttacked(this.kings[them], us) && this.checks[us] < 3) this.checks[us]++;
      this.hashLo ^= ZK_LO[this.checks[0]] ^ ZK_LO[4 + this.checks[1]];
      this.hashHi ^= ZK_HI[this.checks[0]] ^ ZK_HI[4 + this.checks[1]];
    }
    if (us === BLACK) this.fullmove++;
    this.side = them;
    this.hashLo ^= Z_SIDE_LO;
    this.hashHi ^= Z_SIDE_HI;
  }

  unmake() {
    const i = --this.ply;
    const m = this.uMove[i];
    const from = moveFrom(m);
    const to = moveTo(m);
    const fl = moveFlags(m);
    const them = this.side;
    const us = (them ^ 1) as Color;
    if (fl & F_CASTLE) {
      const rank = sqRank(from);
      const kside = sqFile(to) > sqFile(from);
      const kt = sq(kside ? 6 : 2, rank);
      const rt = sq(kside ? 5 : 3, rank);
      this.board[kt] = 0;
      this.board[rt] = 0;
      this.board[from] = makePiece(us, KING);
      this.board[to] = makePiece(us, ROOK);
      this.kings[us] = from;
    } else {
      const moved = this.board[to];
      this.board[to] = 0;
      this.board[from] = movePromo(m) ? makePiece(us, PAWN) : moved;
      if (pieceType(moved) === KING && !movePromo(m)) this.kings[us] = from;
      const cap = this.uCap[i];
      if (cap) {
        if (fl & F_EP) this.board[us === WHITE ? to - 16 : to + 16] = cap;
        else this.board[to] = cap;
      }
    }
    this.side = us;
    if (us === BLACK) this.fullmove--;
    this.ep = this.uEp[i];
    this.halfmove = this.uHalf[i];
    this.hashLo = this.uLo[i];
    this.hashHi = this.uHi[i];
    for (let k = 0; k < 4; k++) this.castle[k] = this.uCastle[i * 4 + k];
    this.checks[0] = this.uChecks[i * 2];
    this.checks[1] = this.uChecks[i * 2 + 1];
  }

  /** Null move for the search (side passes). */
  makeNull() {
    const i = this.ply++;
    this.uMove[i] = 0;
    this.uEp[i] = this.ep;
    this.uHalf[i] = this.halfmove;
    this.uLo[i] = this.hashLo;
    this.uHi[i] = this.hashHi;
    if (this.ep >= 0) {
      this.hashLo ^= ZE_LO[sqFile(this.ep)];
      this.hashHi ^= ZE_HI[sqFile(this.ep)];
    }
    this.ep = -1;
    this.halfmove++;
    this.side = (this.side ^ 1) as Color;
    this.hashLo ^= Z_SIDE_LO;
    this.hashHi ^= Z_SIDE_HI;
  }
  unmakeNull() {
    const i = --this.ply;
    this.side = (this.side ^ 1) as Color;
    this.ep = this.uEp[i];
    this.halfmove = this.uHalf[i];
    this.hashLo = this.uLo[i];
    this.hashHi = this.uHi[i];
  }

  /** The piece captured by the last made move (0 if none). */
  lastCaptured(): number {
    return this.ply > 0 ? this.uCap[this.ply - 1] : 0;
  }

  // ---- helpers for the UI ------------------------------------------------------------------------------------
  /** Where the king / rook actually land for a move (castling is encoded king→own rook). */
  static landing(m: number): { kingTo: number; rookFrom: number; rookTo: number } | null {
    if (!(moveFlags(m) & F_CASTLE)) return null;
    const from = moveFrom(m);
    const to = moveTo(m);
    const rank = sqRank(from);
    const kside = sqFile(to) > sqFile(from);
    return { kingTo: sq(kside ? 6 : 2, rank), rookFrom: to, rookTo: sq(kside ? 5 : 3, rank) };
  }

  /** Visible destination square of a move (castling → king's landing square). */
  static dest(m: number): number {
    const l = Position.landing(m);
    return l ? l.kingTo : moveTo(m);
  }

  /** UCI-ish string. Castling is written king→landing in standard chess and king→rook in 960. */
  uci(m: number): string {
    const l = Position.landing(m);
    const to = l && !this.chess960 ? l.kingTo : moveTo(m);
    const pr = movePromo(m);
    return sqName(moveFrom(m)) + sqName(to) + (pr ? " pnbrqk"[pr] : "");
  }

  /** Find the legal move matching a UCI string (accepts both castling notations). */
  fromUci(u: string): number | null {
    const from = parseSq(u.slice(0, 2));
    const to = parseSq(u.slice(2, 4));
    const pr = u.length > 4 ? " pnbrqk".indexOf(u[4]) : 0;
    for (const m of this.legalMoves()) {
      if (moveFrom(m) !== from) continue;
      if (movePromo(m) !== (pr > 0 ? pr : 0)) continue;
      if (moveTo(m) === to) return m;
      const l = Position.landing(m);
      if (l && l.kingTo === to) return m;
    }
    return null;
  }

  san(m: number, legal: number[] = this.legalMoves()): string {
    const fl = moveFlags(m);
    let s: string;
    if (fl & F_CASTLE) {
      s = sqFile(moveTo(m)) > sqFile(moveFrom(m)) ? "O-O" : "O-O-O";
    } else {
      const from = moveFrom(m);
      const to = moveTo(m);
      const t = pieceType(this.board[from]);
      const cap = (fl & F_CAPTURE) !== 0;
      if (t === PAWN) {
        s = (cap ? "abcdefgh"[sqFile(from)] + "x" : "") + sqName(to);
        if (movePromo(m)) s += "=" + " PNBRQK"[movePromo(m)];
      } else {
        let amb = false;
        let sameFile = false;
        let sameRank = false;
        for (const o of legal) {
          if (o === m || moveTo(o) !== to || moveFrom(o) === from) continue;
          if (moveFlags(o) & F_CASTLE) continue;
          if (pieceType(this.board[moveFrom(o)]) !== t) continue;
          amb = true;
          if (sqFile(moveFrom(o)) === sqFile(from)) sameFile = true;
          if (sqRank(moveFrom(o)) === sqRank(from)) sameRank = true;
        }
        let d = "";
        if (amb) {
          if (!sameFile) d = "abcdefgh"[sqFile(from)];
          else if (!sameRank) d = String(sqRank(from) + 1);
          else d = sqName(from);
        }
        s = " PNBRQK"[t] + d + (cap ? "x" : "") + sqName(to);
      }
    }
    this.make(m);
    if (this.inCheck()) s += this.hasLegalMove() ? "+" : "#";
    this.unmake();
    return s;
  }

  /** Parse SAN (lenient about +/#/!?) against the legal moves. */
  fromSan(san: string): number | null {
    const clean = san.replace(/[+#!?]/g, "").replace(/0/g, "O");
    const legal = this.legalMoves();
    for (const m of legal) {
      if (this.san(m, legal).replace(/[+#]/g, "") === clean) return m;
    }
    return null;
  }
}

// ---- Chess960 -------------------------------------------------------------------------------------------------
/** Scharnagl numbering: n in 0..959 → back rank (518 = standard). */
export function chess960BackRank(n: number): string {
  const rank: (string | null)[] = Array(8).fill(null);
  let x = n;
  const b1 = x % 4;
  x = Math.floor(x / 4);
  rank[b1 * 2 + 1] = "b";
  const b2 = x % 4;
  x = Math.floor(x / 4);
  rank[b2 * 2] = "b";
  const q = x % 6;
  x = Math.floor(x / 6);
  const free = () => rank.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  rank[free()[q]] = "q";
  const KN = [
    [0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4],
  ][x];
  const f1 = free();
  rank[f1[KN[0]]] = "n";
  rank[f1[KN[1]]] = "n";
  const f2 = free();
  rank[f2[0]] = "r";
  rank[f2[1]] = "k";
  rank[f2[2]] = "r";
  return rank.join("");
}

export function chess960Fen(n: number): string {
  const r = chess960BackRank(n);
  return `${r}/pppppppp/8/8/8/8/PPPPPPPP/${r.toUpperCase()} w KQkq - 0 1`;
}
