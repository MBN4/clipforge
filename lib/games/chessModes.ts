export type GameMode = "classic" | "chaos" | "koth" | "threecheck";

export const MODES: { key: GameMode; label: string; blurb: string }[] = [
  { key: "classic", label: "Classic", blurb: "Standard chess." },
  { key: "chaos", label: "Chaos", blurb: "Shuffled back rank. No castling. Anything goes." },
  { key: "koth", label: "King of the Hill", blurb: "Walk your king to the center to win." },
  { key: "threecheck", label: "Three-Check", blurb: "Deliver check three times to win." },
];

const CENTER_SQUARES = ["d4", "d5", "e4", "e5"];

function shuffledBackRank(): string[] {
  const squares = [0, 1, 2, 3, 4, 5, 6, 7];
  const light = squares.filter((i) => i % 2 === 0);
  const dark = squares.filter((i) => i % 2 === 1);

  const rank: (string | null)[] = Array(8).fill(null);
  rank[light[Math.floor(Math.random() * light.length)]] = "b";
  const darkSquares = dark.filter((i) => rank[i] === null);
  rank[darkSquares[Math.floor(Math.random() * darkSquares.length)]] = "b";

  const remainingPieces = ["q", "n", "n", "r", "r", "k"];
  const emptyIdx = rank.map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0);

  // Shuffle remaining pieces, then place king between the two rooks so a
  // future castling implementation would still be plausible (not used yet).
  for (let i = remainingPieces.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remainingPieces[i], remainingPieces[j]] = [remainingPieces[j], remainingPieces[i]];
  }

  emptyIdx.forEach((idx, i) => {
    rank[idx] = remainingPieces[i];
  });

  // Ensure king ends up strictly between the two rooks; if not, swap.
  const kingIdx = rank.indexOf("k");
  const rookIdxs = rank.reduce<number[]>((acc, v, i) => (v === "r" ? [...acc, i] : acc), []);
  if (rookIdxs.length === 2 && !(kingIdx > rookIdxs[0] && kingIdx < rookIdxs[1])) {
    const mid = emptyIdx[Math.floor(emptyIdx.length / 2)];
    const midVal = rank[mid];
    rank[mid] = "k";
    rank[kingIdx] = midVal;
  }

  return rank as string[];
}

export function startingFen(mode: GameMode): string {
  if (mode !== "chaos") {
    return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  }
  const back = shuffledBackRank();
  const whiteRank = back.map((p) => p.toUpperCase()).join("");
  const blackRank = back.join("");
  return `${blackRank}/pppppppp/8/8/8/8/PPPPPPPP/${whiteRank} w - - 0 1`;
}

export interface ModeWinCheck {
  winner: "w" | "b" | null;
  reason: string;
}

/** Call after every move with the mover's color and the post-move FEN. */
export function checkModeWin(
  mode: GameMode,
  moverColor: "w" | "b",
  board: ({ type: string; color: "w" | "b" } | null)[][],
  deliveredCheck: boolean,
  checkCounts: { w: number; b: number }
): ModeWinCheck {
  if (mode === "koth") {
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = board[r][f];
        if (sq?.type === "k") {
          const square = `${files[f]}${8 - r}`;
          if (CENTER_SQUARES.includes(square)) {
            return { winner: sq.color, reason: `${sq.color === "w" ? "White" : "Black"} king reached the center` };
          }
        }
      }
    }
  }

  if (mode === "threecheck" && deliveredCheck) {
    const next = { ...checkCounts, [moverColor]: checkCounts[moverColor] + 1 };
    if (next[moverColor] >= 3) {
      return { winner: moverColor, reason: `${moverColor === "w" ? "White" : "Black"} delivered 3 checks` };
    }
  }

  return { winner: null, reason: "" };
}
