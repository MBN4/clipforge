"use client";

import { useRef, useState } from "react";
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { Scene } from "./Scene";

const STAGES = [
  {
    n: "01",
    kicker: "Ingest",
    title: "Drop a link or a file",
    body: "YouTube, Instagram, TikTok, Facebook — or a video already on your disk. Pick a time range on long sources and only that section is pulled in.",
  },
  {
    n: "02",
    kicker: "Transcribe",
    title: "It actually listens",
    body: "Whisper transcribes every word with its own timestamp — on CPU, no GPU needed — so captions land exactly when the words are said.",
  },
  {
    n: "03",
    kicker: "Score",
    title: "Every moment gets scored",
    body: "Candidate windows are scored for hooks, pacing and punch. Add an Anthropic key and Claude re-ranks and titles the picks too.",
  },
  {
    n: "04",
    kicker: "Render",
    title: "Vertical, captioned, ready",
    body: "Each pick is reframed to 9:16 over a blurred backdrop, captioned word-by-word and rendered in parallel — ready to post or polish in the editor.",
  },
];

const TRANSCRIPT = "honestly the biggest mistake nobody tells you about is this one".split(" ");
const HOOKS = new Set(["honestly", "biggest", "mistake", "nobody"]);
const SOURCES = ["YouTube", "TikTok", "Instagram", "Facebook"];
const SEGMENTS = [0.42, 0.88, 0.35, 0.97, 0.55, 0.3, 0.91, 0.48];

function TranscriptWord({ p, i, word }: { p: MotionValue<number>; i: number; word: string }) {
  const start = 0.28 + (i / TRANSCRIPT.length) * 0.17;
  const opacity = useTransform(p, [start, start + 0.02], [0, 1]);
  const y = useTransform(p, [start, start + 0.02], [8, 0]);
  const hook = HOOKS.has(word);
  const color = useTransform(p, [0.52, 0.56], ["#f5efe3", hook ? "#ff4e1f" : "#a69c8c"]);
  const bg = useTransform(p, [0.52, 0.56], ["rgba(255,78,31,0)", hook ? "rgba(255,78,31,0.14)" : "rgba(255,78,31,0)"]);
  return (
    <motion.span style={{ opacity, y, color, backgroundColor: bg }} className="inline-block rounded px-1">
      {word}
    </motion.span>
  );
}

function SourceChip({ p, i, label }: { p: MotionValue<number>; i: number; label: string }) {
  const angle = (i / SOURCES.length) * Math.PI * 2 + Math.PI / 4;
  const sx = Math.cos(angle) * 300;
  const sy = Math.sin(angle) * 230;
  const t0 = 0.02 + i * 0.03;
  const x = useTransform(p, [t0, t0 + 0.12], [sx, 0]);
  const y = useTransform(p, [t0, t0 + 0.12], [sy, 0]);
  const opacity = useTransform(p, [0, t0, t0 + 0.1, t0 + 0.13], [0, 1, 1, 0]);
  const scale = useTransform(p, [t0, t0 + 0.12], [1, 0.4]);
  return (
    <motion.div
      style={{ x, y, opacity, scale }}
      className="absolute left-1/2 top-1/2 -ml-14 -mt-5 flex h-10 w-28 items-center justify-center rounded-full border border-white/15 bg-ink-2/90 font-mono text-[11px] uppercase tracking-widest text-paper shadow-[0_10px_40px_-10px_rgba(255,78,31,0.6)] backdrop-blur"
    >
      {label}
    </motion.div>
  );
}

function Bar({ p, i, h }: { p: MotionValue<number>; i: number; h: number }) {
  const t0 = 0.5 + i * 0.012;
  const height = useTransform(p, [t0, t0 + 0.08], ["6%", `${Math.round(h * 100)}%`]);
  const top = h > 0.85;
  const glow = useTransform(
    p,
    [0.62, 0.68],
    top ? ["0 0 0px rgba(255,78,31,0)", "0 0 22px rgba(255,78,31,0.9)"] : ["0 0 0px rgba(0,0,0,0)", "0 0 0px rgba(0,0,0,0)"]
  );
  const bg = useTransform(p, [0.62, 0.68], ["#3a332c", top ? "#ff4e1f" : "#3a332c"]);
  const labelOpacity = useTransform(p, [0.64, 0.68], [0, 1]);
  return (
    <div className="relative flex h-full flex-1 items-end">
      <motion.div style={{ height, boxShadow: glow, backgroundColor: bg }} className="w-full rounded-md" />
      {top && (
        <motion.span
          style={{ opacity: labelOpacity }}
          className="absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[10px] text-moss"
        >
          {(h * 10).toFixed(1)}
        </motion.span>
      )}
    </div>
  );
}

