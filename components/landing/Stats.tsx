"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";

const STATS = [
  { value: 40, suffix: "", label: "clips from a single video", decimals: 0 },
  { value: 2.7, suffix: "×", label: "faster renders than v1", decimals: 1 },
  { value: 9, suffix: "", label: "one-click caption looks", decimals: 0 },
  { value: 0, suffix: "", label: "watermarks. Ever.", decimals: 0 },
];

function Counter({ to, decimals, suffix }: { to: number; decimals: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? to : to === 0 ? 99 : 0);

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(to === 0 ? 99 : 0, to, {
      duration: to === 0 ? 1.6 : 1.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: setV,
    });
    return () => controls.stop();
  }, [inView, reduce, to]);

  return (
    <span ref={ref} className="tabular-nums">
      {v.toFixed(decimals)}
      {suffix}
    </span>
  );
}

export function Stats() {
  return (
    <section className="relative px-5 py-10 sm:px-6">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 md:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="group relative overflow-hidden bg-ink p-6 md:p-8">
            <div className="pointer-events-none absolute -bottom-16 -right-16 h-40 w-40 rounded-full bg-ember/0 blur-3xl transition-all duration-700 group-hover:bg-ember/25" />
            <div className="font-display text-5xl font-semibold tracking-tighter text-paper md:text-6xl">
              <Counter to={s.value} decimals={s.decimals} suffix={s.suffix} />
            </div>
            <div className="mt-2 font-mono text-[11px] uppercase tracking-widest text-paper-dim">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
