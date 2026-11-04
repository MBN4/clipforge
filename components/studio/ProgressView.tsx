"use client";

import { motion } from "framer-motion";
import type { JobStage } from "@/lib/types";

const STAGES: { key: JobStage; label: string }[] = [
  { key: "downloading", label: "Fetching" },
  { key: "transcribing", label: "Listening" },
  { key: "analyzing", label: "Finding moments" },
  { key: "rendering", label: "Cutting clips" },
];

function stageIndex(stage: JobStage) {
  return STAGES.findIndex((s) => s.key === stage);
}

export function ProgressView({
  stage,
  progress,
  message,
}: {
  stage: JobStage;
  progress: number;
  message: string;
}) {
  const current = stageIndex(stage);

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-8 flex items-center justify-between">
        {STAGES.map((s, i) => {
          const done = current > i || stage === "done";
          const active = current === i;
          return (
            <div key={s.key} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-2">
                <motion.div
                  animate={{
                    scale: active ? 1.15 : 1,
                    backgroundColor: done || active ? "var(--ember)" : "var(--ink-3)",
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-line-strong text-xs font-mono text-ink"
                >
                  {done ? "✓" : i + 1}
                </motion.div>
                <span
                  className={`text-center text-[11px] font-medium ${
                    active ? "text-paper" : "text-paper-dim"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <div className="mx-1 h-px flex-1 bg-line-strong">
                  <motion.div
                    className="h-px bg-ember"
                    animate={{ width: current > i ? "100%" : "0%" }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-ink-2">
        <motion.div
          className="h-full rounded-full bg-ember"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
      <p className="mt-4 text-center font-mono text-sm text-paper-dim">{message}</p>
    </div>
  );
}
