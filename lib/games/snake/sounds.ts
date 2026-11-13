"use client";

import { noise, tone } from "../audio";

// Snake's sound set, synthesized on top of the shared audio primitives.
const jitter = (f: number, amt = 0.04) => f * (1 + (Math.random() * 2 - 1) * amt);

export const snakeSfx = {
  /** a juicy apple crunch; `combo` raises the pitch for back-to-back apples */
  eat(combo = 0) {
    const up = 1 + Math.min(combo, 8) * 0.045;
    noise({ dur: 0.07, gain: 0.35, filter: "bandpass", freq: 2200 * up, q: 0.9 });
    tone({ freq: jitter(520 * up), freqEnd: 860 * up, dur: 0.09, type: "triangle", gain: 0.16 });
    tone({ freq: jitter(1040 * up), dur: 0.06, start: 0.04, type: "sine", gain: 0.07 });
  },
  bonus() {
    [784, 988, 1175, 1568].forEach((f, i) => tone({ freq: f, start: i * 0.055, dur: 0.16, type: "triangle", gain: 0.13 }));
    noise({ dur: 0.25, gain: 0.08, filter: "highpass", freq: 6000 });
  },
  turn() {
    noise({ dur: 0.025, gain: 0.07, filter: "bandpass", freq: 3200, q: 2 });
  },
  levelUp() {
    tone({ freq: 440, freqEnd: 880, dur: 0.18, type: "square", gain: 0.06, lowpass: 2200 });
  },
  die() {
    noise({ dur: 0.35, gain: 0.4, filter: "lowpass", freq: 900, freqEnd: 120 });
    tone({ freq: 220, freqEnd: 55, dur: 0.45, type: "sawtooth", gain: 0.13, lowpass: 700 });
    tone({ freq: 160, freqEnd: 40, dur: 0.5, start: 0.08, type: "sine", gain: 0.18 });
  },
  record() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, start: i * 0.085, dur: 0.22, type: "triangle", gain: 0.12 }));
    tone({ freq: 1568, start: 0.45, dur: 0.5, type: "sine", gain: 0.1 });
  },
  start() {
    tone({ freq: 392, dur: 0.1, type: "triangle", gain: 0.1 });
    tone({ freq: 587, start: 0.09, dur: 0.14, type: "triangle", gain: 0.1 });
  },
};
