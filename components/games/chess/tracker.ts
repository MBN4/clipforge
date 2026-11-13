// Gives every piece on the board a stable identity across positions, so a React key can follow it and
// CSS transitions slide it from square to square (moves, takebacks, history jumps, castling — all of it).
// Pieces that disappear become short-lived "ghosts" that fade out (captures).

export interface TrackedPiece {
  id: number;
  code: number;
  sq: number; // 0..63, a1 = 0
}

export interface Layout {
  pieces: TrackedPiece[];
  ghosts: TrackedPiece[];
}

const dist = (a: number, b: number) => Math.max(Math.abs((a & 7) - (b & 7)), Math.abs((a >> 3) - (b >> 3)));

export class PieceTracker {
  private nextId = 1;
  private lastKey: string | null = null;
  private last: Layout = { pieces: [], ghosts: [] };

  /** Idempotent for the same key (safe under StrictMode double render). */
  update(board: number[], key: string, hint: { from: number; to: number } | null): Layout {
    if (key === this.lastKey) return this.last;
    const prev = this.last.pieces;
    const used = new Set<number>();
    const out: TrackedPiece[] = [];
    const pending: { code: number; sq: number }[] = [];
    // 1) same piece on the same square keeps its id
    for (let sq = 0; sq < 64; sq++) {
      const code = board[sq];
      if (!code) continue;
      const p = prev.find((q) => q.sq === sq && q.code === code && !used.has(q.id));
      if (p && !(hint && sq === hint.to)) {
        used.add(p.id);
        out.push({ id: p.id, code, sq });
      } else pending.push({ code, sq });
    }
    // 2) the hinted move: the piece that left `from` goes to `to` (even if it promoted)
    if (hint) {
      const i = pending.findIndex((n) => n.sq === hint.to);
      const src = prev.find((q) => q.sq === hint.from && !used.has(q.id));
      if (i >= 0 && src && ((src.code & 8) === (pending[i].code & 8))) {
        used.add(src.id);
        out.push({ id: src.id, code: pending[i].code, sq: hint.to });
        pending.splice(i, 1);
      }
    }
    // 3) everything else: nearest unused previous piece of the same kind
    for (const n of pending) {
      let best: TrackedPiece | null = null;
      for (const q of prev) {
        if (used.has(q.id) || q.code !== n.code) continue;
        if (!best || dist(q.sq, n.sq) < dist(best.sq, n.sq)) best = q;
      }
      if (best) {
        used.add(best.id);
        out.push({ id: best.id, code: n.code, sq: n.sq });
      } else out.push({ id: this.nextId++, code: n.code, sq: n.sq });
    }
    const ghosts = prev.filter((q) => !used.has(q.id));
    out.sort((a, b) => a.id - b.id);
    this.last = { pieces: out, ghosts };
    this.lastKey = key;
    return this.last;
  }
}
