"use client";

import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { ShaderBackdrop } from "./ShaderBackdrop";
import { Scene, SCENES } from "./Scene";
import { MagneticLink, RevealWords } from "./primitives";

const ORBIT_CLIPS = [
  { words: ["NOBODY", "TELLS", "YOU"], tag: "HOOK", dur: "0:32", score: 9.4 },
  { words: ["THIS", "CHANGED", "EVERYTHING"], tag: "TOP CUT", dur: "0:47", score: 9.1 },
  { words: ["WAIT", "FOR", "IT"], tag: "PAYOFF", dur: "0:21", score: 8.7 },
  { words: ["THE", "BIGGEST", "MISTAKE"], tag: "EP.04", dur: "0:38", score: 8.9 },
  { words: ["HONESTLY", "THE", "SECRET"], tag: "CLIP 5", dur: "0:29", score: 8.2 },
  { words: ["STOP", "DOING", "THIS"], tag: "VIRAL", dur: "0:44", score: 9.6 },
  { words: ["LISTEN", "TO", "THIS"], tag: "CLIP 7", dur: "0:26", score: 8.0 },
  { words: ["FINALLY", "THE", "TRUTH"], tag: "CLIP 8", dur: "0:51", score: 8.5 },
];

function OrbitCard({ i, total }: { i: number; total: number }) {
  const c = ORBIT_CLIPS[i];
  const accent = SCENES[i % SCENES.length].accent;
  return (
    <div
      className="orbit-card"
      style={{ transform: `rotateY(${(360 / total) * i}deg) translateZ(var(--orbit-r))` }}
    >
      {/* front */}
      <div className="orbit-face rounded-[18px] border border-white/15 bg-ink-2 p-1.5 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)]">
        <div className="relative h-full w-full overflow-hidden rounded-[13px]">
          <Scene variant={i} />
          <div className="absolute inset-x-2 top-2 flex items-center justify-between font-mono text-[8px] uppercase tracking-wider text-white/80 sm:text-[9px]">
            <span className="rounded-full bg-black/40 px-1.5 py-0.5 backdrop-blur">{c.tag}</span>
            <span>{c.dur}</span>
          </div>
          <div className="absolute inset-x-2 top-7 h-[3px] overflow-hidden rounded-full bg-white/20">
            <div className="orbit-progress h-full rounded-full" style={{ background: accent, animationDelay: `${-i * 0.9}s` }} />
          </div>
          <div className="absolute inset-x-1 bottom-[22%] text-center font-[Poppins] text-[10px] font-extrabold leading-tight tracking-tight text-white sm:text-[13px]">
            {c.words.map((w, wi) => (
              <span
                key={wi}
                className="cap-word inline-block px-[2px] [text-shadow:0_2px_0_#000,0_0_6px_rgba(0,0,0,0.8)]"
                style={{ ["--hl" as string]: accent, animationDelay: `${wi * 0.8 + i * 0.2}s` }}
              >
                {w}
              </span>
            ))}
          </div>
          <div className="absolute bottom-2 left-2 rounded-full bg-black/50 px-1.5 py-0.5 font-mono text-[8px] text-moss backdrop-blur sm:text-[9px]">
            ★ {c.score.toFixed(1)}
          </div>
        </div>
      </div>
      {/* back */}
      <div className="orbit-face orbit-back rounded-[18px] border border-white/10 bg-gradient-to-b from-ink-3 to-ink p-3">
        <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10">
          <div className="h-6 w-6 rounded-full" style={{ background: accent, boxShadow: `0 0 24px ${accent}` }} />
          <span className="font-mono text-[8px] uppercase tracking-[0.25em] text-white/40">9:16</span>
        </div>
      </div>
    </div>
  );
}

