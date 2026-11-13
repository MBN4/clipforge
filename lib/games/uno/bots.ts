// Bot brains: Easy = random legal, Medium = colour-aware heuristics, Hard = adds card counting,
// opponent colour tracking and tactical timing. Pure TS.
import { COLORS, Card, Color, Rng, isWild } from "./cards";
import { Action, Difficulty, UnoState, colorIndex, jumpInCards, playableCards, seatAfter, unplayableReason } from "./engine";

const pick = <T>(arr: T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)];

/** probability that a bot remembers to say UNO */
export const unoCallChance: Record<Difficulty, number> = { easy: 0.55, medium: 0.88, hard: 1 };
/** probability that a bot (when next in turn) catches a human who forgot UNO */
export const catchChance: Record<Difficulty, number> = { easy: 0.3, medium: 0.65, hard: 0.97 };
const jumpChance: Record<Difficulty, number> = { easy: 0, medium: 0.3, hard: 0.65 };
const challengeChance: Record<Difficulty, number> = { easy: 0.12, medium: 0.3, hard: 0.5 };
const bluffChance: Record<Difficulty, number> = { easy: 0, medium: 0.08, hard: 0.2 };

export function botCallsUno(d: Difficulty, rng: Rng): boolean {
  return rng() < unoCallChance[d];
}
export function botCatches(d: Difficulty, rng: Rng): boolean {
  return rng() < catchChance[d];
}

function colourCounts(hand: Card[]): Record<Color, number> {
  const c: Record<Color, number> = { red: 0, yellow: 0, green: 0, blue: 0 };
  for (const k of hand) if (k.color) c[k.color]++;
  return c;
}

/** Cards of each colour we haven't seen (not in our hand / discard pile) — i.e. in draw pile or opponents' hands. */
function unseenColours(s: UnoState, me: number): Record<Color, number> {
  const seen: Record<Color, number> = { red: 0, yellow: 0, green: 0, blue: 0 };
  for (const k of s.discard) if (k.color) seen[k.color]++;
  for (const k of s.hands[me]) if (k.color) seen[k.color]++;
  const out = { red: 0, yellow: 0, green: 0, blue: 0 };
  for (const c of COLORS) out[c] = 25 - seen[c];
  return out;
}

function chooseColor(s: UnoState, p: number, d: Difficulty, rest: Card[], rng: Rng): Color {
  if (d === "easy") return pick(COLORS, rng);
  const counts = colourCounts(rest);
  const next = seatAfter(s, p);
  const unseen = unseenColours(s, p);
  let best: Color[] = [];
  let bestScore = -Infinity;
  for (const c of COLORS) {
    let sc = counts[c] * 3 + rng() * 0.5;
    if (d === "hard") {
      if (s.lacks[next]?.[colorIndex(c)]) sc += 2.5;
      sc += unseen[c] * 0.05;
    }
    if (sc > bestScore + 1e-9) {
      bestScore = sc;
      best = [c];
    }
  }
  return best[0] ?? pick(COLORS, rng);
}

function chooseTarget(s: UnoState, p: number, d: Difficulty, rng: Rng): number {
  const others = Array.from({ length: s.n }, (_, i) => i).filter((i) => i !== p);
  if (d === "easy") return pick(others, rng);
  // swap with whoever holds the fewest cards (hard: avoid handing a nearly-empty hand a big one)
  let best = others[0];
  for (const o of others) if (s.hands[o].length < s.hands[best].length) best = o;
  return best;
}

