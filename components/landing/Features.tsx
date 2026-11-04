"use client";

import { motion } from "framer-motion";

const features = [
  {
    title: "Smart reframing",
    body: "Blurred backdrop keeps the full shot in view instead of butchering a face with a blind crop.",
  },
  {
    title: "Word-by-word captions",
    body: "Burned-in, bold, and timed to the syllable — the format that actually keeps people watching.",
  },
  {
    title: "Highlight scoring",
    body: "Every candidate clip gets a reason it was picked, so you know why it's worth posting.",
  },
  {
    title: "Zero cost, zero watermark",
    body: "No subscription, no credits ticking down, nothing stamped in the corner of your export.",
  },
];

export function Features() {
  return (
    <section className="border-t border-line px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <h2 className="max-w-lg font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Everything a $40/mo tool does.
          <span className="text-paper-dim"> For zero.</span>
        </h2>

        <div className="mt-16 grid gap-10 sm:grid-cols-2">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className="flex gap-5 border-b border-line pb-8"
            >
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-moss" />
              <div>
                <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-paper-dim">{f.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