function SourceFrame() {
  return (
    <div className="source-frame absolute left-1/2 top-1/2">
      <div className="relative rounded-2xl border border-white/15 bg-ink-2/90 p-1.5 shadow-[0_0_80px_-10px_rgba(255,78,31,0.55)] backdrop-blur">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl">
          <Scene variant={0} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
          <div className="absolute left-3 top-2.5 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 pulse-dot" /> Source · 1:12:04
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-lg">
              <Play className="ml-0.5 h-4 w-4 fill-ink text-ink" />
            </div>
          </div>
          {/* timeline with detected highlights */}
          <div className="absolute inset-x-3 bottom-2.5">
            <div className="relative h-1.5 rounded-full bg-white/15">
              {[0.08, 0.27, 0.44, 0.63, 0.81].map((l, k) => (
                <span
                  key={k}
                  className="absolute top-0 h-full rounded-full bg-ember shadow-[0_0_8px_var(--ember)]"
                  style={{ left: `${l * 100}%`, width: `${6 + (k % 3) * 2}%` }}
                />
              ))}
              <span className="playhead absolute -top-1 h-3.5 w-0.5 rounded bg-white" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  // cursor parallax for the 3D stage
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const smx = useSpring(mx, { stiffness: 60, damping: 18 });
  const smy = useSpring(my, { stiffness: 60, damping: 18 });
  const tiltY = useTransform(smx, [-1, 1], [-14, 14]);
  const tiltXMouse = useTransform(smy, [-1, 1], [8, -8]);

  // scroll: the stage tips back and the copy drifts away
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const tiltXScroll = useTransform(scrollYProgress, [0, 1], [0, 22]);
  const stageScale = useTransform(scrollYProgress, [0, 1], [1, 0.82]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const tiltX = useTransform(() => -10 + tiltXMouse.get() + tiltXScroll.get());

  function onMove(e: React.PointerEvent) {
    if (reduce || e.pointerType !== "mouse") return;
    mx.set((e.clientX / window.innerWidth) * 2 - 1);
    my.set((e.clientY / window.innerHeight) * 2 - 1);
  }

  return (
    <section
      ref={sectionRef}
      onPointerMove={onMove}
      className="relative isolate overflow-hidden px-5 pt-28 pb-10 sm:px-6 md:pt-32"
    >
      <ShaderBackdrop />
      <div className="hero-floor pointer-events-none absolute inset-x-0 bottom-0 h-[55%]" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" aria-hidden />

      <motion.div style={{ y: copyY, opacity: copyOpacity }} className="relative z-10 mx-auto flex max-w-6xl flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7 }}
          className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.04] py-1.5 pl-1.5 pr-4 font-mono text-[11px] uppercase tracking-[0.18em] text-paper-dim shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md"
        >
          <span className="rounded-full bg-moss px-2 py-0.5 text-[10px] font-semibold tracking-wider text-ink">New</span>
          Animated captions · in-browser editor
        </motion.div>

        <h1 className="text-balance font-display text-[2.7rem] font-semibold leading-[0.98] tracking-[-0.035em] text-paper sm:text-6xl md:text-[5.6rem]">
          <RevealWords text="Any video in." delay={0.1} />
          <br />
          <span className="relative inline-block">
            <span className="hero-gradient-text italic">
              <RevealWords text="Scroll-stopping" delay={0.3} />
            </span>
          </span>{" "}
          <RevealWords text="shorts out." delay={0.45} />
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="mt-7 max-w-xl text-balance text-base leading-relaxed text-paper-dim md:text-lg"
        >
          Paste a YouTube, Instagram, TikTok or Facebook link — or drop a file.
          Clipforge finds the moments worth sharing, reframes them vertical,
          burns in captions, and hands you Reels and Shorts ready to post.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.85 }}
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
        >
          <MagneticLink href="/studio" className="cta-primary group">
            <span className="relative z-10 inline-flex items-center gap-2">
              Start clipping — it&apos;s free
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
          </MagneticLink>
          <MagneticLink
            href="#how"
            strength={0.2}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-7 py-3.5 text-sm font-semibold text-paper backdrop-blur transition hover:border-white/35 hover:bg-white/[0.07]"
          >
            <span className="inline-flex items-center gap-2">
              <Play className="h-3.5 w-3.5 fill-paper" /> See how it works
            </span>
          </MagneticLink>
        </motion.div>
      </motion.div>

      {/* 3D stage */}
      <motion.div
        initial={{ opacity: 0, y: 80 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.4, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="orbit-stage relative z-0 mx-auto mt-8 w-full max-w-6xl md:mt-6"
      >
        <motion.div
          style={{ rotateX: tiltX, rotateY: tiltY, scale: stageScale, transformStyle: "preserve-3d" }}
          className="absolute inset-0"
        >
          <div className="orbit-ring" style={{ transformStyle: "preserve-3d" }}>
            {ORBIT_CLIPS.map((_, i) => (
              <OrbitCard key={i} i={i} total={ORBIT_CLIPS.length} />
            ))}
          </div>
          <SourceFrame />
          <div className="orbit-halo" aria-hidden />
        </motion.div>
      </motion.div>
    </section>
  );
}
