"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Layout } from "@/lib/games/snakesladders/board";
import { cellOf, pointAlong, snakeCenterline, squareCenter, type Pt } from "@/lib/games/snakesladders/geometry";
import { botWantsSwap, newGame, resolveGift, rollTurn, type GameState, type Settings, type TurnResult } from "@/lib/games/snakesladders/rules";
import { sfx } from "@/lib/games/snakesladders/sounds";
import { recordBest, recordResult } from "@/lib/games/scores";
import { addSnlExtra } from "@/lib/games/snakesladders/stats";
import { restPose, type TokenPose } from "./Tokens";

export interface PlayerCfg {
  name: string;
  color: number;
  human: boolean;
}
export interface GameConfig {
  players: PlayerCfg[];
  settings: Settings;
}
export type Phase = "idle" | "busy" | "gift" | "over";
export interface HistoryItem {
  player: number;
  text: string;
}
export interface FinalResult {
  winner: number;
  outcome: "win" | "loss";
  soloHuman: boolean;
  newBest: boolean;
  turns: number;
  bitten: number;
  climbed: number;
}

export interface PoseStore {
  get: () => TokenPose[];
  set: (p: TokenPose[]) => void;
  subscribe: (cb: () => void) => () => void;
}
function createPoseStore(initial: TokenPose[]): PoseStore {
  let value = initial;
  const subs = new Set<() => void>();
  return {
    get: () => value,
    set: (p) => {
      value = p;
      subs.forEach((f) => f());
    },
    subscribe: (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  };
}

const HOP_MS = 230;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

interface DebugWin {
  __snlSpeed?: number;
  __snlDice?: number[];
}
const dbg = (): DebugWin | null => (process.env.NODE_ENV !== "production" && typeof window !== "undefined" ? (window as unknown as DebugWin) : null);

function restPoses(state: GameState): TokenPose[] {
  const size = state.layout.size;
  const groups = new Map<number, number[]>();
  state.players.forEach((p, i) => groups.set(p.pos, [...(groups.get(p.pos) ?? []), i]));
  return state.players.map((p, i) => {
    const g = groups.get(p.pos)!;
    return restPose(squareCenter(p.pos, size), g.indexOf(i), g.length, size);
  });
}

export function useSnakesLadders(layout: Layout, config: GameConfig, reduceMotion: boolean) {
  const [game, setGame] = useState<GameState>(() => newGame(layout, config.settings, config.players.length));
  // token poses change every animation frame, so they live in a tiny external store and only <Tokens> re-renders
  const [poseStore] = useState<PoseStore>(() => createPoseStore(restPoses(newGame(layout, config.settings, config.players.length))));
  const [phase, setPhase] = useState<Phase>("busy");
  const [die, setDie] = useState({ value: 1, spin: 0, rolling: false });
  const [banner, setBanner] = useState<{ text: string; tone: "good" | "bad" | "info"; id: number } | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [wobble, setWobble] = useState(0);
  const [burst, setBurst] = useState(0);
  const [result, setResult] = useState<FinalResult | null>(null);
  const [giftInfo, setGiftInfo] = useState<{ leader: number } | null>(null);
  const [turnNo, setTurnNo] = useState(0);
  const api = useRef<{ roll: () => void; gift: (swap: boolean) => void }>({ roll: () => {}, gift: () => {} });

  const cfgRef = useRef(config);
  const reduceRef = useRef(reduceMotion);
  useEffect(() => {
    reduceRef.current = reduceMotion;
  }, [reduceMotion]);

  useEffect(() => {
    let dead = false;
    const timers = new Set<number>();
    let raf = 0;
    let busy = true;
    let bannerId = 0;
    let giftResolve: ((swap: boolean) => void) | null = null;
    const cfg = cfgRef.current;
    const size = layout.size;
    const cell = cellOf(size);
    let state = newGame(layout, cfg.settings, cfg.players.length);
    let tokens: TokenPose[] = restPoses(state);
    let finished = false;
    const snakeIdx = new Map(layout.snakes.map((s, i) => [s.from, i]));

    const speed = () => dbg()?.__snlSpeed || 1;
    const wait = (ms: number) =>
      new Promise<void>((res) => {
        const id = window.setTimeout(() => {
          timers.delete(id);
          res();
        }, ms / speed());
        timers.add(id);
      });
    const tween = (ms: number, fn: (t: number) => void) =>
      new Promise<void>((res) => {
        const d = Math.max(1, ms / speed());
        const t0 = performance.now();
        const step = (now: number) => {
          if (dead) return;
          const t = Math.min(1, (now - t0) / d);
          fn(t);
          if (t < 1) raf = requestAnimationFrame(step);
          else res();
        };
        raf = requestAnimationFrame(step);
      });
    const setTok = (i: number, p: Partial<TokenPose>) => {
      tokens = tokens.map((t, k) => (k === i ? { ...t, ...p } : t));
      poseStore.set(tokens);
    };
    const say = (text: string, tone: "good" | "bad" | "info") => setBanner({ text, tone, id: ++bannerId });
    const log = (player: number, text: string) => setHistory((h) => [{ player, text }, ...h].slice(0, 40));
    const name = (i: number) => cfg.players[i].name;
    const isHuman = (i: number) => cfg.players[i].human;

    async function settle() {
      const target = restPoses(state);
      const from = tokens;
      await tween(140, (t) => {
        tokens = from.map((p, i) => ({ x: p.x + (target[i].x - p.x) * t, y: p.y + (target[i].y - p.y) * t, h: p.h * (1 - t), s: p.s + (target[i].s - p.s) * t }));
        poseStore.set(tokens);
      });
    }

    async function hopTo(i: number, sq: number, stepNo: number) {
      const a = tokens[i];
      const b = squareCenter(sq, size);
      await tween(HOP_MS, (t) => setTok(i, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, h: Math.sin(Math.PI * t) * cell * 0.3, s: a.s + (1 - a.s) * t }));
      sfx.step(stepNo);
    }

    async function along(i: number, pts: Pt[], ms: number) {
      await tween(ms, (t) => {
        const p = pointAlong(pts, easeInOut(t));
        setTok(i, { x: p.x, y: p.y, h: 0, s: 1 });
      });
    }

    async function animate(r: TurnResult) {
      const i = r.player;
      if (r.forfeited) {
        sfx.forfeit();
        say("Three sixes! Back you go", "bad");
        log(i, "rolled 6 6 6 - turn forfeited");
        await wait(500);
        const b = squareCenter(r.forfeitTo ?? 1, size);
        const a = tokens[i];
        await tween(400, (t) => setTok(i, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, h: Math.sin(Math.PI * t) * cell * 0.6 }));
        return;
      }
      let txt = `rolled ${r.roll}`;
      if (r.stayed) {
        say("Need an exact roll to finish", "info");
        txt += " (too high, stays)";
        await wait(500);
      }
      let k = 0;
      for (const sq of r.hops) await hopTo(i, sq, k++);
      if (r.bounced) txt += " (bounced back)";
      if (r.jump?.type === "ladder") {
        say(`Ladder! Up to ${r.jump.to}`, "good");
        txt += `, climbed ${r.jump.from} to ${r.jump.to}`;
        sfx.ladder();
        await wait(150);
        await along(i, [squareCenter(r.jump.from, size), squareCenter(r.jump.to, size)], 900);
      } else if (r.jump?.type === "snake") {
        say(`Snake! Down to ${r.jump.to}`, "bad");
        txt += `, bitten ${r.jump.from} to ${r.jump.to}`;
        sfx.bite();
        if (!reduceRef.current) setWobble((w) => w + 1);
        await wait(380);
        sfx.slide();
        const idx = snakeIdx.get(r.jump.from) ?? 0;
        await along(i, snakeCenterline(r.jump.from, r.jump.to, size, idx), 1150);
      } else if (r.shielded) {
        say("Shield blocked the snake!", "good");
        txt += ", shield blocked a snake";
        sfx.shieldBlock();
        await wait(500);
      }
      if (r.power) {
        const label = r.power === "bolt" ? "Lightning! Roll again" : r.power === "shield" ? "Shield acquired" : "Gift square!";
        say(label, "good");
        txt += `, ${r.power} square`;
        sfx.power();
        await wait(450);
      }
      if (r.extra) {
        if (!r.power) say("Rolled a 6: roll again!", "good");
        sfx.extraTurn();
      }
      log(i, txt);
      setTurnNo((n) => n + 1);
    }

    async function finish() {
      if (finished) return;
      finished = true;
      const w = state.winner!;
      const humans = cfg.players.filter((p) => p.human).length;
      const solo = humans === 1;
      const winnerHuman = isHuman(w);
      const wp = state.players[w];
      let newBest = false;
      setBurst((b) => b + 1);
      if (winnerHuman) sfx.win();
      else sfx.lose();
      say(`${name(w)} reached ${layout.size * layout.size}!`, "good");
      if (solo) {
        const hi = cfg.players.findIndex((p) => p.human);
        recordResult("snakesladders", winnerHuman ? "win" : "loss");
        if (winnerHuman) newBest = recordBest("snakesladders", "fewestTurns", wp.rolls, { lowerIsBetter: true });
        addSnlExtra(state.players[hi].bitten, state.players[hi].climbed);
      }
      await wait(1400);
      const me = solo ? state.players[cfg.players.findIndex((p) => p.human)] : wp;
      setResult({ winner: w, outcome: winnerHuman ? "win" : "loss", soloHuman: solo, newBest, turns: me.rolls, bitten: me.bitten, climbed: me.climbed });
      setPhase("over");
    }

    async function takeTurn() {
      const i = state.current;
      // roll the die
      const forced = dbg()?.__snlDice?.shift();
      const roll = forced ?? 1 + Math.floor(Math.random() * 6);
      setDie((d) => ({ value: roll, spin: d.spin + 1, rolling: true }));
      sfx.rattle();
      await wait(reduceRef.current ? 300 : 850);
      if (dead) return;
      sfx.settle();
      setDie((d) => ({ ...d, rolling: false }));
      await wait(260);
      const out = rollTurn(state, roll);
      state = out.state;
      await animate(out.result);
      if (dead) return;
      setGame(state);
      if (out.result.won) {
        await settle();
        return;
      }
      if (out.result.giftLeader !== null) {
        const leader = out.result.giftLeader;
        let swap: boolean;
        if (isHuman(i)) {
          setGiftInfo({ leader });
          setPhase("gift");
          busy = false;
          swap = await new Promise<boolean>((res) => (giftResolve = res));
          busy = true;
          setGiftInfo(null);
          setPhase("busy");
        } else {
          await wait(900);
          swap = botWantsSwap(state);
        }
        if (dead) return;
        if (swap) {
          sfx.swap();
          const me = state.players[i].pos;
          const them = state.players[leader].pos;
          log(i, `gift: swapped with ${name(leader)} (${me} to ${them})`);
          say(`Swapped with ${name(leader)}!`, "good");
          state = resolveGift(state, true);
          setGame(state);
          await wait(120);
        } else {
          log(i, "gift: kept their spot");
          state = resolveGift(state, false);
          setGame(state);
        }
      }
      await settle();
      setGame(state);
    }

    async function loop() {
      while (!dead) {
        if (state.winner !== null) return finish();
        if (isHuman(state.current)) {
          busy = false;
          setPhase("idle");
          sfx.turn();
          return;
        }
        busy = true;
        setPhase("busy");
        await wait(700 + Math.random() * 450);
        if (dead) return;
        await takeTurn();
      }
    }

    api.current = {
      roll: () => {
        if (busy || dead || state.winner !== null || !isHuman(state.current)) return;
        busy = true;
        setPhase("busy");
        void takeTurn().then(() => {
          if (!dead) void loop();
        });
      },
      gift: (swap: boolean) => {
        if (giftResolve) {
          const r = giftResolve;
          giftResolve = null;
          r(swap);
        }
      },
    };
    // reset visible state (idempotent under StrictMode double-invocation)
    setGame(state);
    poseStore.set(tokens);
    setHistory([]);
    setResult(null);
    setBanner(null);
    setGiftInfo(null);
    setTurnNo(0);
    void wait(250).then(() => {
      if (!dead) void loop();
    });
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      timers.forEach((t) => window.clearTimeout(t));
      timers.clear();
      api.current = { roll: () => {}, gift: () => {} };
    };
  }, [layout, poseStore]);

  const roll = useCallback(() => api.current.roll(), []);
  const gift = useCallback((swap: boolean) => api.current.gift(swap), []);
  return { game, poseStore, phase, die, banner, history, wobble, burst, result, giftInfo, turnNo, roll, gift };
}
