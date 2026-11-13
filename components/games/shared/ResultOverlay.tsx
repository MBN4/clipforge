"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

export type Outcome = "win" | "loss" | "draw";

const TONE: Record<Outcome, { ring: string; glow: string; label: string }> = {
  win: { ring: "border-moss/50", glow: "from-moss/25", label: "text-moss" },
  loss: { ring: "border-red-400/40", glow: "from-red-400/20", label: "text-red-300" },
  draw: { ring: "border-white/25", glow: "from-white/10", label: "text-paper" },
};

/**
 * The end-of-game card every game shows: a clear WIN / LOSS / DRAW headline, the
 * reason, a few stat lines (high scores, streaks) and action buttons.
 * Render it inside a `relative` container; it covers that container.
 */
export function ResultOverlay({
  open,
  outcome,
  title,
  reason,
  stats,
  children,
  newBest,
  kicker,
}: {
  open: boolean;
  outcome: Outcome;
  /** e.g. "You won!" / "You lost" / "Draw" */
  title: string;
  /** e.g. "Checkmate" / "Black ran out of time" */
  reason?: string;
  stats?: { label: string; value: ReactNode }[];
  /** the buttons (Rematch, New game…) */
  children?: ReactNode;
  newBest?: boolean;
  /** overrides the small label above the title (default Victory / Defeat / Draw), e.g. "Game over" for score games */
  kicker?: string;
}) {
  const t = TONE[outcome];
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="absolute inset-0 z-30 flex items-center justify-center rounded-[inherit] bg-ink/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-live="polite"
          aria-label={title}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.08 }}
            className={`relative w-full max-w-xs overflow-hidden rounded-3xl border bg-ink-2 p-6 text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] ${t.ring}`}
          >
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${t.glow} to-transparent`} aria-hidden />
            <p className={`relative font-mono text-[10px] uppercase tracking-[0.3em] ${t.label}`}>{kicker ?? (outcome === "win" ? "Victory" : outcome === "loss" ? "Defeat" : "Draw")}</p>
            <h3 className="relative mt-2 font-display text-3xl font-semibold tracking-tight text-paper">{title}</h3>
            {reason && <p className="relative mt-1.5 text-sm text-paper-dim">{reason}</p>}
            {newBest && (
              <p className="relative mx-auto mt-3 inline-block rounded-full bg-ember px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink">New personal best</p>
            )}
            {stats && stats.length > 0 && (
              <dl className="relative mt-5 grid grid-cols-2 gap-2 text-left">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-xl border border-line-strong bg-ink/60 px-3 py-2">
                    <dt className="font-mono text-[9px] uppercase tracking-widest text-paper-dim">{s.label}</dt>
                    <dd className="mt-0.5 font-display text-lg font-semibold tabular-nums text-paper">{s.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {children && <div className="relative mt-5 flex flex-col gap-2">{children}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function GameButton({
  children,
  onClick,
  variant = "secondary",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  className?: string;
}) {
  const v = {
    primary: "bg-ember text-ink hover:brightness-110 shadow-[0_8px_30px_-10px_var(--ember)]",
    secondary: "border border-line-strong bg-white/[0.04] text-paper hover:border-white/35 hover:bg-white/[0.08]",
    ghost: "text-paper-dim hover:text-paper",
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${v} ${className}`}
    >
      {children}
    </button>
  );
}

/** Pill-style segmented control used for modes, difficulty, player counts… */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  size = "md",
}: {
  value: T;
  options: { value: T; label: ReactNode; hint?: string }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex max-w-full flex-wrap rounded-full border border-line-strong bg-ink-3 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          title={o.hint}
          onClick={() => onChange(o.value)}
          className={`rounded-full font-semibold transition ${size === "sm" ? "px-3 py-1 text-[11px]" : "px-4 py-1.5 text-xs"} ${
            value === o.value ? "bg-paper text-ink" : "text-paper-dim hover:text-paper"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
