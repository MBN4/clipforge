// Static evaluation: tapered material + piece-square tables, pawn structure, mobility, king safety,
// rook files, bishop pair, endgame mop-up, plus variant terms (King of the Hill, Three-Check).
// Returns centipawns from the side to move's point of view.
import { BISHOP, KING, KNIGHT, PAWN, QUEEN, ROOK, WHITE, type Position } from "./position";

const MG = [0, 100, 320, 335, 490, 950, 0];
const EG = [0, 125, 295, 315, 530, 950, 0];
const PHASE = [0, 0, 1, 1, 2, 4, 0];

// Tables listed from rank 8 (top) to rank 1, a→h, white's point of view.
const T_PAWN = [
  0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5,
  -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
];
const T_PAWN_EG = [
  0, 0, 0, 0, 0, 0, 0, 0, 80, 80, 80, 80, 80, 80, 80, 80, 50, 50, 50, 50, 50, 50, 50, 50, 30, 30, 30, 30, 30, 30, 30, 30, 15, 15, 15, 15, 15, 15, 15,
  15, 5, 5, 5, 5, 5, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];
const T_KNIGHT = [
  -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20,
  20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
];
const T_BISHOP = [
  -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10,
  10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20,
];
const T_ROOK = [
  0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0,
  0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0,
];
const T_QUEEN = [
  -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10,
  5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20,
];
const T_KING_MG = [
  -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40,
  -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20,
];
const T_KING_EG = [
  -50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50,
];

/** precomputed [colour][type][0x88 square] → mg / eg bonuses incl. material */
const PST_MG = new Int16Array(2 * 7 * 128);
const PST_EG = new Int16Array(2 * 7 * 128);
(function init() {
  const mgT = [null, T_PAWN, T_KNIGHT, T_BISHOP, T_ROOK, T_QUEEN, T_KING_MG];
  const egT = [null, T_PAWN_EG, T_KNIGHT, T_BISHOP, T_ROOK, T_QUEEN, T_KING_EG];
  for (let c = 0; c < 2; c++)
    for (let t = 1; t <= 6; t++)
      for (let r = 0; r < 8; r++)
        for (let f = 0; f < 8; f++) {
          const idx = c === WHITE ? (7 - r) * 8 + f : r * 8 + f;
          const s = r * 16 + f;
          PST_MG[(c * 7 + t) * 128 + s] = MG[t] + mgT[t]![idx];
          PST_EG[(c * 7 + t) * 128 + s] = EG[t] + egT[t]![idx];
        }
})();

const PASSED = [0, 5, 10, 20, 35, 60, 100, 0];
const KN_D = [33, 31, 18, 14, -33, -31, -18, -14];
const DIAG = [15, 17, -15, -17];
const ORTH = [1, -1, 16, -16];
const KOTH_DIST = [0, 300, 140, 70, 35, 15, 0, 0];
const THREECHECK_BONUS = [0, 110, 330, 0];

const hillDist = (s: number) => {
  const f = s & 7;
  const r = s >> 4;
  const df = f < 3 ? 3 - f : f > 4 ? f - 4 : 0;
  const dr = r < 3 ? 3 - r : r > 4 ? r - 4 : 0;
  return Math.max(df, dr);
};

