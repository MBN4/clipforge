"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { clipCountRange } from "@/lib/clipCount";
import { RangePicker } from "./RangePicker";

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

// Below this, trimming to a sub-range isn't worth the extra UI.
const RANGE_PICKER_THRESHOLD = 150;

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
  onConfirm: (count: number, range?: { start: number; end: number }) => void;
  onCancel: () => void;
}) {
  const [useRange, setUseRange] = useState(false);
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(duration);

  const effectiveDuration = useRange ? rangeEnd - rangeStart : duration;
  const countRange = clipCountRange(effectiveDuration);
  const [count, setCount] = useState(countRange.default);

  function handleRangeToggle(next: boolean) {
    setUseRange(next);
    const newEffective = next ? rangeEnd - rangeStart : duration;
    setCount(clipCountRange(newEffective).default);
  }

  function handleRangeChange(start: number, end: number) {
    setRangeStart(start);
    setRangeEnd(end);
    setCount(clipCountRange(end - start).default);
  }

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

      {duration > RANGE_PICKER_THRESHOLD && (
        <div className="mt-6">
          <div className="inline-flex rounded-full border border-line-strong bg-ink-3 p-1 text-xs">
            <button
              onClick={() => handleRangeToggle(false)}
              className={`rounded-full px-3 py-1.5 font-semibold transition ${
                !useRange ? "bg-paper text-ink" : "text-paper-dim hover:text-paper"
              }`}
            >
              Whole video
            </button>
            <button
              onClick={() => handleRangeToggle(true)}
              className={`rounded-full px-3 py-1.5 font-semibold transition ${
                useRange ? "bg-paper text-ink" : "text-paper-dim hover:text-paper"
              }`}
            >
              Pick a section
            </button>
          </div>

          {useRange && (
            <div className="mt-4 rounded-2xl border border-line-strong bg-ink-2 p-4">
              <p className="mb-3 text-xs text-paper-dim">
                Only this part of the video will be downloaded and scanned — faster for long videos.
              </p>
              <RangePicker duration={duration} start={rangeStart} end={rangeEnd} onChange={handleRangeChange} />
            </div>
          )}
        </div>
      )}

      <div className="mt-8">
        <div className="flex items-baseline justify-between">
          <label className="text-sm font-medium text-paper">How many clips?</label>
          <span className="font-display text-3xl font-semibold text-ember">{count}</span>
        </div>

        <input
          type="range"
          min={countRange.min}
          max={countRange.max}
          value={count}
          onChange={(e) => setCount(parseInt(e.target.value, 10))}
          className="mt-4 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-3 accent-ember"
        />
        <div className="mt-2 flex justify-between font-mono text-[11px] text-paper-dim">
          <span>{countRange.min} clip</span>
          <span>{countRange.max} clips</span>
        </div>

        <p className="mt-4 text-xs text-paper-dim">
          Based on the selected length, up to {countRange.max} non-overlapping clips make sense here.
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
          onClick={() => onConfirm(count, useRange ? { start: rangeStart, end: rangeEnd } : undefined)}
          className="flex-1 rounded-full bg-ember py-3 text-sm font-semibold text-ink transition hover:brightness-110"
        >
          Clip it
        </button>
      </div>
    </motion.div>
  );
}
