"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FloatingClip } from "./FloatingClip";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pt-24 pb-32 md:pt-32">
      <div
        className="pointer-events-none absolute -top-40 right-[10%] h-[420px] w-[420px] rounded-full opacity-25 blur-[120px]"
        style={{ background: "var(--ember)" }}
      />
      <div
        className="pointer-events-none absolute top-20 left-[6%] h-[280px] w-[280px] rounded-full opacity-[0.12] blur-[100px]"
        style={{ background: "var(--moss)" }}
      />

      <div className="relative mx-auto flex max-w-6xl flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-7 inline-flex items-center gap-2 rounded-full border border-line-strong bg-ink-2 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-paper-dim"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-moss" />
          Free · no watermark · no AI slop
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="text-balance font-display text-[2.6rem] font-semibold leading-[1.04] tracking-tight text-paper sm:text-6xl md:text-7xl"
        >
          Any video in.
          <br />
          <span className="italic text-ember">Scroll-stopping</span> shorts out.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12 }}
          className="mt-6 max-w-xl text-balance text-base text-paper-dim md:text-lg"
        >
          Paste a YouTube, Instagram, TikTok or Facebook link — or drop a file.
          Clipforge finds the moments worth sharing, reframes them vertical,
          burns in captions, and hands you Reels and Shorts ready to post.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18 }}
          className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Link
            href="/studio"
            className="group inline-flex items-center gap-2 rounded-full bg-ember px-7 py-3.5 text-sm font-semibold text-ink shadow-[0_8px_30px_-8px_var(--ember)] transition hover:brightness-110"
          >
            Start clipping — it's free
            <span className="transition group-hover:translate-x-0.5">→</span>
          </Link>
          <a
            href="#how"
            className="inline-flex items-center gap-2 rounded-full border border-line-strong px-7 py-3.5 text-sm font-semibold text-paper transition hover:border-paper/40"
          >
            See how it works
          </a>
        </motion.div>

        <div className="relative mt-20 h-[260px] w-full max-w-3xl md:h-[300px]">
          <FloatingClip
            rotate={-10}
            delay={0.3}
            accent="var(--ember)"
            caption="EP.04"
            duration="0:32"
            className="left-[6%] top-2 hidden sm:block"
          />
          <FloatingClip
            rotate={5}
            delay={0.45}
            accent="var(--moss)"
            caption="HOOK"
            duration="0:21"
            className="right-[8%] top-10 hidden sm:block"
          />
          <FloatingClip
            rotate={-2}
            delay={0.15}
            accent="var(--ember-soft)"
            caption="TOP CUT"
            duration="0:47"
            className="left-1/2 top-0 -translate-x-1/2 scale-110"
          />
        </div>
      </div>
    </section>
  );
}