function Stage({ p }: { p: MotionValue<number> }) {
  // the frame assembles, then morphs 16:9 → 9:16
  const rotX = useTransform(p, [0, 0.16], [38, 0]);
  const rotY = useTransform(p, [0, 0.16, 0.75, 0.88], [-18, 0, 0, 0]);
  const scale = useTransform(p, [0, 0.16], [0.7, 1]);
  const frameOpacity = useTransform(p, [0.04, 0.12], [0, 1]);
  const width = useTransform(p, [0.76, 0.88], [480, 252]);
  const height = useTransform(p, [0.76, 0.88], [270, 448]);
  const blurOpacity = useTransform(p, [0.8, 0.88], [0, 1]);
  const capOpacity = useTransform(p, [0.86, 0.9], [0, 1]);
  const capScale = useTransform(p, [0.86, 0.9], [0.6, 1]);
  const scanY = useTransform(p, [0.25, 0.5], ["0%", "100%"]);
  const scanOpacity = useTransform(p, [0.24, 0.27, 0.48, 0.5], [0, 1, 1, 0]);

  const lowerOpacity = useTransform(p, [0.22, 0.28, 0.72, 0.77], [0, 1, 1, 0]);
  const barsOpacity = useTransform(p, [0.47, 0.52, 0.72, 0.77], [0, 1, 1, 0]);
  const transcriptOpacity = useTransform(p, [0.26, 0.3, 0.72, 0.77], [0, 1, 1, 0]);

  const cloneOpacity = useTransform(p, [0.9, 0.97], [0, 1]);
  const cloneXL = useTransform(p, [0.9, 1], [0, -230]);
  const cloneXR = useTransform(p, [0.9, 1], [0, 230]);
  const cloneRotL = useTransform(p, [0.9, 1], [0, 24]);
  const cloneRotR = useTransform(p, [0.9, 1], [0, -24]);
  const doneOpacity = useTransform(p, [0.95, 1], [0, 1]);

  return (
    <div className="relative h-[560px] w-[620px] [perspective:1400px]">
      {/* floor glow */}
      <div className="absolute left-1/2 top-[62%] h-[220px] w-[520px] -translate-x-1/2 rounded-[50%] bg-ember/20 blur-3xl" />

      {SOURCES.map((s, i) => (
        <SourceChip key={s} p={p} i={i} label={s} />
      ))}

      {/* transcript */}
      <motion.div
        style={{ opacity: transcriptOpacity }}
        className="absolute inset-x-6 top-2 text-center font-mono text-[13px] leading-7 text-paper"
      >
        {TRANSCRIPT.map((w, i) => (
          <TranscriptWord key={i} p={p} i={i} word={w} />
        ))}
      </motion.div>

      {/* clones fanning out at the end */}
      {[
        { x: cloneXL, r: cloneRotL, v: 1 },
        { x: cloneXR, r: cloneRotR, v: 2 },
      ].map((c, k) => (
        <motion.div
          key={k}
          style={{ x: c.x, rotateY: c.r, opacity: cloneOpacity }}
          className="absolute left-1/2 top-1/2 -ml-[126px] -mt-[224px] h-[448px] w-[252px] overflow-hidden rounded-2xl border border-white/15 shadow-2xl"
        >
          <Scene variant={c.v} blur />
          <div className="absolute inset-x-0 top-1/2 aspect-video -translate-y-1/2">
            <Scene variant={c.v} />
          </div>
          <div className="absolute inset-x-0 bottom-[24%] text-center font-[Poppins] text-xl font-extrabold text-white [text-shadow:0_3px_0_#000]">
            {k === 0 ? (
              <>WAIT <span className="text-[#25e2ff]">FOR</span> IT</>
            ) : (
              <>STOP <span className="text-moss">DOING</span> THIS</>
            )}
          </div>
        </motion.div>
      ))}

      {/* the frame */}
      <motion.div
        style={{ rotateX: rotX, rotateY: rotY, scale, opacity: frameOpacity, width, height }}
        className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/20 bg-ink shadow-[0_40px_120px_-30px_rgba(255,78,31,0.7)]"
      >
        <motion.div style={{ opacity: blurOpacity }} className="absolute inset-0">
          <Scene variant={0} blur />
        </motion.div>
        <div className="absolute inset-x-0 top-1/2 aspect-video -translate-y-1/2">
          <Scene variant={0} />
        </div>
        {/* transcription scan line */}
        <motion.div
          style={{ left: scanY, opacity: scanOpacity }}
          className="absolute inset-y-0 w-px bg-moss shadow-[0_0_16px_4px_rgba(205,251,94,0.6)]"
        />
        <motion.div
          style={{ opacity: capOpacity, scale: capScale }}
          className="absolute inset-x-0 bottom-[24%] text-center font-[Poppins] text-2xl font-extrabold tracking-tight text-white [text-shadow:0_3px_0_#000,0_0_10px_rgba(0,0,0,0.7)]"
        >
          THE <span className="text-[#ffd21f]">BIGGEST</span> MISTAKE
        </motion.div>
        <div className="absolute left-3 top-3 rounded-full bg-black/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-white/80 backdrop-blur">
          <span className="grid">
            <motion.span style={{ opacity: useTransform(p, [0.76, 0.8], [1, 0]) }} className="[grid-area:1/1]">16:9 source</motion.span>
            <motion.span style={{ opacity: useTransform(p, [0.84, 0.88], [0, 1]) }} className="[grid-area:1/1]">9:16 vertical</motion.span>
          </span>
        </div>
      </motion.div>

      {/* waveform */}
      <motion.div
        style={{ opacity: lowerOpacity }}
        className="absolute inset-x-16 top-[calc(50%+150px)] flex h-10 items-center gap-[3px]"
      >
        {Array.from({ length: 56 }).map((_, i) => (
          <span
            key={i}
            className="wave-bar flex-1 rounded-full bg-paper/60"
            style={{ animationDelay: `${(i % 14) * -0.09}s`, height: `${30 + ((i * 37) % 70)}%` }}
          />
        ))}
      </motion.div>

      {/* score bars */}
      <motion.div
        style={{ opacity: barsOpacity }}
        className="absolute inset-x-20 top-[calc(50%+205px)] flex h-14 items-end gap-2"
      >
        {SEGMENTS.map((h, i) => (
          <Bar key={i} p={p} i={i} h={h} />
        ))}
      </motion.div>

      <motion.div
        style={{ opacity: doneOpacity }}
        className="absolute inset-x-0 bottom-0 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-moss"
      >
        ✓ 3 clips ready · no watermark
      </motion.div>
    </div>
  );
}