function scoreCard(s: UnoState, p: number, card: Card, d: Difficulty, rng: Rng): number {
  const hand = s.hands[p];
  const next = seatAfter(s, p);
  const nextLen = s.hands[next].length;
  const counts = colourCounts(hand);
  let sc = 0;
  if (card.value === "wild") sc -= 40;
  else if (card.value === "wild4") sc -= 55;
  else {
    sc += counts[card.color as Color] * 3;
    if (/^\d$/.test(card.value)) sc += Number(card.value) * 0.4;
    else sc += 3;
  }
  const threat = nextLen <= 2;
  const strike = card.value === "skip" || card.value === "draw2" || card.value === "wild4" || (card.value === "reverse" && s.n === 2);
  if (threat && strike) sc += d === "hard" ? 60 : 35;
  else if (d === "hard" && nextLen <= 3 && strike) sc += 12;
  // second-to-last card: keep a wild for the finish
  if (hand.length === 2) {
    const other = hand.find((c) => c.id !== card.id);
    if (other && isWild(other) && !isWild(card)) sc += 30;
  }
  // desperate: shed wilds when the table is about to win
  if (s.hands.some((h, i) => i !== p && h.length === 1) && isWild(card)) sc += 25;
  if (d === "hard") {
    if (card.color && s.lacks[next]?.[colorIndex(card.color)]) sc += 8;
    // don't burn the last card of a big colour group on a skip-less number early
    if (card.color && counts[card.color] === 1 && hand.length > 4) sc -= 2;
    // count: prefer colours that are still plentiful elsewhere to keep the table colourful for us
    const unseen = unseenColours(s, p);
    if (card.color) sc += unseen[card.color] * 0.03;
  }
  if (s.settings.sevenZero) {
    const mine = hand.length - 1;
    if (card.value === "7") {
      const fewest = Math.min(...s.hands.map((h, i) => (i === p ? 99 : h.length)));
      sc += (mine - fewest) * 3;
    } else if (card.value === "0") {
      const prev = seatAfter(s, p, -1);
      sc += (mine - s.hands[prev].length) * 2 + (nextLen <= 2 ? 6 : 0);
    }
  }
  return sc + rng() * (d === "hard" ? 0.5 : 2);
}

function playAction(s: UnoState, p: number, d: Difficulty, card: Card, rng: Rng): Action {
  const rest = s.hands[p].filter((c) => c.id !== card.id);
  const a: Action = { type: "play", player: p, cardId: card.id };
  if (isWild(card)) a.color = chooseColor(s, p, d, rest, rng);
  if (s.settings.sevenZero && card.value === "7" && rest.length > 0) a.target = chooseTarget(s, p, d, rng);
  return a;
}

/** What should bot `p` do now (it must be `p`'s turn)? */
export function chooseBotAction(s: UnoState, p: number, d: Difficulty, rng: Rng = Math.random): Action {
  const hand = s.hands[p];

  if (s.pending > 0) {
    const stackers = playableCards(s, p);
    if (s.challenge && stackers.length === 0 && rng() < challengeChance[d]) return { type: "challenge", player: p };
    if (stackers.length && (d !== "easy" || rng() < 0.85)) {
      const c = d === "easy" ? pick(stackers, rng) : stackers[0];
      return playAction(s, p, d, c, rng);
    }
    return { type: "accept", player: p };
  }

  let legal = playableCards(s, p);
  // with the challenge rule on, an off-colour Wild Draw Four is a bluff: only occasionally
  legal = legal.filter((c) => c.value !== "wild4" || !s.settings.challenge || !s.hands[p].some((k) => k.color === s.color) || rng() < bluffChance[d]);
  if (!legal.length) return { type: s.drawn !== null ? "pass" : "draw", player: p };
  if (hand.length === 1) return playAction(s, p, d, legal[0], rng);

  if (d === "easy") return playAction(s, p, d, pick(legal, rng), rng);
  let best = legal[0];
  let bestScore = -Infinity;
  for (const c of legal) {
    const sc = scoreCard(s, p, c, d, rng);
    if (sc > bestScore) {
      bestScore = sc;
      best = c;
    }
  }
  return playAction(s, p, d, best, rng);
}

/** A bot (other than the current player) that wants to jump in right now, if any. */
export function chooseJumpIn(s: UnoState, d: Difficulty, botSeats: number[], rng: Rng = Math.random): Action | null {
  if (!s.settings.jumpIn || s.winner !== null || s.pending > 0) return null;
  for (const b of botSeats) {
    if (b === s.current) continue;
    const cards = jumpInCards(s, b);
    if (cards.length && rng() < jumpChance[d]) return playAction(s, b, d, cards[0], rng);
  }
  return null;
}

/** For tests / UI: does this action pass the engine's legality gate? */
export function isPlayLegal(s: UnoState, a: Action): boolean {
  if (a.type !== "play") return true;
  const c = s.hands[a.player].find((k) => k.id === a.cardId);
  return !!c && unplayableReason(s, a.player, c) === null;
}
