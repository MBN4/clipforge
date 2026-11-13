// UNO-style rules engine: pure, deterministic given an rng, no DOM/React.
// Every action returns a new state plus an ordered list of "steps" (event + state snapshot after
// that event) which the UI plays back as animations.
import { COLORS, Card, Color, Rng, buildDeck, cardPoints, shuffle } from "./cards";

export type Difficulty = "easy" | "medium" | "hard";

export interface UnoSettings {
  /** total seats, human is seat 0 (2-4) */
  players: number;
  difficulty: Difficulty;
  /** Draw Two on Draw Two / Draw Four on Draw Four accumulates */
  stacking: boolean;
  /** playing a 7 swaps hands with a player, a 0 rotates all hands */
  sevenZero: boolean;
  /** an identical card can be played out of turn */
  jumpIn: boolean;
  /** when you can't play you draw until you get a playable card */
  drawUntil: boolean;
  /** Wild Draw Four may be played any time and can be challenged */
  challenge: boolean;
  startCards: number;
  /** 0 = single round, otherwise play to this score */
  target: number;
}

export const DEFAULT_SETTINGS: UnoSettings = {
  players: 3,
  difficulty: "medium",
  stacking: false,
  sevenZero: false,
  jumpIn: false,
  drawUntil: false,
  challenge: false,
  startCards: 7,
  target: 0,
};

export interface UnoState {
  settings: UnoSettings;
  n: number;
  hands: Card[][];
  /** top of the pile is the LAST element */
  draw: Card[];
  /** top card is the LAST element */
  discard: Card[];
  dir: 1 | -1;
  current: number;
  /** the colour in force (the top card's colour, or the one chosen for a wild) */
  color: Color;
  /** accumulated draw penalty waiting for `current` (stacking / challenge) */
  pending: number;
  pendingKind: "draw2" | "wild4" | null;
  /** an open challenge against the last Wild Draw Four */
  challenge: { offender: number; legal: boolean } | null;
  /** id of the card `current` just drew and may still play */
  drawn: number | null;
  /** has this player pressed UNO! */
  uno: boolean[];
  /** a player who went down to one card without calling UNO and can still be caught */
  vulnerable: number | null;
  /** lacks[p][colourIndex] — p drew when that colour was asked, so (probably) has none */
  lacks: boolean[][];
  winner: number | null;
  /** points the winner scores (sum of other hands) */
  points: number;
  /** consecutive passes with nothing drawn (both piles exhausted) */
  stall: number;
  startNote: "skip" | "reverse" | "draw2" | "wild" | null;
  turnCount: number;
}

export type UnoEvent =
  | { t: "play"; p: number; card: Card; color: Color; jump: boolean }
  | { t: "skip"; p: number }
  | { t: "reverse" }
  | { t: "draw"; p: number; cards: Card[]; reason: "draw" | "penalty" | "catch" | "challenge" }
  | { t: "reshuffle" }
  | { t: "swap"; a: number; b: number }
  | { t: "rotate" }
  | { t: "uno"; p: number }
  | { t: "catch"; p: number; by: number }
  | { t: "challenge"; by: number; offender: number; success: boolean }
  | { t: "pass"; p: number }
  | { t: "turn" }
  | { t: "roundEnd"; winner: number; points: number; stalled: boolean };

export interface Step {
  event: UnoEvent;
  state: UnoState;
}

export type Action =
  | { type: "play"; player: number; cardId: number; color?: Color; target?: number }
  | { type: "draw"; player: number }
  | { type: "pass"; player: number }
  | { type: "accept"; player: number }
  | { type: "challenge"; player: number }
  | { type: "uno"; player: number }
  | { type: "catch"; player: number };

export interface Result {
  ok: boolean;
  error?: string;
  state: UnoState;
  steps: Step[];
}

const mod = (a: number, n: number) => ((a % n) + n) % n;
export const colorIndex = (c: Color) => COLORS.indexOf(c);

export function seatAfter(s: { n: number; dir: 1 | -1 }, from: number, k = 1): number {
  return mod(from + s.dir * k, s.n);
}

export function topCard(s: UnoState): Card {
  return s.discard[s.discard.length - 1];
}

export function cloneState(s: UnoState): UnoState {
  return {
    ...s,
    hands: s.hands.map((h) => h.slice()),
    draw: s.draw.slice(),
    discard: s.discard.slice(),
    uno: s.uno.slice(),
    lacks: s.lacks.map((l) => l.slice()),
  };
}

export function handPoints(hand: Card[]): number {
  return hand.reduce((a, c) => a + cardPoints(c), 0);
}

export function totalCards(s: UnoState): number {
  return s.draw.length + s.discard.length + s.hands.reduce((a, h) => a + h.length, 0);
}

