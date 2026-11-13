// placeholder — replaced by the generated, machine-verified set
export interface Puzzle {
  /** position before the opponent's setup move */
  fen: string;
  /** the opponent's setup move (UCI) */
  pre: string;
  /** solution: player, opponent, player … (UCI). Any checkmating move is also accepted. */
  line: string[];
  kind: "m1" | "m2" | "mat";
  tier: number;
}
export const PUZZLES: Puzzle[] = [
  { fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR b KQkq - 3 3", pre: "a7a6", line: ["f3f7"], kind: "m1", tier: 1 },
];