export function ForgeSequence() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const idx = Math.min(STAGES.length - 1, Math.max(0, Math.floor(v * STAGES.length)));
    setActive((cur) => (cur === idx ? cur : idx));
  });
  const lineScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section id="how" ref={ref} className="relative h-[420vh] scroll-mt-0">
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_50%,rgba(255,78,31,0.10),transparent_70%)]" />
        <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-2 px-5 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
          {/* copy */}
          <div className="relative z-10 min-w-0 pt-16 lg:pt-0">
            <div className="flex items-baseline gap-3 font-mono text-xs uppercase tracking-[0.25em] text-paper-dim">
              <span className="text-ember">How it works</span>
              <span>
                {STAGES[active].n} / 04
              </span>
            </div>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-[1.02] tracking-[-0.03em] md:text-5xl">
              One long video.
              <br />
              <span className="text-paper-dim">Forged into shorts.</span>
            </h2>

            <div className="relative mt-6 pl-6 lg:mt-10">
              <div className="absolute left-0 top-1 h-[calc(100%-8px)] w-px bg-line-strong" />
              <motion.div
                style={{ scaleY: lineScale }}
                className="absolute left-0 top-1 h-[calc(100%-8px)] w-px origin-top bg-gradient-to-b from-ember via-ember-soft to-moss"
              />
              <ol className="space-y-1 lg:space-y-3">
                {STAGES.map((s, i) => {
                  const on = i === active;
                  return (
                    <li key={s.n} className="relative">
                      <span
                        className={`absolute -left-[27px] top-[9px] h-[7px] w-[7px] rounded-full transition-all duration-500 ${
                          i <= active ? "bg-ember shadow-[0_0_12px_var(--ember)]" : "bg-ink-3 ring-1 ring-line-strong"
                        }`}
                      />
                      <div className={`transition-all duration-500 ${on ? "opacity-100" : "opacity-40"}`}>
                        <div className="flex items-baseline gap-3">
                          <span className="font-mono text-[11px] tracking-widest text-ember">{s.n}</span>
                          <h3 className="font-display text-lg font-semibold md:text-xl">{s.title}</h3>
                        </div>
                        <div
                          className={`grid transition-all duration-500 ease-out ${
                            on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                          }`}
                        >
                          <p className="overflow-hidden pl-8 text-sm leading-relaxed text-paper-dim">
                            <span className="block pt-2 pb-1">{s.body}</span>
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          {/* 3D stage */}
          <div className="relative h-[330px] min-w-0 sm:h-[440px] lg:h-[580px]">
            <div className="absolute left-1/2 top-1/2 -ml-[310px] -mt-[280px] origin-center scale-[0.56] sm:scale-[0.75] lg:scale-100">
              <Stage p={scrollYProgress} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