/** Deal a fresh round. `starter` is the seat that plays first. */
export function newRound(settings: UnoSettings, starter: number, rng: Rng = Math.random): UnoState {
  const n = settings.players;
  const deck = shuffle(buildDeck(), rng);
  const hands: Card[][] = Array.from({ length: n }, () => []);
  for (let k = 0; k < settings.startCards; k++) for (let i = 0; i < n; i++) hands[i].push(deck.pop() as Card);
  let first = deck.pop() as Card;
  while (first.value === "wild4") {
    deck.splice(Math.floor(rng() * (deck.length + 1)), 0, first);
    first = deck.pop() as Card;
  }
  const s: UnoState = {
    settings,
    n,
    hands,
    draw: deck,
    discard: [first],
    dir: 1,
    current: starter,
    color: first.color ?? COLORS[Math.floor(rng() * 4)],
    pending: 0,
    pendingKind: null,
    challenge: null,
    drawn: null,
    uno: Array(n).fill(false),
    vulnerable: null,
    lacks: Array.from({ length: n }, () => [false, false, false, false]),
    winner: null,
    points: 0,
    stall: 0,
    startNote: null,
    turnCount: 0,
  };
  // the opening card's effect lands on the first player
  switch (first.value) {
    case "skip":
      s.startNote = "skip";
      s.current = seatAfter(s, starter);
      break;
    case "reverse":
      s.startNote = "reverse";
      s.dir = -1;
      break;
    case "draw2": {
      s.startNote = "draw2";
      for (let i = 0; i < 2; i++) {
        const c = s.draw.pop();
        if (c) s.hands[starter].push(c);
      }
      s.current = seatAfter(s, starter);
      break;
    }
    case "wild":
      s.startNote = "wild";
      break;
    default:
  }
  return s;
}

// ---------- legality ----------

export function holdsColor(s: UnoState, p: number, color: Color = s.color): boolean {
  return s.hands[p].some((c) => c.color === color);
}

/** null when `card` may be played by `p` on their own turn; otherwise a short reason. */
export function unplayableReason(s: UnoState, p: number, card: Card): string | null {
  if (s.pending > 0) {
    if (!s.settings.stacking) return "Take the cards first";
    if (card.value !== s.pendingKind) return s.pendingKind === "draw2" ? "Stack a Draw Two or take the cards" : "Stack a Draw Four or take the cards";
    return null;
  }
  if (card.value === "wild") return null;
  if (card.value === "wild4") {
    if (!s.settings.challenge && holdsColor(s, p)) return "Wild Draw Four only works when you have no card in the current colour";
    return null;
  }
  const top = topCard(s);
  if (card.color === s.color || card.value === top.value) return null;
  return "That card doesn't match the colour or number";
}

/** Cards `p` could play right now on their own turn. */
export function playableCards(s: UnoState, p: number): Card[] {
  if (s.winner !== null) return [];
  const hand = s.hands[p];
  const pool = s.drawn !== null ? hand.filter((c) => c.id === s.drawn) : hand;
  return pool.filter((c) => unplayableReason(s, p, c) === null);
}

export function canJumpIn(s: UnoState, p: number, card: Card): boolean {
  if (!s.settings.jumpIn || s.winner !== null || s.pending > 0 || p === s.current) return false;
  const top = topCard(s);
  return card.color !== null && top.color === card.color && top.value === card.value;
}

export function jumpInCards(s: UnoState, p: number): Card[] {
  return s.hands[p].filter((c) => canJumpIn(s, p, c));
}

/** Would playing a Wild Draw Four right now be a legal (non-bluff) play? */
export const wild4IsLegal = (s: UnoState, p: number) => !holdsColor(s, p);

// ---------- the reducer ----------

