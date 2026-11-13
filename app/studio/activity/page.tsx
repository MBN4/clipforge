"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, Gauge, Plus, RotateCcw, Timer, Trash, Video, X, Zap } from "lucide-react";
import { useDashboard } from "@/components/studio/DashboardProvider";
import { SpeedChart, TimeSplit } from "@/components/studio/SpeedChart";
import { sourceLabel } from "@/components/studio/JobCard";
import { Card, ConfirmButton, EmptyState, PageHeader, StatTile, StatusPill, Thumb, useNow } from "@/components/studio/ui";
import { activeSeconds, fmtAgo, fmtDur, fmtSpeed, isActive, jobTitle, speedX, stageBreakdown, totalsOf } from "@/lib/dashboard";
import type { ClientJob } from "@/lib/serialize";

type Filter = "all" | "active" | "done" | "failed";

const matches: Record<Filter, (j: ClientJob) => boolean> = {
  all: () => true,
  active: isActive,
  done: (j) => j.stage === "done",
  failed: (j) => j.stage === "error" || j.stage === "cancelled",
};

function MiniSplit({ job }: { job: ClientJob }) {
  const parts = stageBreakdown(job).filter((p) => p.ms > 0);
  if (!parts.length) return <span className="text-paper-dim/50">—</span>;
  return (
    <div className="flex h-2 w-full gap-[2px]" role="img" aria-label={parts.map((p) => `${p.label} ${fmtDur(p.ms / 1000)}`).join(", ")}>
      {parts.map((p) => (
        <span key={p.key} title={`${p.label}: ${fmtDur(p.ms / 1000)}`} className="first:rounded-l-full last:rounded-r-full" style={{ flex: p.ms, background: p.color, minWidth: 3 }} />
      ))}
    </div>
  );
}

const COLS = "lg:grid-cols-[minmax(0,2.4fr)_112px_72px_56px_88px_64px_minmax(90px,1fr)_auto]";

