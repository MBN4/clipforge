"use client";

import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { ArrowRight, Cpu, Plus, RotateCcw, Rows3 } from "lucide-react";
import { useDashboard } from "@/components/studio/DashboardProvider";
import { JobCard } from "@/components/studio/JobCard";
import { Card, EmptyState, Label, PageHeader, StatusPill, Thumb, useNow } from "@/components/studio/ui";
import { ProcessingAmbience } from "@/components/studio/ProcessingAmbience";
import { TipTicker } from "@/components/studio/TipTicker";
import { GameHub } from "@/components/games/GameHub";
import { fmtAgo, isActive, jobTitle } from "@/lib/dashboard";

export default function QueuePage() {
  const { jobs, system, loaded, cancelJob, retryJob } = useDashboard();
  // earliest submitted first: that is also the order the scheduler serves them in
  const active = jobs.filter(isActive).sort((a, b) => a.createdAt - b.createdAt);
  const finished = jobs
    .filter((j) => !isActive(j))
    .sort((a, b) => (b.finishedAt ?? b.updatedAt) - (a.finishedAt ?? a.updatedAt))
    .slice(0, 5);
  const now = useNow(true);
  const waitingIds = active.filter((j) => j.waiting || j.stage === "queued").map((j) => j.id);
  const working = active.length - waitingIds.length;

  return (
    <>
      {active.length > 0 && <ProcessingAmbience />}
      <PageHeader title="Queue" subtitle="Every video that's being processed right now, with live progress.">
        <Link href="/studio/new" className="inline-flex items-center gap-2 rounded-full border border-line-strong px-5 py-2.5 text-sm font-semibold text-paper transition hover:border-white/35">
          <Plus className="h-4 w-4" /> Add videos
        </Link>
      </PageHeader>

      {system && (
        <Card className="mb-6 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-6 font-mono text-[11px] text-paper-dim">
            <span>
              <span className="font-display text-2xl font-semibold tabular-nums text-paper">{working}</span> working
            </span>
            <span>
              <span className="font-display text-2xl font-semibold tabular-nums text-paper">{waitingIds.length}</span> in line
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-paper-dim">
            <Cpu className="h-4 w-4 shrink-0 text-ember" strokeWidth={1.75} />
            <p className="max-w-md leading-relaxed">
              Videos share <span className="text-paper">{system.cpus} cores</span> fairly, so every one keeps its full speed — extra videos wait their turn instead of slowing the rest down.
            </p>
          </div>
        </Card>
      )}

      {!loaded ? (
        <div className="h-56 animate-pulse rounded-2xl border border-line bg-ink-2/60" />
      ) : active.length === 0 ? (
        <EmptyState icon={Rows3} title="Nothing in the queue" body="Add a few videos and they'll show up here with live progress, speed and time remaining.">
          <Link href="/studio/new" className="inline-flex items-center gap-2 rounded-full bg-ember px-6 py-3 text-sm font-semibold text-ink transition hover:brightness-110">
            Add videos <ArrowRight className="h-4 w-4" />
          </Link>
        </EmptyState>
      ) : (
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {active.map((j) => (
              <JobCard key={j.id} job={j} now={now} line={waitingIds.indexOf(j.id)} onCancel={() => cancelJob(j.id)} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {finished.length > 0 && (
        <section className="mt-12">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-paper">Recently finished</h2>
            <Link href="/studio/activity" className="inline-flex items-center gap-1 text-xs text-paper-dim transition hover:text-paper">
              All activity <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <Card className="divide-y divide-line/70">
            {finished.map((j) => (
              <div key={j.id} className="flex items-center gap-4 p-3 sm:p-4">
                <Thumb job={j} className="h-12 w-20" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-paper">{jobTitle(j)}</p>
                  <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wider text-paper-dim">
                    {j.stage === "done" ? `${j.clips.length} clips · ` : j.stage === "error" ? `${j.error ?? "Failed"} · ` : ""}
                    {fmtAgo(j.finishedAt ?? j.updatedAt, now)}
                  </p>
                </div>
                <StatusPill job={j} />
                {j.stage === "done" ? (
                  <Link href={`/studio/library?job=${j.id}`} className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-semibold text-paper-dim transition hover:border-ember hover:text-ember">
                    View clips
                  </Link>
                ) : (
                  <button onClick={() => retryJob(j.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-xs font-semibold text-paper-dim transition hover:border-ember hover:text-ember">
                    <RotateCcw className="h-3.5 w-3.5" /> Retry
                  </button>
                )}
              </div>
            ))}
          </Card>
        </section>
      )}

      {active.length > 0 && (
        <section className="mt-14 space-y-8">
          <TipTicker />
          <div>
            <Label className="mb-4 block text-center">While you wait</Label>
            <div className="mx-auto max-w-2xl">
              <GameHub />
            </div>
          </div>
        </section>
      )}
    </>
  );
}
