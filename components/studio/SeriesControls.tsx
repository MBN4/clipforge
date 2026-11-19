"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { FastForward, Loader, Play, Scissors, Square } from "lucide-react";
import { useDashboard } from "./DashboardProvider";
import { fmtDur } from "@/lib/dashboard";
import { fmtTimestamp } from "@/lib/clipCount";
import { latestParts, parseClock, summarize } from "@/lib/seriesClient";
import type { ClientJob } from "@/lib/serialize";

/** What to do with a long video that is clipped in parts: continue, skip part of it, or stop. */
export function SeriesControls({ job, variant }: { job: ClientJob; variant: "prompt" | "held" }) {
  const { jobs, seriesAction } = useDashboard();
  const s = job.series!;
  const sum = useMemo(() => summarize(jobs, s.id), [jobs, s.id]);
  const [skipOpen, setSkipOpen] = useState(false);
  const [from, setFrom] = useState(fmtTimestamp(s.cursor));
  const [to, setTo] = useState(fmtTimestamp(Math.min(s.videoEnd, s.cursor + 1800)));
  const [busy, setBusy] = useState<"continue" | "skip" | "stop" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nextLen = Math.min(s.batchSec, sum.remaining);

  async function run(kind: "continue" | "skip" | "stop") {
    setError(null);
    if (kind === "skip") {
      const a = parseClock(from);
      const b = parseClock(to);
      if (a == null || b == null) return setError("Enter times like 1:25:00 or 45:30.");
      if (b <= a) return setError("The end has to be after the start.");
      if (b <= s.cursor) return setError(`That part is already clipped — use a time after ${fmtTimestamp(s.cursor)}.`);
      if (a >= s.videoEnd) return setError(`The video ends at ${fmtTimestamp(s.videoEnd)}.`);
    }
    setBusy(kind);
    const ok =
      kind === "stop"
        ? await seriesAction(job.id, { action: "stop" })
        : kind === "skip"
          ? await seriesAction(job.id, { action: "continue", skip: { start: parseClock(from)!, end: parseClock(to)! } })
          : await seriesAction(job.id, { action: "continue" });
    setBusy(null);
    if (ok) setSkipOpen(false);
  }

  const heading =
    variant === "prompt" ? `${fmtDur(s.batchSec)} clipped — keep going?` : "Clipping is paused";
  const body =
    variant === "prompt"
      ? `${s.baseTitle}: ${sum.doneParts} parts (${fmtTimestamp(sum.from)} – ${fmtTimestamp(s.cursor)} of ${fmtTimestamp(s.videoEnd)}) are in your Library. ${fmtDur(sum.remaining)} of the video is left.`
      : `${s.baseTitle}: stopped after part ${sum.parts} (up to ${fmtTimestamp(s.cursor)} of ${fmtTimestamp(s.videoEnd)}). ${fmtDur(sum.remaining)} is left.`;

  return (
    <div className="rounded-2xl border border-ember/40 bg-ember/[0.07] p-4 sm:p-5" role="status">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base font-semibold text-paper">{heading}</p>
          <p className="mt-1 text-sm leading-relaxed text-paper-dim">{body}</p>
        </div>
        <Link href={`/studio/library?job=${job.id}`} className="shrink-0 text-xs font-semibold text-ember-soft transition hover:text-ember">
          View latest clips →
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => run("continue")}
          disabled={!!busy || sum.remaining <= 0}
          className="inline-flex items-center gap-2 rounded-full bg-ember px-5 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-50"
        >
          {busy === "continue" ? <Loader className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Continue next {fmtDur(nextLen)}
        </button>
        <button
          onClick={() => setSkipOpen((o) => !o)}
          disabled={!!busy}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
            skipOpen ? "border-ember text-ember" : "border-line-strong text-paper hover:border-white/35"
          }`}
        >
          <FastForward className="h-4 w-4" /> Skip a part…
        </button>
        {variant === "prompt" && (
          <button
            onClick={() => run("stop")}
            disabled={!!busy}
            className="inline-flex items-center gap-2 rounded-full px-3 py-2.5 text-sm text-paper-dim transition hover:text-paper disabled:opacity-50"
          >
            <Square className="h-3.5 w-3.5" /> Stop here
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {skipOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-4 rounded-xl border border-line-strong bg-ink/60 p-3.5">
              <p className="text-xs text-paper-dim">
                Don&apos;t clip this stretch of the video. Clipping carries on from the end of it (the video is {fmtTimestamp(s.videoEnd)} long).
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="block">
                  <span className="text-[11px] text-paper-dim">Skip from</span>
                  <input
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    placeholder="1:25:00"
                    className="mt-1 block w-28 rounded-lg border border-line-strong bg-ink-3 px-3 py-2 font-mono text-sm text-paper outline-none focus:border-ember"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] text-paper-dim">to</span>
                  <input
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="2:30:00"
                    className="mt-1 block w-28 rounded-lg border border-line-strong bg-ink-3 px-3 py-2 font-mono text-sm text-paper outline-none focus:border-ember"
                  />
                </label>
                <button
                  onClick={() => run("skip")}
                  disabled={!!busy}
                  className="inline-flex items-center gap-2 rounded-full bg-paper px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-ember disabled:opacity-50"
                >
                  {busy === "skip" ? <Loader className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
                  Skip it &amp; continue
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    </div>
  );
}

/** Banners, on every studio page, for long videos waiting for the user to say whether to continue. */
export function SeriesPrompts() {
  const { jobs } = useDashboard();
  const waiting = [...latestParts(jobs).values()].filter((j) => j.series!.status === "paused" && j.series!.pausedFor === "batch" && j.stage === "done");
  if (!waiting.length) return null;
  return (
    <div className="mb-8 space-y-3">
      {waiting.map((j) => (
        <SeriesControls key={j.series!.id} job={j} variant="prompt" />
      ))}
    </div>
  );
}
