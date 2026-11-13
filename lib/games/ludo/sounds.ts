"use client";
// Synthesized Ludo sounds built on the shared audio primitives.
import { arpeggio, noise, tone } from "../audio";

const jit = (n: number) => 1 + (Math.random() - 0.5) * n;

export const ludoSounds = {
  /** a handful of tiny band-passed clicks, then a settle knock (call once when the die starts tumbling) */
  rattle() {
    let t = 0;
    for (let i = 0; i < 9; i++) {
      noise({ start: t, dur: 0.035, gain: 0.16 + Math.random() * 0.1, filter: "bandpass", freq: (1800 + Math.random() * 2600) * 1, q: 4, pan: (Math.random() - 0.5) * 0.5 });
      tone({ freq: 700 * jit(0.6), dur: 0.03, type: "triangle", gain: 0.03, start: t });
      t += 0.045 + Math.random() * 0.05 + i * 0.006;
    }
  },
  settle() {
    noise({ dur: 0.09, gain: 0.5, filter: "lowpass", freq: 420, freqEnd: 140 });
    tone({ freq: 170, freqEnd: 80, dur: 0.11, type: "sine", gain: 0.3 });
    noise({ dur: 0.03, gain: 0.25, filter: "bandpass", freq: 2400, q: 2 });
  },
  /** soft wooden tick; `i` is the step index so the pitch creeps up along the path */
  step(i = 0) {
    const f = 520 * Math.pow(1.045, Math.min(i, 12)) * jit(0.04);
    tone({ freq: f, freqEnd: f * 0.8, dur: 0.07, type: "triangle", gain: 0.16, lowpass: 2600 });
    noise({ dur: 0.03, gain: 0.14, filter: "bandpass", freq: 1900 * jit(0.1), q: 3 });
  },
  capture() {
    noise({ dur: 0.18, gain: 0.5, filter: "lowpass", freq: 900, freqEnd: 120 });
    tone({ freq: 220, freqEnd: 55, dur: 0.2, type: "square", gain: 0.12, lowpass: 900 });
    tone({ freq: 880, freqEnd: 140, dur: 0.5, start: 0.06, type: "sawtooth", gain: 0.07, lowpass: 2200 });
    noise({ start: 0.08, dur: 0.45, gain: 0.12, filter: "bandpass", freq: 2800, freqEnd: 500, q: 1.5 });
  },
  /** token leaves the yard */
  yard() {
    noise({ dur: 0.04, gain: 0.3, filter: "bandpass", freq: 2600, q: 5 });
    tone({ freq: 980, freqEnd: 1300, dur: 0.07, type: "square", gain: 0.05, lowpass: 3000 });
  },
  home() {
    arpeggio([659, 784, 988, 1319], { step: 0.07, dur: 0.28, type: "triangle", gain: 0.14 });
    arpeggio([1319, 1568, 1976], { step: 0.07, start: 0.1, dur: 0.4, type: "sine", gain: 0.05 });
  },
  six() {
    tone({ freq: 1568, dur: 0.35, type: "sine", gain: 0.12 });
    tone({ freq: 2349, dur: 0.3, start: 0.07, type: "sine", gain: 0.07 });
    tone({ freq: 3136, dur: 0.25, start: 0.13, type: "sine", gain: 0.04 });
  },
  ding() {
    tone({ freq: 1175, dur: 0.3, type: "sine", gain: 0.1 });
    tone({ freq: 1760, dur: 0.25, start: 0.06, type: "sine", gain: 0.06 });
  },
  nomove() {
    tone({ freq: 150, freqEnd: 110, dur: 0.22, type: "sawtooth", gain: 0.09, lowpass: 700 });
    tone({ freq: 140, freqEnd: 95, dur: 0.22, start: 0.12, type: "sawtooth", gain: 0.08, lowpass: 700 });
  },
  select() {
    tone({ freq: 760, dur: 0.05, type: "triangle", gain: 0.07 });
  },
  win() {
    arpeggio([523, 659, 784, 1047, 784, 1047, 1319], { step: 0.11, dur: 0.4, type: "triangle", gain: 0.15 });
    arpeggio([262, 330, 392, 523], { step: 0.22, dur: 0.7, type: "sine", gain: 0.1 });
  },
  lose() {
    arpeggio([392, 330, 262, 196], { step: 0.18, dur: 0.45, type: "triangle", gain: 0.12, lowpass: 1800 });
  },
};
