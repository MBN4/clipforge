"use client";

// Synthesized UNO sound effects, built on the shared arcade primitives.
import { arpeggio, noise, tone } from "../audio";

const jit = (amt = 0.08) => 1 + (Math.random() * 2 - 1) * amt;

export const unoSounds = {
  /** one soft card flick while dealing */
  flick(pan = 0) {
    noise({ dur: 0.06, gain: 0.14, filter: "highpass", freq: 3200 * jit(0.15), q: 0.7, pan });
    noise({ dur: 0.04, gain: 0.05, filter: "bandpass", freq: 1800 * jit(), q: 1.2, pan });
  },
  /** snappy paper slap + tiny thump */
  play() {
    noise({ dur: 0.08, gain: 0.34, filter: "highpass", freq: 2600 * jit(0.12), q: 0.6 });
    noise({ dur: 0.05, gain: 0.18, filter: "bandpass", freq: 4200 * jit(), q: 1 });
    tone({ freq: 150 * jit(0.1), freqEnd: 70, dur: 0.09, gain: 0.22, type: "sine" });
  },
  /** swish: noise with a rising band-pass sweep */
  draw() {
    noise({ dur: 0.2, gain: 0.22, filter: "bandpass", freq: 700 * jit(0.1), freqEnd: 3400, q: 1.4, attack: 0.03 });
    noise({ start: 0.17, dur: 0.05, gain: 0.12, filter: "highpass", freq: 3000 });
  },
  /** rapid noise flutter */
  shuffle() {
    for (let i = 0; i < 14; i++) noise({ start: i * 0.045, dur: 0.05, gain: 0.12 + Math.random() * 0.07, filter: "highpass", freq: 2400 + Math.random() * 1800, q: 0.6, pan: (Math.random() - 0.5) * 0.5 });
  },
  skip() {
    noise({ dur: 0.32, gain: 0.26, filter: "bandpass", freq: 3600, freqEnd: 500, q: 2, attack: 0.02 });
    tone({ freq: 520, freqEnd: 180, dur: 0.22, gain: 0.1, type: "triangle" });
  },
  reverse() {
    noise({ dur: 0.26, gain: 0.22, filter: "bandpass", freq: 600, freqEnd: 3200, q: 2, attack: 0.02 });
    noise({ start: 0.24, dur: 0.26, gain: 0.2, filter: "bandpass", freq: 3200, freqEnd: 600, q: 2, attack: 0.02 });
    tone({ freq: 300, freqEnd: 620, dur: 0.24, gain: 0.09, type: "triangle" });
    tone({ start: 0.24, freq: 620, freqEnd: 300, dur: 0.24, gain: 0.09, type: "triangle" });
  },
  /** +2 / +4 punchy impact */
  power(big = false) {
    tone({ freq: big ? 110 : 140, freqEnd: 45, dur: 0.28, gain: 0.45, type: "sine" });
    noise({ dur: 0.18, gain: 0.3, filter: "lowpass", freq: 1400, freqEnd: 200, q: 0.8 });
    tone({ freq: big ? 220 : 280, freqEnd: 120, dur: 0.18, gain: 0.16, type: "sawtooth", lowpass: 1400 });
    if (big) tone({ start: 0.09, freq: 165, freqEnd: 60, dur: 0.3, gain: 0.3, type: "sine" });
  },
  /** shimmering arpeggio */
  wild() {
    arpeggio([523.25, 659.25, 783.99, 1046.5, 1318.5], { dur: 0.35, step: 0.055, gain: 0.09, type: "triangle", attack: 0.006 });
    noise({ dur: 0.4, gain: 0.05, filter: "highpass", freq: 6000, attack: 0.1 });
  },
  /** bright 3-note stinger */
  uno() {
    arpeggio([659.25, 880, 1174.66], { dur: 0.22, step: 0.085, gain: 0.16, type: "square", lowpass: 3200, attack: 0.004 });
    arpeggio([659.25, 880, 1174.66], { dur: 0.3, step: 0.085, gain: 0.07, type: "sine" });
  },
  catch() {
    tone({ freq: 880, freqEnd: 330, dur: 0.18, gain: 0.14, type: "square", lowpass: 2400 });
    noise({ dur: 0.1, gain: 0.18, filter: "highpass", freq: 2400 });
  },
  win() {
    arpeggio([523.25, 659.25, 783.99, 1046.5], { dur: 0.3, step: 0.11, gain: 0.14, type: "triangle" });
    arpeggio([783.99, 1046.5, 1318.5, 1567.98], { start: 0.5, dur: 0.6, step: 0.0, gain: 0.07, type: "sine" });
    tone({ start: 0.5, freq: 261.63, dur: 0.8, gain: 0.12, type: "triangle" });
    noise({ start: 0.5, dur: 0.5, gain: 0.06, filter: "highpass", freq: 5000, attack: 0.05 });
  },
  lose() {
    arpeggio([392, 349.23, 311.13, 261.63], { dur: 0.32, step: 0.16, gain: 0.13, type: "triangle", lowpass: 1600 });
    tone({ start: 0.5, freq: 130.81, freqEnd: 98, dur: 0.7, gain: 0.14, type: "sine" });
  },
  /** soft ping that it's your turn */
  turn() {
    tone({ freq: 988 * jit(0.01), dur: 0.16, gain: 0.07, type: "sine" });
    tone({ start: 0.06, freq: 1318.5, dur: 0.2, gain: 0.05, type: "sine" });
  },
  nope() {
    tone({ freq: 180, freqEnd: 130, dur: 0.14, gain: 0.14, type: "square", lowpass: 700 });
  },
};
