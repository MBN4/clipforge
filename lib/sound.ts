"use client";

// Tiny synth-based sound effects — no audio files to host or load.
// Everything is generated with the Web Audio API at call time.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem("clipforge-muted") === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean) {
  try {
    localStorage.setItem("clipforge-muted", muted ? "1" : "0");
  } catch {
    // ignore
  }
}

export function getMuted(): boolean {
  return isMuted();
}

interface Tone {
  freq: number;
  start: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
}

let noiseBuffer: AudioBuffer | null = null;
function getNoiseBuffer(audio: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const buffer = audio.createBuffer(1, audio.sampleRate * 0.3, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buffer;
  return buffer;
}

/** A short, filtered noise burst — reads as a physical "tock" rather than a beep. */
function playClick(freq: number, duration: number, gain: number, delay = 0) {
  if (isMuted()) return;
  const audio = getCtx();
  if (!audio) return;
  const now = audio.currentTime + delay;

  const src = audio.createBufferSource();
  src.buffer = getNoiseBuffer(audio);

  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = 1.1;

  const env = audio.createGain();
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(gain, now + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  src.connect(filter);
  filter.connect(env);
  env.connect(audio.destination);
  src.start(now);
  src.stop(now + duration + 0.02);
}

function playTones(tones: Tone[]) {
  if (isMuted()) return;
  const audio = getCtx();
  if (!audio) return;
  const now = audio.currentTime;

  for (const t of tones) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = t.type || "sine";
    osc.frequency.value = t.freq;
    const peak = t.gain ?? 0.08;
    const startAt = now + t.start;
    const endAt = startAt + t.duration;

    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(peak, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(startAt);
    osc.stop(endAt + 0.02);
  }
}

export const sfx = {
  click: () => playClick(1400, 0.05, 0.3),
  move: () => playClick(900, 0.07, 0.35),
  capture: () => {
    playClick(700, 0.08, 0.4);
    playClick(300, 0.1, 0.3, 0.03);
  },
  check: () =>
    playTones([
      { freq: 700, start: 0, duration: 0.08, type: "sawtooth", gain: 0.05 },
      { freq: 880, start: 0.09, duration: 0.1, type: "sawtooth", gain: 0.05 },
    ]),
  eat: () => playTones([{ freq: 660, start: 0, duration: 0.08, type: "square", gain: 0.06 }]),
  merge: () =>
    playTones([
      { freq: 480, start: 0, duration: 0.07, type: "triangle" },
      { freq: 640, start: 0.05, duration: 0.09, type: "triangle" },
    ]),
  win: () =>
    playTones([
      { freq: 523, start: 0, duration: 0.12, type: "triangle" },
      { freq: 659, start: 0.1, duration: 0.12, type: "triangle" },
      { freq: 784, start: 0.2, duration: 0.18, type: "triangle" },
    ]),
  lose: () =>
    playTones([
      { freq: 300, start: 0, duration: 0.14, type: "sawtooth", gain: 0.05 },
      { freq: 220, start: 0.12, duration: 0.18, type: "sawtooth", gain: 0.05 },
      { freq: 160, start: 0.26, duration: 0.24, type: "sawtooth", gain: 0.05 },
    ]),
  jobDone: () =>
    playTones([
      { freq: 587, start: 0, duration: 0.14, type: "sine", gain: 0.09 },
      { freq: 740, start: 0.12, duration: 0.14, type: "sine", gain: 0.09 },
      { freq: 988, start: 0.24, duration: 0.22, type: "sine", gain: 0.09 },
    ]),
};
