"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Check, Film, Hourglass, type LucideIcon } from "lucide-react";
import { PIPELINE, stageIndex, statusOf, type Tone } from "@/lib/dashboard";
import type { ClientJob } from "@/lib/serialize";

/** A clock that ticks once a second while `on`, for live elapsed timers. */
export function useNow(on = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [on]);
  return now;
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl border border-line-strong bg-ink-2/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${className}`}>
      {children}
    </div>
  );
}

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-[10px] uppercase tracking-[0.2em] text-paper-dim ${className}`}>{children}</span>;
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] text-paper md:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-xl text-sm text-paper-dim">{subtitle}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

const TONE: Record<Tone, string> = {
  active: "border-ember/40 bg-ember/10 text-ember-soft",
  wait: "border-white/15 bg-white/[0.05] text-paper",
  done: "border-moss/30 bg-moss/10 text-moss",
  fail: "border-red-400/30 bg-red-400/10 text-red-300",
  idle: "border-line-strong bg-white/[0.03] text-paper-dim",
};
const DOT: Record<Tone, string> = {
  active: "bg-ember",
  wait: "bg-paper-dim",
  done: "bg-moss",
  fail: "bg-red-400",
  idle: "bg-paper-dim/60",
};

export function StatusPill({ job }: { job: ClientJob }) {
  const { label, tone } = statusOf(job);
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${TONE[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]} ${tone === "active" ? "pulse-dot" : ""}`} />
      {label}
    </span>
  );
}

export function Thumb({ job, className = "" }: { job: ClientJob; className?: string }) {
  const [failed, setFailed] = useState(0);
  // the source frame first, then the first clip's frame if that can't load
  const srcs = [job.thumbnail, job.clips[0]?.thumbUrl].filter((s): s is string => !!s);
  const src = srcs[failed];
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-ink-3 to-ink ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" onError={() => setFailed((f) => f + 1)} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-paper-dim/50">
          <Film className="h-1/3 w-1/3 min-h-4 min-w-4" strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}

export function ProgressBar({ value, tone = "active" }: { value: number; tone?: Tone }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
      <motion.div
        className={`h-full rounded-full ${tone === "done" ? "bg-moss" : tone === "fail" ? "bg-red-400" : "bg-gradient-to-r from-ember to-ember-soft"}`}
        initial={false}
        animate={{ width: `${Math.max(2, Math.min(100, value))}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}

/** Four-step tracker: Fetch → Listen → Find → Cut. */
export function StageSteps({ job }: { job: ClientJob }) {
  const current = job.stage === "done" ? PIPELINE.length : Math.max(0, stageIndex(job.stage));
  const queuedOnly = job.stage === "queued";
  return (
    <ol className="flex items-start">
      {PIPELINE.map((s, i) => {
        const done = i < current;
        const active = i === current && !queuedOnly;
        const waiting = active && job.waiting;
        return (
          <li key={s.key} className="flex flex-1 items-start last:flex-none">
            <div className="flex w-14 flex-col items-center gap-1.5">
              <div className="relative">
                {active && !waiting && (
                  <motion.span
                    className="absolute inset-0 rounded-full bg-ember"
                    animate={{ scale: [1, 1.9], opacity: [0.45, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                  />
                )}
                <span
                  className={`relative flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-mono transition-colors ${
                    done
                      ? "border-moss bg-moss text-ink"
                      : waiting
                        ? "border-dashed border-ember/70 bg-ink-3 text-ember-soft"
                        : active
                          ? "border-ember bg-ember text-ink"
                          : "border-line-strong bg-ink-3 text-paper-dim"
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : waiting ? <Hourglass className="h-3 w-3" /> : i + 1}
                </span>
              </div>
              <span className={`font-mono text-[10px] uppercase tracking-wider ${active || done ? "text-paper" : "text-paper-dim/70"}`}>{s.short}</span>
            </div>
            {i < PIPELINE.length - 1 && (
              <div className="mt-[13px] h-px flex-1 bg-line-strong">
                <div className={`h-px bg-moss transition-all duration-500 ${done ? "w-full" : "w-0"}`} />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: LucideIcon;
  accent?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden p-5">
      {accent && <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-ember/20 blur-2xl" aria-hidden />}
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Icon className={`h-4 w-4 ${accent ? "text-ember" : "text-paper-dim"}`} strokeWidth={1.75} />
      </div>
      <div className="mt-3 font-display text-4xl font-semibold tabular-nums tracking-tight text-paper">{value}</div>
      {sub && <div className="mt-1 text-xs text-paper-dim">{sub}</div>}
    </Card>
  );
}

export function EmptyState({ icon: Icon, title, body, children }: { icon: LucideIcon; title: string; body: string; children?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-line-strong bg-ink-3 text-ember">
        <Icon className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <h3 className="font-display text-xl font-semibold text-paper">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-paper-dim">{body}</p>
      {children && <div className="mt-6">{children}</div>}
    </Card>
  );
}

/** Two-step button for actions that can't be undone: first click arms it, second confirms. */
export function ConfirmButton({
  label,
  confirmLabel = "Sure?",
  onConfirm,
  icon: Icon,
  className = "",
  title,
}: {
  label: string;
  confirmLabel?: string;
  onConfirm: () => void;
  icon?: LucideIcon;
  className?: string;
  title?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      title={title ?? label}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
        armed ? "border-red-400/60 bg-red-400/15 text-red-300" : "border-line-strong text-paper-dim hover:border-white/30 hover:text-paper"
      } ${className}`}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {armed ? confirmLabel : label}
    </button>
  );
}
