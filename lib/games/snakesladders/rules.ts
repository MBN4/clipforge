// Pure rules engine: one immutable state, one `rollTurn` transition producing an animation script.
import { Layout, Overshoot, PowerKind, jumpMaps, lastSquare, movePath } from "./board";

export interface Settings {
  overshoot: Overshoot;
  extraTurnOnSix: boolean;
  powerups: boolean;
}

export interface PlayerState {
  pos: number;
  shield: boolean;
  rolls: number;
  bitten: number;
  climbed: number;
}

export interface GameState {
  layout: Layout;
  settings: Settings;
  players: PlayerState[];
  current: number;
  sixStreak: number;
  streakStart: number;
  winner: number | null;
  /** index of the leader a gift square lets the current player swap with, while the choice is pending */
  pendingGift: number | null;
  pendingExtra: boolean;
}

export interface TurnResult {
  player: number;
  roll: number;
  /** third six in a row: the move is cancelled and the piece returns to where the streak began */
  forfeited: boolean;
  forfeitTo: number | null;
  hops: number[];
  bounced: boolean;
  stayed: boolean;
  landed: number;
  jump: { type: "ladder" | "snake"; from: number; to: number } | null;
  shielded: boolean;
  power: PowerKind | null;
  giftLeader: number | null;
  endPos: number;
  won: boolean;
  extra: boolean;
}

export function newGame(layout: Layout, settings: Settings, playerCount: number): GameState {
  return {
    layout,
    settings,
    players: Array.from({ length: playerCount }, () => ({ pos: 1, shield: false, rolls: 0, bitten: 0, climbed: 0 })),
    current: 0,
    sixStreak: 0,
    streakStart: 1,
    winner: null,
    pendingGift: null,
    pendingExtra: false,
  };
}

export function rollTurn(s: GameState, roll: number): { state: GameState; result: TurnResult } {
  if (s.winner !== null) throw new Error("game is over");
  if (s.pendingGift !== null) throw new Error("gift choice pending");
  if (roll < 1 || roll > 6 || !Number.isInteger(roll)) throw new Error("bad roll " + roll);
  const { layout, settings } = s;
  const last = lastSquare(layout.size);
  const maps = jumpMaps(layout);
  const players = s.players.map((p) => ({ ...p }));
  const i = s.current;
  const n = players.length;
  const p = players[i];
  p.rolls++;
  const result: TurnResult = {
    player: i, roll, forfeited: false, forfeitTo: null, hops: [], bounced: false, stayed: false,
    landed: p.pos, jump: null, shielded: false, power: null, giftLeader: null, endPos: p.pos, won: false, extra: false,
  };

  const six = roll === 6 && settings.extraTurnOnSix;
  let streak = s.sixStreak;
  let streakStart = s.streakStart;
  if (six) {
    if (streak === 0) streakStart = p.pos;
    streak++;
  } else streak = 0;

  if (six && streak >= 3) {
    result.forfeited = true;
    result.forfeitTo = streakStart;
    p.pos = streakStart;
    result.landed = result.endPos = p.pos;
    return { state: { ...s, players, current: (i + 1) % n, sixStreak: 0, streakStart: 1 }, result };
  }

  const mp = movePath(p.pos, roll, layout.size, settings.overshoot);
  result.hops = mp.path;
  result.bounced = mp.bounced;
  result.stayed = mp.stayed;
  p.pos = mp.end;
  result.landed = mp.end;

  const lad = maps.ladder.get(p.pos);
  const snk = maps.snake.get(p.pos);
  if (lad !== undefined) {
    result.jump = { type: "ladder", from: p.pos, to: lad };
    p.pos = lad;
    p.climbed++;
  } else if (snk !== undefined) {
    if (p.shield) {
      p.shield = false;
      result.shielded = true;
    } else {
      result.jump = { type: "snake", from: p.pos, to: snk };
      p.pos = snk;
      p.bitten++;
    }
  }
  result.endPos = p.pos;
  const won = p.pos === last;
  result.won = won;

  let bolt = false;
  let gift: number | null = null;
  if (!won && !result.jump && !result.shielded) {
    const pw = maps.power.get(p.pos);
    if (pw) {
      result.power = pw;
      if (pw === "bolt") bolt = true;
      else if (pw === "shield") p.shield = true;
      else {
        let leader = -1;
        players.forEach((q, k) => {
          if (k !== i && q.pos > p.pos && (leader < 0 || q.pos > players[leader].pos)) leader = k;
        });
        if (leader >= 0) gift = leader;
      }
    }
  }
  const extra = !won && (six || bolt);
  result.extra = extra;
  result.giftLeader = gift;

  if (won) return { state: { ...s, players, winner: i, sixStreak: 0, pendingGift: null }, result };
  if (gift !== null) {
    return { state: { ...s, players, sixStreak: streak, streakStart, pendingGift: gift, pendingExtra: extra }, result };
  }
  return {
    state: { ...s, players, current: extra ? i : (i + 1) % n, sixStreak: extra ? streak : 0, streakStart },
    result,
  };
}

/** Resolve a pending gift square: optionally swap places with the leader, then pass play on. */
export function resolveGift(s: GameState, swap: boolean): GameState {
  if (s.pendingGift === null) throw new Error("no gift pending");
  const players = s.players.map((p) => ({ ...p }));
  const i = s.current;
  if (swap) {
    const a = players[i].pos;
    players[i].pos = players[s.pendingGift].pos;
    players[s.pendingGift].pos = a;
  }
  const extra = s.pendingExtra;
  return {
    ...s,
    players,
    current: extra ? i : (i + 1) % players.length,
    sixStreak: extra ? s.sixStreak : 0,
    pendingGift: null,
    pendingExtra: false,
  };
}

/** Bots always take a worthwhile swap. */
export function botWantsSwap(s: GameState): boolean {
  if (s.pendingGift === null) return false;
  return s.players[s.pendingGift].pos - s.players[s.current].pos >= 4;
}
