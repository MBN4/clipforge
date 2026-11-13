"use client";
// Synthesized sound set for Snakes & Ladders, built on the shared primitives.
import { arpeggio, noise, tone } from "../audio";

const j = (amt = 0.04) => 1 + (Math.random() * 2 - 1) * amt;

export const sfx = {
  rattle() {
    for (let i = 0; i < 9; i++) {
      const t = i * 0.085 + Math.random() * 0.03;
      noise({ start: t, dur: 0.05, gain: 0.16, filter: "bandpass", freq: 2200 + Math.random() * 2500, q: 2.2, pan: (Math.random() - 0.5) * 0.5 });
      tone({ start: t, freq: 900 * j(0.3), freqEnd: 400, dur: 0.035, type: "square", gain: 0.03, lowpass: 3000 });
    }
  },
  settle() {
    tone({ freq: 140, freqEnd: 55, dur: 0.16, type: "sine", gain: 0.3 });
    noise({ dur: 0.06, gain: 0.2, filter: "lowpass", freq: 900 });
    tone({ start: 0.02, freq: 520 * j(), dur: 0.05, type: "triangle", gain: 0.06 });
  },
  step(i: number) {
    const f = 330 * Math.pow(2, Math.min(i, 12) / 12) * j(0.01);
    tone({ freq: f, freqEnd: f * 0.9, dur: 0.07, type: "triangle", gain: 0.12, lowpass: 2600 });
    noise({ dur: 0.025, gain: 0.07, filter: "bandpass", freq: 1800, q: 1.5 });
  },
  ladder() {
    arpeggio([523, 587, 659, 784, 880, 1047, 1175, 1319], { step: 0.085, dur: 0.22, type: "triangle", gain: 0.1, lowpass: 4200 });
    for (let i = 0; i < 8; i++) noise({ start: i * 0.085 + 0.02, dur: 0.03, gain: 0.09, filter: "bandpass", freq: 1100 + i * 90, q: 3 });
  },
  bite() {
    noise({ dur: 0.38, gain: 0.3, filter: "bandpass", freq: 7000, freqEnd: 2200, q: 0.7, attack: 0.05 });
    tone({ start: 0.3, freq: 170, freqEnd: 60, dur: 0.16, type: "square", gain: 0.12, lowpass: 600 });
    noise({ start: 0.3, dur: 0.07, gain: 0.2, filter: "lowpass", freq: 700 });
  },
  slide() {
    tone({ freq: 760, freqEnd: 110, dur: 1.05, type: "sawtooth", gain: 0.07, lowpass: 1500 });
    tone({ freq: 380, freqEnd: 55, dur: 1.05, type: "sine", gain: 0.12 });
    noise({ dur: 1.0, gain: 0.08, filter: "bandpass", freq: 3000, freqEnd: 500, q: 0.8 });
  },
  shieldBlock() {
    noise({ dur: 0.12, gain: 0.25, filter: "bandpass", freq: 3500, q: 4 });
    arpeggio([880, 1320], { step: 0.07, dur: 0.25, type: "sine", gain: 0.12 });
  },
  extraTurn() {
    arpeggio([784, 1175], { step: 0.09, dur: 0.3, type: "sine", gain: 0.13 });
  },
  power() {
    arpeggio([659, 880, 1109, 1319], { step: 0.065, dur: 0.28, type: "triangle", gain: 0.1, lowpass: 5000 });
    tone({ start: 0.26, freq: 1760, dur: 0.4, type: "sine", gain: 0.05 });
  },
  swap() {
    tone({ freq: 400, freqEnd: 900, dur: 0.22, type: "sine", gain: 0.12 });
    tone({ start: 0.2, freq: 900, freqEnd: 400, dur: 0.22, type: "sine", gain: 0.12 });
  },
  forfeit() {
    arpeggio([392, 330, 262], { step: 0.11, dur: 0.22, type: "square", gain: 0.06, lowpass: 1400 });
  },
  win() {
    arpeggio([523, 659, 784, 1047, 784, 1047, 1319], { step: 0.11, dur: 0.38, type: "triangle", gain: 0.13, lowpass: 5000 });
    arpeggio([262, 330, 392, 523], { start: 0.1, step: 0.22, dur: 0.6, type: "sine", gain: 0.1 });
    for (let i = 0; i < 12; i++) noise({ start: 0.5 + i * 0.07, dur: 0.05, gain: 0.07, filter: "highpass", freq: 6000 });
  },
  lose() {
    arpeggio([392, 349, 311, 262], { step: 0.2, dur: 0.45, type: "sawtooth", gain: 0.07, lowpass: 1100 });
    tone({ start: 0.7, freq: 110, freqEnd: 70, dur: 0.6, type: "sine", gain: 0.15 });
  },
  turn() {
    tone({ freq: 880, dur: 0.12, type: "sine", gain: 0.07 });
    tone({ start: 0.09, freq: 1175, dur: 0.16, type: "sine", gain: 0.06 });
  },
};