export default function ActivityPage() {
  const { jobs, loaded, cancelJob, retryJob, removeJob } = useDashboard();
  const [filter, setFilter] = useState<Filter>("all");
  const now = useNow(jobs.some(isActive));
  const t = totalsOf(jobs, now);
  const rows = jobs.filter(matches[filter]);
  const counts = (Object.keys(matches) as Filter[]).reduce((o, f) => ({ ...o, [f]: jobs.filter(matches[f]).length }), {} as Record<Filter, number>);

  return (
    <>
      <PageHeader title="Activity" subtitle="Every video you've run, how fast it went, and where the time was spent.">
        <Link href="/studio/new" className="inline-flex items-center gap-2 rounded-full border border-line-strong px-5 py-2.5 text-sm font-semibold text-paper transition hover:border-white/35">
          <Plus className="h-4 w-4" /> New project
        </Link>
      </PageHeader>

      {!loaded ? (
        <div className="h-64 animate-pulse rounded-2xl border border-line bg-ink-2/60" />
      ) : jobs.length === 0 ? (
        <EmptyState icon={Activity} title="No activity yet" body="Run a video and its timings, speed and history will be tracked here.">
          <Link href="/studio/new" className="inline-flex items-center gap-2 rounded-full bg-ember px-6 py-3 text-sm font-semibold text-ink transition hover:brightness-110">
            Add videos
          </Link>
        </EmptyState>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Avg speed" icon={Zap} accent value={fmtSpeed(t.avgSpeed)} sub="realtime across finished videos" />
            <StatTile label="Best run" icon={Gauge} value={fmtSpeed(t.bestSpeed)} sub="your fastest video" />
            <StatTile label="Avg time" icon={Timer} value={t.avgWorkSec ? fmtDur(t.avgWorkSec) : "—"} sub="of work per video" />
            <StatTile label="Footage" icon={Video} value={t.footageSec ? fmtDur(t.footageSec) : "—"} sub={`${t.clips} clips produced`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SpeedChart jobs={jobs} now={now} />
            <TimeSplit jobs={jobs} />
          </div>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-paper">All videos</h2>
              <div className="inline-flex rounded-full border border-line-strong bg-ink-2 p-0.5 text-xs">
                {(["all", "active", "done", "failed"] as const).map((f) => (
                  <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3.5 py-1.5 font-semibold capitalize transition ${filter === f ? "bg-paper text-ink" : "text-paper-dim hover:text-paper"}`}>
                    {f} <span className="ml-0.5 tabular-nums opacity-60">{counts[f]}</span>
                  </button>
                ))}
              </div>
            </div>

            <Card className="overflow-hidden">
              <div className={`hidden gap-4 border-b border-line px-5 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-paper-dim lg:grid ${COLS}`}>
                <span>Video</span>
                <span>Status</span>
                <span>Length</span>
                <span>Clips</span>
                <span>Work time</span>
                <span>Speed</span>
                <span>Time split</span>
                <span className="w-32 text-right">Actions</span>
              </div>

              {rows.length === 0 ? (
                <p className="py-14 text-center text-sm text-paper-dim">No videos in this view.</p>
              ) : (
                <ul className="divide-y divide-line/70">
                  {rows.map((j) => {
                    const work = activeSeconds(j, now);
                    return (
                      <li key={j.id} className={`grid items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-5 ${COLS}`}>
                        <div className="flex min-w-0 items-center gap-3">
                          <Thumb job={j} className="h-11 w-[72px]" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-paper" title={jobTitle(j)}>
                              {jobTitle(j)}
                            </p>
                            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-paper-dim">
                              {sourceLabel(j)} · {fmtAgo(j.createdAt, now)}
                            </p>
                          </div>
                        </div>
                        <div>
                          <StatusPill job={j} />
                        </div>
                        <Stat label="Length" value={j.sourceDuration ? fmtDur(j.sourceDuration) : "—"} />
                        <Stat label="Clips" value={j.stage === "done" ? String(j.clips.length) : "—"} />
                        <Stat label="Work time" value={work != null ? fmtDur(work) : "—"} />
                        <Stat label="Speed" value={fmtSpeed(speedX(j, now))} strong />
                        <div className="col-span-2 sm:col-span-1">
                          <MiniSplit job={j} />
                        </div>
                        <div className="flex w-full flex-wrap items-center gap-1.5 lg:w-32 lg:justify-end">
                          {j.stage === "done" && (
                            <Link href={`/studio/library?job=${j.id}`} className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-semibold text-paper-dim transition hover:border-ember hover:text-ember">
                              Clips
                            </Link>
                          )}
                          {(j.stage === "error" || j.stage === "cancelled") && (
                            <button onClick={() => retryJob(j.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-xs font-semibold text-paper-dim transition hover:border-ember hover:text-ember">
                              <RotateCcw className="h-3.5 w-3.5" /> Retry
                            </button>
                          )}
                          {isActive(j) ? (
                            <ConfirmButton label="Cancel" confirmLabel="Stop?" icon={X} onConfirm={() => cancelJob(j.id)} />
                          ) : (
                            <ConfirmButton label="" confirmLabel="Delete?" icon={Trash} title="Delete this video and its clips" onConfirm={() => removeJob(j.id)} />
                          )}
                        </div>
                        {j.stage === "error" && j.error && <p className="col-span-full text-xs text-red-300/90">{j.error}</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </section>
        </div>
      )}
    </>
  );
}

/** A table cell on desktop; a labelled value on mobile. */
function Stat({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="text-sm tabular-nums">
      <span className="mr-2 font-mono text-[10px] uppercase tracking-wider text-paper-dim lg:hidden">{label}</span>
      <span className={strong ? "font-semibold text-paper" : "text-paper-dim"}>{value}</span>
    </div>
  );
}