export function evaluate(p: Position): number {
  const b = p.board;
  let mg = 0;
  let eg = 0;
  let phase = 0;
  const pawnFiles = [new Int8Array(8), new Int8Array(8)];
  const pawnBits = [new Int32Array(8), new Int32Array(8)]; // bit r set if pawn on rank r in file f
  let bishops0 = 0;
  let bishops1 = 0;
  const nonPawn = [0, 0];
  const pawns = [0, 0];

  for (let s = 0; s < 128; s++) {
    if (s & 0x88) {
      s += 7;
      continue;
    }
    const pc = b[s];
    if (!pc) continue;
    const c = pc >> 3;
    const t = pc & 7;
    const i = (c * 7 + t) * 128 + s;
    const sign = c === 0 ? 1 : -1;
    mg += sign * PST_MG[i];
    eg += sign * PST_EG[i];
    phase += PHASE[t];
    if (t === PAWN) {
      const f = s & 7;
      pawnFiles[c][f]++;
      pawnBits[c][f] |= 1 << (s >> 4);
      pawns[c]++;
    } else if (t !== KING) {
      nonPawn[c] += MG[t];
      if (t === BISHOP) {
        if (c === 0) bishops0++;
        else bishops1++;
      }
    }
  }
  if (bishops0 >= 2) {
    mg += 30;
    eg += 45;
  }
  if (bishops1 >= 2) {
    mg -= 30;
    eg -= 45;
  }

  // pawn structure + mobility + rooks
  for (let s = 0; s < 128; s++) {
    if (s & 0x88) {
      s += 7;
      continue;
    }
    const pc = b[s];
    if (!pc) continue;
    const c = pc >> 3;
    const t = pc & 7;
    const sign = c === 0 ? 1 : -1;
    const f = s & 7;
    const r = s >> 4;
    if (t === PAWN) {
      const opp = c ^ 1;
      if (pawnFiles[c][f] > 1) {
        mg -= sign * 8;
        eg -= sign * 18;
      }
      const isolated = (f === 0 || pawnFiles[c][f - 1] === 0) && (f === 7 || pawnFiles[c][f + 1] === 0);
      if (isolated) {
        mg -= sign * 12;
        eg -= sign * 14;
      }
      // passed: no enemy pawns ahead on this or adjacent files
      let ahead = 0;
      if (c === 0) ahead = ~((1 << (r + 1)) - 1) & 0xff;
      else ahead = (1 << r) - 1;
      let blocked = false;
      for (let df = -1; df <= 1 && !blocked; df++) {
        const ff = f + df;
        if (ff < 0 || ff > 7) continue;
        if (pawnBits[opp][ff] & ahead) blocked = true;
      }
      if (!blocked) {
        const rel = c === 0 ? r : 7 - r;
        mg += sign * PASSED[rel];
        eg += sign * PASSED[rel] * 2;
      }
      continue;
    }
    if (t === KNIGHT) {
      let mob = 0;
      for (let k = 0; k < 8; k++) {
        const to = s + KN_D[k];
        if (to & 0x88) continue;
        const q = b[to];
        if (!q || q >> 3 !== c) mob++;
      }
      mg += sign * (mob - 4) * 4;
      eg += sign * (mob - 4) * 4;
      continue;
    }
    if (t === BISHOP || t === ROOK || t === QUEEN) {
      const dirs = t === BISHOP ? DIAG : t === ROOK ? ORTH : null;
      let mob = 0;
      const scan = (d: number) => {
        let to = s + d;
        while (!(to & 0x88)) {
          const q = b[to];
          if (q) {
            if (q >> 3 !== c) mob++;
            break;
          }
          mob++;
          to += d;
        }
      };
      if (dirs) for (let k = 0; k < 4; k++) scan(dirs[k]);
      else {
        for (let k = 0; k < 4; k++) scan(DIAG[k]);
        for (let k = 0; k < 4; k++) scan(ORTH[k]);
      }
      if (t === BISHOP) {
        mg += sign * (mob - 6) * 5;
        eg += sign * (mob - 6) * 5;
      } else if (t === ROOK) {
        mg += sign * (mob - 6) * 2;
        eg += sign * (mob - 6) * 4;
        if (pawnFiles[c][f] === 0) {
          const open = pawnFiles[c ^ 1][f] === 0;
          mg += sign * (open ? 22 : 10);
          eg += sign * (open ? 10 : 5);
        }
      } else {
        mg += sign * (mob - 12);
        eg += sign * (mob - 12) * 2;
      }
    }
  }

  // king safety (middlegame): pawn shield + open files near the king
  for (let c = 0; c < 2; c++) {
    const k = p.kings[c];
    const sign = c === 0 ? 1 : -1;
    const kf = k & 7;
    const kr = k >> 4;
    let shield = 0;
    let open = 0;
    for (let df = -1; df <= 1; df++) {
      const ff = kf + df;
      if (ff < 0 || ff > 7) continue;
      const bits = pawnBits[c][ff];
      const r1 = c === 0 ? kr + 1 : kr - 1;
      const r2 = c === 0 ? kr + 2 : kr - 2;
      if (r1 >= 0 && r1 < 8 && bits & (1 << r1)) shield += 12;
      else if (r2 >= 0 && r2 < 8 && bits & (1 << r2)) shield += 6;
      if (pawnFiles[c][ff] === 0) open += pawnFiles[c ^ 1][ff] === 0 ? 20 : 12;
    }
    let ks = shield - open;
    if (p.variant === "threecheck") ks *= 3;
    mg += sign * ks;
  }

  if (phase > 24) phase = 24;
  let score = Math.round((mg * phase + eg * (24 - phase)) / 24);

  // mop-up: drive a bare king to the edge and bring ours closer, so bots can actually deliver mate
  if (phase <= 8) {
    const diff = nonPawn[0] + pawns[0] * 100 - nonPawn[1] - pawns[1] * 100;
    if (Math.abs(diff) >= 300) {
      const strong = diff > 0 ? 0 : 1;
      const weak = strong ^ 1;
      if (pawns[weak] === 0 || Math.abs(diff) >= 500) {
        const wk = p.kings[weak];
        const sk = p.kings[strong];
        const cf = wk & 7;
        const cr = wk >> 4;
        const centerDist = Math.max(3 - cf, cf - 4) + Math.max(3 - cr, cr - 4);
        const kd = Math.abs((wk & 7) - (sk & 7)) + Math.abs((wk >> 4) - (sk >> 4));
        const bonus = centerDist * 12 + (14 - kd) * 5;
        score += strong === 0 ? bonus : -bonus;
      }
    }
  }

  // drawish material → shrink the score
  if (pawns[0] === 0 && nonPawn[0] - nonPawn[1] < 400 && score > 0) score >>= 2;
  if (pawns[1] === 0 && nonPawn[1] - nonPawn[0] < 400 && score < 0) score >>= 2;

  if (p.variant === "koth") {
    score += KOTH_DIST[hillDist(p.kings[0])] - KOTH_DIST[hillDist(p.kings[1])];
  } else if (p.variant === "threecheck") {
    score += THREECHECK_BONUS[p.checks[0]] - THREECHECK_BONUS[p.checks[1]];
  }

  score += p.side === WHITE ? 10 : -10; // tempo
  return p.side === WHITE ? score : -score;
}

/** Piece values for move ordering / SEE-ish heuristics. */
export const ORDER_VAL = [0, 100, 310, 330, 500, 950, 2000];
