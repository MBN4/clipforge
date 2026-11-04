"use client";

import { motion } from "framer-motion";

const steps = [
  {
    n: "01",
    title: "Drop a link or a file",
    body: "YouTube, Instagram, TikTok, Facebook — or a video already sitting on your disk. Clipforge pulls it in and gets to work.",
  },
  {
    n: "02",
    title: "It actually watches it",
    body: "Full transcription finds every sentence, pause and punchline, then scores each moment for hooks, pacing and payoff.",
  },
  {
    n: "03",
    title: "Vertical, captioned, ready",
    body: "The best 4–6 moments get reframed to 9:16, captioned word-by-word, and exported — no editing software required.",
  },
];

export function Steps() {
  return (
    <section id="how" className="border-t border-line px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Three steps.
            <br className="hidden md:block" /> No timeline to drag.
          </h2>
          <p className="max-w-sm text-sm text-paper-dim">
            Built for people who have better things to do than scrub through
            an hour of footage looking for the fifteen good seconds.
          </p>
        </div>

        <div className="grid gap-px overflow-hidden rounded-3xl border border-line bg-line md:grid-cols-3">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="bg-ink-2 p-8"
            >
              <span className="font-mono text-xs tracking-widest text-ember">{s.n}</span>
              <h3 className="mt-5 font-display text-xl font-semibold text-paper">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-paper-dim">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