export function applyAction(state: UnoState, action: Action, rng: Rng = Math.random, record = true): Result {
  const fail = (error: string): Result => ({ ok: false, error, state, steps: [] });
  if (state.winner !== null) return fail("The round is over");
  const w = cloneState(state);
  const steps: Step[] = [];
  const rec = (event: UnoEvent) => {
    if (record) steps.push({ event, state: cloneState(w) });
  };
  const p = action.player;
  if (p < 0 || p >= w.n) return fail("No such player");
  const nxt = (from: number, k = 1) => seatAfter(w, from, k);

  const reshuffle = () => {
    const top = w.discard.pop() as Card;
    const rest = w.discard;
    w.discard = [top];
    w.draw = shuffle(rest, rng).concat(w.draw);
    rec({ t: "reshuffle" });
  };
  const take = (to: number, k: number): Card[] => {
    const got: Card[] = [];
    for (let i = 0; i < k; i++) {
      if (w.draw.length === 0 && w.discard.length > 1) reshuffle();
      const c = w.draw.pop();
      if (!c) break;
      got.push(c);
      w.hands[to].push(c);
    }
    return got;
  };
  const draw = (to: number, k: number, reason: "draw" | "penalty" | "catch" | "challenge") => {
    if (w.draw.length < k && w.discard.length > 1) reshuffle();
    const got = take(to, k);
    if (got.length) {
      rec({ t: "draw", p: to, cards: got, reason });
      w.stall = 0;
    }
    return got;
  };
  const normalise = () => {
    for (let i = 0; i < w.n; i++) if (w.hands[i].length >= 3 || w.hands[i].length === 0) w.uno[i] = false;
    w.turnCount++;
  };
  const endTurn = () => {
    normalise();
    rec({ t: "turn" });
    return { ok: true, state: w, steps } as Result;
  };
  const finish = (winner: number, stalled: boolean) => {
    w.winner = winner;
    w.points = w.hands.reduce((a, h, i) => (i === winner ? a : a + handPoints(h)), 0);
    w.pending = 0;
    w.pendingKind = null;
    w.challenge = null;
    w.drawn = null;
    w.vulnerable = null;
    rec({ t: "roundEnd", winner, points: w.points, stalled });
    return { ok: true, state: w, steps } as Result;
  };
  const stalledFinish = () => {
    // nobody can move: fewest cards wins, ties broken by lowest points
    let best = 0;
    for (let i = 1; i < w.n; i++) {
      const a = w.hands[i].length;
      const b = w.hands[best].length;
      if (a < b || (a === b && handPoints(w.hands[i]) < handPoints(w.hands[best]))) best = i;
    }
    return finish(best, true);
  };

  switch (action.type) {
    case "uno": {
      const len = w.hands[p].length;
      if (len === 2 && (p === w.current || w.settings.jumpIn)) w.uno[p] = true;
      else if (len === 1 && w.vulnerable === p) {
        w.uno[p] = true;
        w.vulnerable = null;
      } else if (len === 1 && w.uno[p]) return fail("Already called");
      else return fail("UNO! is for when you're about to play down to one card");
      rec({ t: "uno", p });
      return { ok: true, state: w, steps };
    }
    case "catch": {
      const v = w.vulnerable;
      if (v === null || v === p) return fail("Nobody to catch");
      w.vulnerable = null;
      rec({ t: "catch", p: v, by: p });
      draw(v, 2, "catch");
      w.uno[v] = false;
      rec({ t: "turn" });
      return { ok: true, state: w, steps };
    }
    default:
  }

  // every remaining action is a turn action; it ends any open catch window
  w.vulnerable = null;

  switch (action.type) {
    case "play": {
      const hand = w.hands[p];
      const idx = hand.findIndex((c) => c.id === action.cardId);
      if (idx < 0) return fail("You don't hold that card");
      const card = hand[idx];
      let jump = false;
      if (p !== w.current) {
        if (!canJumpIn(w, p, card)) return fail("It's not your turn");
        jump = true;
      } else {
        if (w.drawn !== null && card.id !== w.drawn) return fail("You can only play the card you just drew");
        const why = unplayableReason(w, p, card);
        if (why) return fail(why);
      }
      let chosen: Color = card.color as Color;
      if (card.color === null) {
        if (!action.color || !COLORS.includes(action.color)) return fail("Choose a colour");
        chosen = action.color;
      }
      const swaps = w.settings.sevenZero && card.value === "7" && hand.length > 1;
      if (swaps && (action.target === undefined || action.target === p || action.target < 0 || action.target >= w.n)) return fail("Choose a player to swap with");

      const legalFour = card.value === "wild4" ? !holdsColor(w, p) : true;
      const prevPending = w.pending;
      // --- commit the play ---
      hand.splice(idx, 1);
      w.discard.push(card);
      w.color = chosen;
      w.drawn = null;
      w.stall = 0;
      if (jump) w.current = p;
      if (card.color) w.lacks[p][colorIndex(card.color)] = false;
      rec({ t: "play", p, card, color: chosen, jump });

      switch (card.value) {
        case "skip": {
          const skipped = nxt(p);
          rec({ t: "skip", p: skipped });
          w.current = nxt(p, 2);
          break;
        }
        case "reverse":
          w.dir = (w.dir === 1 ? -1 : 1) as 1 | -1;
          rec({ t: "reverse" });
          if (w.n === 2) {
            rec({ t: "skip", p: nxt(p) });
            w.current = p;
          } else w.current = nxt(p);
          break;
        case "draw2":
          if (w.settings.stacking) {
            w.pending += 2;
            w.pendingKind = "draw2";
            w.current = nxt(p);
          } else {
            const victim = nxt(p);
            draw(victim, 2, "penalty");
            rec({ t: "skip", p: victim });
            w.current = nxt(p, 2);
          }
          break;
        case "wild4":
          if (w.settings.stacking || w.settings.challenge) {
            w.pending += 4;
            w.pendingKind = "wild4";
            w.challenge = w.settings.challenge && prevPending === 0 ? { offender: p, legal: legalFour } : null;
            w.current = nxt(p);
          } else {
            const victim = nxt(p);
            draw(victim, 4, "penalty");
            rec({ t: "skip", p: victim });
            w.current = nxt(p, 2);
          }
          break;
        case "7":
          if (swaps) {
            const t = action.target as number;
            [w.hands[p], w.hands[t]] = [w.hands[t], w.hands[p]];
            [w.lacks[p], w.lacks[t]] = [w.lacks[t], w.lacks[p]];
            w.uno[p] = false;
            w.uno[t] = false;
            rec({ t: "swap", a: p, b: t });
          }
          w.current = nxt(p);
          break;
        case "0":
          if (w.settings.sevenZero && w.hands[p].length > 0) {
            const old = w.hands.map((h) => h);
            const oldLacks = w.lacks.map((l) => l);
            for (let i = 0; i < w.n; i++) {
              w.hands[nxt(i)] = old[i];
              w.lacks[nxt(i)] = oldLacks[i];
            }
            w.uno.fill(false);
            rec({ t: "rotate" });
          }
          w.current = nxt(p);
          break;
        default:
          w.current = nxt(p);
      }

      if (w.hands[p].length === 0) {
        // a winning Draw card still bites before points are counted
        if (w.pending > 0) {
          const victim = w.current;
          draw(victim, w.pending, "penalty");
          w.pending = 0;
          w.pendingKind = null;
          w.challenge = null;
        }
        return finish(p, false);
      }
      if (w.hands[p].length === 1 && !w.uno[p]) w.vulnerable = p;
      return endTurn();
    }

    case "draw": {
      if (p !== w.current) return fail("It's not your turn");
      if (w.pending > 0) return fail("Take the penalty cards first");
      if (w.drawn !== null) return fail("You already drew — play that card or pass");
      if (w.settings.drawUntil && playableCards(w, p).length > 0) return fail("You have a playable card");
      if (!holdsColor(w, p)) w.lacks[p][colorIndex(w.color)] = true;
      const got: Card[] = [];
      let found: Card | null = null;
      const limit = w.settings.drawUntil ? 200 : 1;
      for (let i = 0; i < limit && !found; i++) {
        if (w.draw.length === 0 && w.discard.length > 1) reshuffle();
        const c = take(p, 1)[0];
        if (!c) break;
        got.push(c);
        if (unplayableReason(w, p, c) === null) found = c;
      }
      if (got.length) {
        rec({ t: "draw", p, cards: got, reason: "draw" });
        w.stall = 0;
      }
      if (found) {
        w.drawn = found.id;
        normalise();
        rec({ t: "turn" });
        return { ok: true, state: w, steps };
      }
      if (!got.length) {
        w.stall++;
        if (w.stall >= w.n) return stalledFinish();
      }
      rec({ t: "pass", p });
      w.current = nxt(p);
      return endTurn();
    }

    case "pass": {
      if (p !== w.current) return fail("It's not your turn");
      if (w.drawn === null) return fail("Draw a card first");
      w.drawn = null;
      rec({ t: "pass", p });
      w.current = nxt(p);
      return endTurn();
    }

    case "accept": {
      if (p !== w.current) return fail("It's not your turn");
      if (w.pending === 0) return fail("Nothing to take");
      const n = w.pending;
      w.pending = 0;
      w.pendingKind = null;
      w.challenge = null;
      draw(p, n, "penalty");
      rec({ t: "skip", p });
      w.current = nxt(p);
      return endTurn();
    }

    case "challenge": {
      if (p !== w.current) return fail("It's not your turn");
      const ch = w.challenge;
      if (!ch || w.pending === 0) return fail("Nothing to challenge");
      w.challenge = null;
      if (!ch.legal) {
        // the bluffer is punished and the challenger plays on
        w.pending = 0;
        w.pendingKind = null;
        rec({ t: "challenge", by: p, offender: ch.offender, success: true });
        draw(ch.offender, 4, "challenge");
        return endTurn();
      }
      // challenge failed: 4 + 2 for the wrong call, and the turn is lost
      w.pending = 0;
      w.pendingKind = null;
      rec({ t: "challenge", by: p, offender: ch.offender, success: false });
      draw(p, 6, "challenge");
      rec({ t: "skip", p });
      w.current = nxt(p);
      return endTurn();
    }
  }
  return fail("Unknown action");
}
