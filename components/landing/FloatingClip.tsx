"use client";

import { motion } from "framer-motion";

interface Props {
  rotate: number;
  delay: number;
  className?: string;
  accent?: string;
  caption: string;
  duration: string;
}

export function FloatingClip({ rotate, delay, className = "", accent = "var(--ember)", caption, duration }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotate: rotate - 4 }}
      animate={{ opacity: 1, y: [0, -10, 0], rotate }}
      transition={{
        opacity: { duration: 0.8, delay },
        y: { duration: 5.5, repeat: Infinity, ease: "easeInOut", delay },
        rotate: { duration: 0.8, delay },
      }}
      className={`absolute w-[150px] rounded-2xl border border-line-strong bg-ink-2 p-2 shadow-2xl shadow-black/50 ${className}`}
    >
      <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-ink-3">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            background: `radial-gradient(circle at 30% 20%, ${accent}33, transparent 60%)`,
          }}
        />
        <div className="absolute left-2 right-2 top-2 h-1 rounded-full bg-paper/10">
          <div className="h-full w-2/3 rounded-full" style={{ background: accent }} />
        </div>
        <div className="absolute bottom-7 left-2 right-2 space-y-1">
          <div className="h-2 w-5/6 rounded-full bg-paper/80" />
          <div className="h-2 w-1/2 rounded-full bg-paper/50" />
        </div>
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[9px] font-mono uppercase tracking-wider text-paper/60">
          <span>{caption}</span>
          <span>{duration}</span>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-paper/90">
            <div
              className="ml-0.5 h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent"
              style={{ borderLeftColor: "var(--ink)" }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
