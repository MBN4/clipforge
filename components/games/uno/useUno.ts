"use client";

// The UNO game controller: owns the engine state, plays engine "steps" back as animations,
// drives the bots and records results. All timers/animations are cancellable via a generation token.
import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Card, Color, cardPoints } from "@/lib/games/uno/cards";
import { Action, Step, UnoSettings, UnoState, applyAction, canJumpIn, newRound, unplayableReason } from "@/lib/games/uno/engine";
import { botCallsUno, botCatches, chooseBotAction, chooseJumpIn } from "@/lib/games/uno/bots";
import { unoSounds as snd } from "@/lib/games/uno/sounds";
import { unlockAudio } from "@/lib/games/audio";
import { recordBest, recordResult } from "@/lib/games/scores";

export const SEATS = [
  { name: "You", emoji: "😎" },
  { name: "Mia", emoji: "🦊" },
  { name: "Leo", emoji: "🐻" },
  { name: "Zoe", emoji: "🐼" },
];

export interface Flight {
  key: number;
  card: Card | null;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  r0: number;
  r1: number;
  s0: number;
  s1: number;
  delay: number;
  dur: number;
}

export interface Flash {
  key: number;
  text: string;
  tone: Color | "neutral";
}

export interface RoundEnd {
  winner: number;
  points: number;
  scores: number[];
  matchOver: boolean;
  cardsLeft: number[];
  handPts: number[];
  newBestRound: boolean;
  newBestMatch: boolean;
  stalled: boolean;
}

class Cancelled extends Error {}

/** deterministic little rotation so a card always lands at the same angle */
export const landingRot = (id: number) => ((id * 47) % 25) - 12;

