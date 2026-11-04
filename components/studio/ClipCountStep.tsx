"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { clipCountRange } from "@/lib/clipCount";

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export function ClipCountStep({
  title,
  duration,
  thumbnail,
  onConfirm,
  onCancel,
}: {
  title: string;
  duration: number;
  thumbnail?: string;
  onConfirm: (count: number) => void;
  onCancel: () => void;
}) {
  const range = clipCountRange(duration);
  const [count, setCount] = useState(range.default);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-lg"
    >
      <div className="flex items-center gap-4 rounded-2xl border border-line-strong bg-ink-2 p-4">
        {thumbnail ? (
          <img src={thumbnail} alt="" className="h-16 w-16 rounded-xl object-cover" />
        ) : (
          <div className="h-16 w-16 rounded-xl bg-ink-3" />
        )}
        <div className="min-w-0">
          <p className="truncate font-medium text-paper">{title}</p>
          <p className="font-mono text-xs text-paper-dim">{fmtDuration(duration)} long</p>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-baseline justify-between">
          <label className="text-sm font-medium text-paper">How many clips?</label>
          <span className="font-display text-3xl font-semibold text-ember">{count}</span>
        </div>

        <input
          type="range"
          min={range.min}
          max={range.max}
          value={count}
          onChange={(e) => setCount(parseInt(e.target.value, 10))}
          className="mt-4 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-3 accent-ember"
        />
        <div className="mt-2 flex justify-between font-mono text-[11px] text-paper-dim">
          <span>{range.min} clip</span>
          <span>{range.max} clips</span>
        </div>

        <p className="mt-4 text-xs text-paper-dim">
          Based on the video's length, up to {range.max} non-overlapping clips make sense here.
          We'll pick the {count} strongest moments.
        </p>
      </div>

      <div className="mt-8 flex gap-3">
        <button
          onClick={onCancel}
          className="rounded-full border border-line-strong px-5 py-3 text-sm font-semibold text-paper-dim transition hover:text-paper"
        >
          Back
        </button>
        <button
          onClick={() => onConfirm(count)}
          className="flex-1 rounded-full bg-ember py-3 text-sm font-semibold text-ink transition hover:brightness-110"
        >
          Clip it
        </button>
      </div>
    </motion.div>
  );
}
