"use client";

// Shared synth engine for the arcade games — no audio files to host or load.
// Everything is generated with the Web Audio API at call time and routed through
// one master compressor, so layered sounds (a capture + a check, say) never clip.
// Each game builds its own sound set from these primitives (see lib/games/<game>/sounds.ts).
// The site-wide mute toggle (lib/sound.ts) is respected.
import { getMuted } from "@/lib/sound";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

function ensure(): { ctx: AudioContext; out: GainNode } | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 18;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(comp);
    comp.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return { ctx, out: master! };
}

/** Call from a user gesture (e.g. a click) so the very first sound isn't swallowed by autoplay rules. */
export function unlockAudio() {
  ensure();
}

export function canPlay(): boolean {
  return !getMuted();
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const b = c.createBuffer(1, Math.floor(c.sampleRate * 1.0), c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noiseBuf = b;
  return b;
}

export interface ToneOpts {
  freq: number;
  /** glide to this frequency over the note's duration */
  freqEnd?: number;
  /** seconds from now */
  start?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  /** stereo position -1 (left) .. 1 (right) */
  pan?: number;
  /** low-pass cutoff, to soften harsh waveforms */
  lowpass?: number;
}

/** One pitched note with a fast attack and an exponential decay. */
export function tone(o: ToneOpts) {
  if (!canPlay()) return;
  const e = ensure();
  if (!e) return;
  const { ctx: c, out } = e;
  const t0 = c.currentTime + (o.start ?? 0);
  const osc = c.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), t0 + o.dur);
  const g = c.createGain();
  const peak = o.gain ?? 0.15;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + (o.attack ?? 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  let node: AudioNode = osc;
  if (o.lowpass) {
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = o.lowpass;
    node.connect(f);
    node = f;
  }
  node.connect(g);
  let tail: AudioNode = g;
  if (o.pan && c.createStereoPanner) {
    const p = c.createStereoPanner();
    p.pan.value = o.pan;
    g.connect(p);
    tail = p;
  }
  tail.connect(out);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.03);
}

export interface NoiseOpts {
  start?: number;
  dur: number;
  gain?: number;
  attack?: number;
  filter?: BiquadFilterType;
  freq?: number;
  /** sweep the filter to this frequency over the duration */
  freqEnd?: number;
  q?: number;
  pan?: number;
}

/** A filtered noise burst — the building block of every "physical" sound: wood knocks, card slaps, dice rattles. */
export function noise(o: NoiseOpts) {
  if (!canPlay()) return;
  const e = ensure();
  if (!e) return;
  const { ctx: c, out } = e;
  const t0 = c.currentTime + (o.start ?? 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = o.filter ?? "bandpass";
  f.frequency.setValueAtTime(o.freq ?? 1500, t0);
  if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqEnd), t0 + o.dur);
  f.Q.value = o.q ?? 1;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(o.gain ?? 0.3, t0 + (o.attack ?? 0.002));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  src.connect(f);
  f.connect(g);
  let tail: AudioNode = g;
  if (o.pan && c.createStereoPanner) {
    const p = c.createStereoPanner();
    p.pan.value = o.pan;
    g.connect(p);
    tail = p;
  }
  tail.connect(out);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + o.dur + 0.03);
}

/** A sequence of notes — handy for jingles. `step` is the seconds between notes. */
export function arpeggio(freqs: number[], opts: Omit<ToneOpts, "freq" | "start"> & { step?: number; start?: number }) {
  const { step = 0.09, start = 0, ...rest } = opts;
  freqs.forEach((freq, i) => tone({ ...rest, freq, start: start + i * step }));
}