export function useUno(rootRef: RefObject<HTMLDivElement | null>) {
  const reduce = useReducedMotion();
  const k = reduce ? 0.45 : 1;

  const [screen, setScreen] = useState<"start" | "game">("start");
  const [settings, setSettings] = useState<UnoSettings | null>(null);
  const [view, setView] = useState<UnoState | null>(null);
  const [dealt, setDealt] = useState<number | null>(null);
  const [busy, setBusyState] = useState(false);
  const [hidden, setHidden] = useState<number[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [banner, setBanner] = useState<{ key: number; p: number } | null>(null);
  const [toast, setToast] = useState<{ key: number; text: string } | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [round, setRound] = useState(1);
  const [end, setEnd] = useState<RoundEnd | null>(null);
  const [handShake, setHandShake] = useState(0);

  const gen = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const stateRef = useRef<UnoState | null>(null);
  const viewRef = useRef<UnoState | null>(null);
  const busyRef = useRef(false);
  const scoresRef = useRef<number[]>([]);
  const roundRef = useRef(1);
  const settingsRef = useRef<UnoSettings | null>(null);
  const keyRef = useRef(1);
  const starterRef = useRef(0);
  const endRef = useRef<RoundEnd | null>(null);
  const botRun = useRef(0);

  const setBusy = (b: boolean) => {
    busyRef.current = b;
    setBusyState(b);
  };

  const clearAll = useCallback(() => {
    gen.current++;
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    setFlights([]);
    setFlash(null);
    setBanner(null);
    setToast(null);
    setHidden([]);
  }, []);

  useEffect(() => {
    const t = timers.current;
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      gen.current++;
      t.forEach(clearTimeout);
      t.clear();
    };
  }, []);

  const wait = useCallback((ms: number, g: number) => {
    return new Promise<void>((resolve, reject) => {
      const id = setTimeout(() => {
        timers.current.delete(id);
        if (g !== gen.current) reject(new Cancelled());
        else resolve();
      }, ms);
      timers.current.add(id);
    });
  }, []);

  const later = useCallback((ms: number, fn: () => void, g: number) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      if (g === gen.current) fn();
    }, ms);
    timers.current.add(id);
  }, []);

  // ---- geometry ----
  const center = useCallback(
    (sel: string): { x: number; y: number } | null => {
      const root = rootRef.current;
      if (!root) return null;
      const el = root.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const rr = root.getBoundingClientRect();
      return { x: r.left - rr.left + r.width / 2, y: r.top - rr.top + r.height / 2 };
    },
    [rootRef]
  );
  const seatPoint = useCallback((p: number) => center(`[data-anchor="seat-${p}"]`) ?? { x: 0, y: 0 }, [center]);

  const fly = useCallback(
    (g: number, o: { card: Card | null; from: { x: number; y: number }; to: { x: number; y: number }; r0?: number; r1?: number; s0?: number; s1?: number; delay?: number; dur?: number }) => {
      const f: Flight = {
        key: keyRef.current++,
        card: o.card,
        x0: o.from.x,
        y0: o.from.y,
        x1: o.to.x,
        y1: o.to.y,
        r0: o.r0 ?? 0,
        r1: o.r1 ?? 0,
        s0: o.s0 ?? 1,
        s1: o.s1 ?? 1,
        delay: (o.delay ?? 0) * k,
        dur: (o.dur ?? 0.4) * k,
      };
      setFlights((fl) => [...fl, f]);
      later((f.delay + f.dur) * 1000 + 60, () => setFlights((fl) => fl.filter((x) => x.key !== f.key)), g);
      return f;
    },
    [k, later]
  );

  const say = useCallback(
    (text: string, g: number, ms = 2400) => {
      const key = keyRef.current++;
      setToast({ key, text });
      later(ms, () => setToast((t) => (t && t.key === key ? null : t)), g);
    },
    [later]
  );

  const showFlash = useCallback(
    (text: string, tone: Flash["tone"], g: number, ms = 900) => {
      const key = keyRef.current++;
      setFlash({ key, text, tone });
      later(ms * (reduce ? 0.7 : 1), () => setFlash((f) => (f && f.key === key ? null : f)), g);
    },
    [later, reduce]
  );

  const commit = useCallback((s: UnoState) => {
    viewRef.current = s;
    setView(s);
  }, []);

  // ---- finishing a round / match ----
  const finishRound = useCallback(
    async (s: UnoState, g: number, stalled: boolean) => {
      const winner = s.winner as number;
      const st = settingsRef.current as UnoSettings;
      const next = scoresRef.current.map((x, i) => (i === winner ? x + s.points : x));
      scoresRef.current = next;
      setScores(next);
      const matchOver = st.target === 0 || next[winner] >= st.target;
      let newBestRound = false;
      let newBestMatch = false;
      if (winner === 0) newBestRound = recordBest("uno", "bestRound", s.points);
      if (matchOver) {
        recordResult("uno", winner === 0 ? "win" : "loss");
        if (winner === 0 && st.target > 0) newBestMatch = recordBest("uno", "bestMatch", next[0]);
      }
      await wait(matchOver || winner === 0 ? 900 : 700, g);
      if (winner === 0) snd.win();
      else snd.lose();
      const info: RoundEnd = {
        winner,
        points: s.points,
        scores: next,
        matchOver,
        cardsLeft: s.hands.map((h) => h.length),
        handPts: s.hands.map((h) => h.reduce((a, c) => a + cardPoints(c), 0)),
        newBestRound,
        newBestMatch,
        stalled,
      };
      endRef.current = info;
      setEnd(info);
    },
    [wait]
  );

  // ---- step playback ----
  const playSteps = useCallback(
    async (steps: Step[], g: number) => {
      let prev: Step["event"] | null = null;
      for (const st of steps) {
        const e = st.event;
        switch (e.t) {
          case "play": {
            const dst = center('[data-anchor="discard"]') ?? { x: 0, y: 0 };
            let from = seatPoint(e.p);
            let s0 = 0.55;
            if (e.p === 0) {
              from = center(`[data-uno-card="${e.card.id}"]`) ?? from;
              s0 = 1;
              setHidden((h) => [...h, e.card.id]);
            }
            fly(g, { card: e.card, from, to: dst, r0: e.p === 0 ? 0 : (Math.random() - 0.5) * 30, r1: landingRot(e.card.id), s0, s1: 1, dur: 0.36 });
            await wait(360 * k, g);
            snd.play();
            commit(st.state);
            setHidden((h) => h.filter((x) => x !== e.card.id));
            if (e.card.color === null) {
              snd.wild();
              showFlash(e.card.value === "wild4" ? "+4" : "WILD", e.color, g, 800);
            } else if (e.card.value === "draw2") {
              snd.power(false);
              showFlash(st.state.pending > 2 ? `+${st.state.pending}` : "+2", e.card.color, g, 800);
            }
            if (e.card.value === "wild4") {
              snd.power(true);
              if (st.state.pending > 4) showFlash(`+${st.state.pending}`, e.color, g, 800);
            }
            await wait((e.card.color === null || e.card.value === "draw2" ? 520 : 140) * k, g);
            break;
          }
          case "skip":
            if (prev && prev.t === "play" && prev.card.value === "skip") {
              snd.skip();
              showFlash("SKIP", prev.card.color ?? "neutral", g, 800);
              commit(st.state);
              await wait(650 * k, g);
            } else commit(st.state);
            break;
          case "reverse":
            snd.reverse();
            showFlash("REVERSE", (prev && prev.t === "play" && prev.card.color) || "neutral", g, 800);
            commit(st.state);
            await wait(650 * k, g);
            break;
          case "draw": {
            const to = seatPoint(e.p);
            const from = center('[data-anchor="draw"]') ?? to;
            const shown = e.cards.slice(0, 8);
            shown.forEach((c, i) => {
              fly(g, { card: e.p === 0 ? c : null, from, to, r0: 0, r1: e.p === 0 ? 0 : (Math.random() - 0.5) * 20, s0: 1, s1: e.p === 0 ? 1 : 0.55, delay: i * 0.12, dur: 0.38 });
              later(i * 120 * k, () => snd.draw(), g);
            });
            await wait(((shown.length - 1) * 0.12 + 0.4) * 1000 * k, g);
            commit(st.state);
            await wait(80 * k, g);
            break;
          }
          case "reshuffle": {
            const from = center('[data-anchor="discard"]') ?? { x: 0, y: 0 };
            const to = center('[data-anchor="draw"]') ?? from;
            snd.shuffle();
            for (let i = 0; i < 6; i++) fly(g, { card: null, from, to, r0: (i - 3) * 12, r1: 0, delay: i * 0.07, dur: 0.32 });
            showFlash("SHUFFLING", "neutral", g, 800);
            await wait(900 * k, g);
            commit(st.state);
            break;
          }
          case "swap": {
            snd.wild();
            showFlash("SWAP!", "neutral", g, 800);
            const a = seatPoint(e.a);
            const b = seatPoint(e.b);
            for (let i = 0; i < 3; i++) {
              fly(g, { card: null, from: a, to: b, delay: i * 0.08, dur: 0.45, s0: 0.6, s1: 0.6, r1: 15 });
              fly(g, { card: null, from: b, to: a, delay: i * 0.08, dur: 0.45, s0: 0.6, s1: 0.6, r1: -15 });
            }
            await wait(780 * k, g);
            commit(st.state);
            break;
          }
          case "rotate": {
            snd.wild();
            showFlash("ROTATE!", "neutral", g, 800);
            const n = st.state.n;
            const before = viewRef.current ?? st.state;
            for (let i = 0; i < n; i++) {
              const to = (((i + before.dir) % n) + n) % n;
              for (let j = 0; j < 2; j++) fly(g, { card: null, from: seatPoint(i), to: seatPoint(to), delay: j * 0.1, dur: 0.5, s0: 0.6, s1: 0.6 });
            }
            await wait(780 * k, g);
            commit(st.state);
            break;
          }
          case "uno":
            snd.uno();
            setBanner({ key: keyRef.current++, p: e.p });
            later(1000 * k, () => setBanner(null), g);
            commit(st.state);
            await wait(e.p === 0 ? 300 * k : 650 * k, g);
            break;
          case "catch":
            snd.catch();
            say(e.by === 0 ? `Caught ${SEATS[e.p].name}! They draw 2` : `${SEATS[e.by].name} caught ${e.p === 0 ? "you" : SEATS[e.p].name} — draw 2!`, g);
            commit(st.state);
            await wait(550 * k, g);
            break;
          case "challenge":
            snd.power(false);
            showFlash("CHALLENGE!", "neutral", g, 900);
            say(
              e.success
                ? `${SEATS[e.offender].name === "You" ? "You" : SEATS[e.offender].name} bluffed! Draws 4`
                : `Challenge failed — ${SEATS[e.by].name === "You" ? "you" : SEATS[e.by].name} draw${e.by === 0 ? "" : "s"} 6`,
              g
            );
            commit(st.state);
            await wait(700 * k, g);
            break;
          case "turn": {
            const was = viewRef.current;
            commit(st.state);
            if (st.state.current === 0 && st.state.winner === null && (!was || was.current !== 0)) snd.turn();
            break;
          }
          case "roundEnd":
            commit(st.state);
            break;
          default:
            commit(st.state);
        }
        prev = e;
      }
    },
    [center, commit, fly, k, later, say, seatPoint, showFlash, wait]
  );

  const dispatch = useCallback(
    async (action: Action, g: number) => {
      const cur = stateRef.current;
      if (!cur || g !== gen.current) return null;
      const r = applyAction(cur, action);
      if (!r.ok) return r;
      stateRef.current = r.state;
      setBusy(true);
      try {
        await playSteps(r.steps, g);
        commit(r.state);
        const last = r.steps[r.steps.length - 1];
        if (r.state.winner !== null) await finishRound(r.state, g, last?.event.t === "roundEnd" && last.event.stalled);
      } catch (err) {
        if (err instanceof Cancelled) return r;
        throw err;
      }
      if (g === gen.current) setBusy(false);
      return r;
    },
    [commit, finishRound, playSteps]
  );

  // ---- starting rounds ----
  const beginRound = useCallback(
    async (st: UnoSettings) => {
      clearAll();
      const g = gen.current;
      const s = newRound(st, starterRef.current);
      stateRef.current = s;
      viewRef.current = s;
      setView(s);
      setEnd(null);
      endRef.current = null;
      setDealt(0);
      setBusy(true);
      setScreen("game");
      try {
        await wait(350, g); // let the table mount and lay out
        const total = st.startCards * st.players;
        const step = 0.06;
        const from = center('[data-anchor="draw"]') ?? { x: 0, y: 0 };
        snd.shuffle();
        await wait(420 * k, g);
        for (let i = 0; i < total; i++) {
          const seat = i % st.players;
          const to = seatPoint(seat);
          const delay = i * step;
          fly(g, { card: null, from, to, r0: 0, r1: (Math.random() - 0.5) * 24, s0: 1, s1: seat === 0 ? 1 : 0.55, delay, dur: 0.34 });
          later((delay + 0.2) * 1000 * k, () => snd.flick(seat === 0 ? 0 : (seat - 1.5) * 0.4), g);
          later((delay + 0.34) * 1000 * k, () => setDealt(i + 1), g);
        }
        await wait((total * step + 0.45) * 1000 * k, g);
        // flip the starter card
        const first = s.discard[0];
        fly(g, { card: first, from, to: center('[data-anchor="discard"]') ?? from, r1: landingRot(first.id), dur: 0.4 });
        await wait(420 * k, g);
        snd.play();
        setDealt(null);
        const note = s.startNote;
        if (note === "skip") {
          snd.skip();
          showFlash("SKIP", first.color ?? "neutral", g, 900);
          say(`${SEATS[starterRef.current].name === "You" ? "You are" : SEATS[starterRef.current].name + " is"} skipped`, g);
        } else if (note === "reverse") {
          snd.reverse();
          showFlash("REVERSE", first.color ?? "neutral", g, 900);
        } else if (note === "draw2") {
          snd.power(false);
          showFlash("+2", first.color ?? "neutral", g, 900);
          say(`${SEATS[starterRef.current].name === "You" ? "You draw" : SEATS[starterRef.current].name + " draws"} 2 and ${SEATS[starterRef.current].name === "You" ? "lose" : "loses"} the turn`, g);
        } else if (note === "wild") {
          snd.wild();
          showFlash(s.color.toUpperCase(), s.color, g, 900);
          say(`Opening wild — starting colour is ${s.color}`, g);
        }
        await wait((note ? 800 : 250) * k, g);
        if (s.current === 0) snd.turn();
        setBusy(false);
      } catch (err) {
        if (!(err instanceof Cancelled)) throw err;
      }
    },
    [center, clearAll, fly, k, later, say, seatPoint, showFlash, wait]
  );

  const startMatch = useCallback(
    (st: UnoSettings) => {
      unlockAudio();
      settingsRef.current = st;
      setSettings(st);
      scoresRef.current = Array(st.players).fill(0);
      setScores(scoresRef.current);
      roundRef.current = 1;
      setRound(1);
      starterRef.current = Math.floor(Math.random() * st.players);
      beginRound(st);
    },
    [beginRound]
  );

  const nextRound = useCallback(() => {
    const st = settingsRef.current;
    const e = endRef.current;
    if (!st || !e) return;
    roundRef.current += 1;
    setRound(roundRef.current);
    starterRef.current = e.winner;
    beginRound(st);
  }, [beginRound]);

  const rematch = useCallback(() => {
    const st = settingsRef.current;
    if (st) startMatch(st);
  }, [startMatch]);

  const quit = useCallback(() => {
    clearAll();
    setBusy(false);
    setEnd(null);
    endRef.current = null;
    stateRef.current = null;
    viewRef.current = null;
    setView(null);
    setDealt(null);
    setScreen("start");
  }, [clearAll]);

  // ---- human actions ----
  const canAct = () => !busyRef.current && !!stateRef.current && stateRef.current.winner === null && endRef.current === null;
  const refuse = (msg: string) => {
    snd.nope();
    setHandShake((n) => n + 1);
    say(msg, gen.current);
  };

  const humanPlay = useCallback(
    (cardId: number, color?: Color, target?: number) => {
      if (!canAct()) return;
      const s = stateRef.current as UnoState;
      const card = s.hands[0].find((c) => c.id === cardId);
      if (!card) return;
      if (s.current === 0) {
        const why = s.drawn !== null && card.id !== s.drawn ? "You can only play the card you just drew" : unplayableReason(s, 0, card);
        if (why) return refuse(why);
      } else if (!canJumpIn(s, 0, card)) return refuse("It's not your turn");
      void dispatch({ type: "play", player: 0, cardId, color, target }, gen.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch]
  );
  const simple = useCallback(
    (type: "draw" | "pass" | "accept" | "challenge" | "uno" | "catch") => {
      if (!canAct()) return;
      const s = stateRef.current as UnoState;
      if (type === "draw" && s.current === 0 && s.pending > 0) type = "accept";
      void dispatch({ type, player: 0 } as Action, gen.current).then((r) => {
        if (r && !r.ok && r.error) refuse(r.error);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch]
  );

  // ---- bot driver ----
  useEffect(() => {
    if (screen !== "game" || busy || !view || view.winner !== null || end || dealt !== null) return;
    if (view.current === 0) return;
    const st = settingsRef.current;
    if (!st) return;
    const g = gen.current;
    const me = ++botRun.current;
    void (async () => {
      try {
        const quick = st.players > 0 && !!stateRef.current?.uno[view.current];
        await wait(quick ? 250 : 650 + Math.random() * 500, g);
        const s = stateRef.current;
        if (me !== botRun.current || busyRef.current || !s || s.current === 0 || s.winner !== null) return;
        const d = st.difficulty;
        if (s.vulnerable === 0 && botCatches(d, Math.random)) {
          await dispatch({ type: "catch", player: s.current }, g);
          return;
        }
        const seats = Array.from({ length: s.n }, (_, i) => i).filter((i) => i !== 0 && i !== s.current);
        const ja = chooseJumpIn(s, d, seats, Math.random);
        if (ja) {
          await dispatch(ja, g);
          return;
        }
        const p = s.current;
        const a = chooseBotAction(s, p, d, Math.random);
        if (a.type === "play" && s.hands[p].length === 2 && !s.uno[p] && botCallsUno(d, Math.random)) {
          await dispatch({ type: "uno", player: p }, g);
          return;
        }
        await dispatch(a, g);
      } catch (err) {
        if (!(err instanceof Cancelled)) throw err;
      }
    })();
  }, [screen, busy, view, end, dealt, dispatch, wait]);

  return {
    screen,
    settings,
    view,
    dealt,
    busy,
    hidden,
    flights,
    flash,
    banner,
    toast,
    scores,
    round,
    end,
    handShake,
    startMatch,
    nextRound,
    rematch,
    quit,
    humanPlay,
    humanDraw: () => simple("draw"),
    humanPass: () => simple("pass"),
    humanAccept: () => simple("accept"),
    humanChallenge: () => simple("challenge"),
    humanUno: () => simple("uno"),
    humanCatch: () => simple("catch"),
    notify: (msg: string) => say(msg, gen.current),
  };
}
