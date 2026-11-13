"use client";

// Chess sounds in the spirit of a wooden board: every knock is a short band-passed noise transient
// (the "click" of contact) layered over a low sine body with a fast pitch drop, varied ±4% per play.
import { arpeggio, noise, tone } from "@/lib/games/audio";

const vary = (f: number) => f * (0.96 + Math.random() * 0.08);

function knock(o: { body: number; click: number; gain?: number; start?: number; dur?: number; pan?: number; bright?: number }) {
  const g = o.gain ?? 1;
  const start = o.start ?? 0;
  const body = vary(o.body);
  // impact transient
  noise({ start, dur: 0.035, gain: 0.32 * g, filter: "bandpass", freq: vary(o.click), q: 1.6, pan: o.pan });
  // hollow wood resonance
  tone({ freq: body * 1.9, freqEnd: body * 1.55, start, dur: 0.06, type: "triangle", gain: 0.05 * g * (o.bright ?? 1), lowpass: 2600, pan: o.pan });
  // body
  tone({ freq: body, freqEnd: body * 0.62, start, dur: o.dur ?? 0.11, type: "sine", gain: 0.34 * g, attack: 0.002, pan: o.pan });
}

export const chessSfx = {
  /** your own move */
  move() {
    knock({ body: 230, click: 2400 });
  },
  /** the opponent's move: a touch lower and softer */
  opponentMove() {
    knock({ body: 196, click: 1900, gain: 0.9 });
  },
  capture() {
    knock({ body: 175, click: 3400, gain: 1.15, dur: 0.14, bright: 1.6 });
    noise({ start: 0.012, dur: 0.07, gain: 0.16, filter: "highpass", freq: 3000, q: 0.7 });
    knock({ body: 150, click: 1500, gain: 0.55, start: 0.045 });
  },
  castle() {
    knock({ body: 225, click: 2300, gain: 0.9, pan: -0.15 });
    knock({ body: 205, click: 2100, gain: 0.85, start: 0.105, pan: 0.15 });
  },
  check() {
    knock({ body: 220, click: 2600, gain: 0.85 });
    tone({ freq: vary(1318), start: 0.03, dur: 0.32, type: "sine", gain: 0.11 });
    tone({ freq: vary(1975), start: 0.03, dur: 0.2, type: "sine", gain: 0.05 });
  },
  promote() {
    knock({ body: 230, click: 2400 });
    arpeggio([659, 880, 1109, 1319], { step: 0.055, dur: 0.28, type: "triangle", gain: 0.075, lowpass: 5000, start: 0.04 });
    noise({ start: 0.05, dur: 0.3, gain: 0.05, filter: "bandpass", freq: 5000, freqEnd: 9000, q: 2 });
  },
  illegal() {
    tone({ freq: 120, freqEnd: 90, dur: 0.14, type: "sine", gain: 0.28 });
    noise({ dur: 0.05, gain: 0.12, filter: "lowpass", freq: 600, q: 0.8 });
  },
  premove() {
    noise({ dur: 0.025, gain: 0.14, filter: "bandpass", freq: 3200, q: 2 });
    tone({ freq: vary(520), freqEnd: 440, dur: 0.06, type: "sine", gain: 0.08 });
  },
  gameStart() {
    arpeggio([523.25, 659.25, 783.99], { step: 0.08, dur: 0.5, type: "sine", gain: 0.09 });
    tone({ freq: 1046.5, start: 0.24, dur: 0.6, type: "sine", gain: 0.04 });
  },
  win() {
    // warm low gong + bright major bloom
    tone({ freq: 130.8, freqEnd: 128, dur: 1.6, type: "sine", gain: 0.22, attack: 0.005 });
    tone({ freq: 261.6, dur: 1.2, type: "triangle", gain: 0.06, lowpass: 1800 });
    arpeggio([523.25, 659.25, 783.99, 1046.5], { step: 0.07, dur: 0.9, type: "sine", gain: 0.07, start: 0.05 });
  },
  loss() {
    tone({ freq: 110, freqEnd: 104, dur: 1.7, type: "sine", gain: 0.24, attack: 0.005 });
    tone({ freq: 220, dur: 1.2, type: "triangle", gain: 0.05, lowpass: 1200 });
    arpeggio([392, 311.1, 261.6], { step: 0.14, dur: 0.9, type: "sine", gain: 0.07, start: 0.06 });
  },
  draw() {
    tone({ freq: 123.5, dur: 1.4, type: "sine", gain: 0.2, attack: 0.005 });
    arpeggio([440, 554.4], { step: 0.12, dur: 0.9, type: "sine", gain: 0.07, start: 0.05 });
  },
  tick() {
    noise({ dur: 0.02, gain: 0.1, filter: "bandpass", freq: 4200, q: 3 });
    tone({ freq: 1600, dur: 0.035, type: "sine", gain: 0.04 });
  },
  correct() {
    arpeggio([784, 1175], { step: 0.07, dur: 0.25, type: "sine", gain: 0.09 });
  },
  wrong() {
    tone({ freq: 196, freqEnd: 150, dur: 0.25, type: "triangle", gain: 0.14, lowpass: 1500 });
  },
};
