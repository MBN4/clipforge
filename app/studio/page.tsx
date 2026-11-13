"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Clapperboard, Film, Gauge, Layers, Plus, Sparkles, Zap } from "lucide-react";
import { useDashboard } from "@/components/studio/DashboardProvider";
import { JobRow } from "@/components/studio/JobCard";
import { Card, EmptyState, PageHeader, StatTile, StatusPill, Thumb, useNow } from "@/components/studio/ui";
import { fmtAgo, fmtDur, fmtSpeed, isActive, jobTitle, totalsOf } from "@/lib/dashboard";

function Skeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-2xl border border-line bg-ink-2/60" />
      ))}
    </div>
  );
}

export default function OverviewPage() {
  const { jobs, system, loaded } = useDashboard();
  const active = jobs.filter(isActive);
  const now = useNow(active.length > 0);
  const t = totalsOf(jobs, now);

  const recentClips = jobs
    .filter((j) => j.stage === "done")
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))
    .flatMap((j) => j.clips.map((c) => ({ clip: c, job: j })))
    .slice(0, 10);
  const recentVideos = jobs.slice(0, 5);
  const compute = system ? Math.round((system.compute.used / system.compute.capacity) * 100) : 0;

  return (
    <>
      <PageHeader title="Overview" subtitle="Everything you're clipping, in one place.">
        <Link href="/studio/new" className="inline-flex items-center gap-2 rounded-full bg-ember px-5 py-2.5 text-sm font-semibold text-ink shadow-[0_10px_40px_-12px_var(--ember)] transition hover:brightness-110">
          <Plus className="h-4 w-4" /> New project
        </Link>
      </PageHeader>

      {!loaded ? (
        <Skeleton />
      ) : jobs.length === 0 ? (
        <EmptyState icon={Sparkles} title="Your studio is empty" body="Add one video or twenty — Clipforge clips them all in parallel and keeps every one tracked here.">
          <Link href="/studio/new" className="inline-flex items-center gap-2 rounded-full bg-ember px-6 py-3 text-sm font-semibold text-ink transition hover:brightness-110">
            Start your first batch <ArrowRight className="h-4 w-4" />
          </Link>
        </EmptyState>
      ) : (
        <div className="space-y-8">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Videos" icon={Film} value={t.videos} sub={`${t.done} finished${t.failed ? ` · ${t.failed} failed` : ""}`} />
            <StatTile label="Clips created" icon={Clapperboard} value={t.clips} sub={t.footageSec ? `from ${fmtDur(t.footageSec)} of footage` : "none yet"} />
            <StatTile label="In progress" icon={Layers} value={t.active} accent={t.active > 0} sub={t.active ? `${t.waiting} waiting in line` : "all caught up"} />
            <StatTile label="Avg speed" icon={Zap} value={fmtSpeed(t.avgSpeed)} sub={t.bestSpeed ? `realtime · best ${fmtSpeed(t.bestSpeed)}` : "realtime — after your first video"} />
          </motion.div>

          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-paper">Live activity</h2>
                <Link href="/studio/queue" className="inline-flex items-center gap-1 text-xs text-paper-dim transition hover:text-paper">
                  Open queue <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {active.length === 0 ? (
                <p className="py-10 text-center text-sm text-paper-dim">Nothing processing right now.</p>
              ) : (
                <div className="space-y-1">
                  {active
                    .sort((a, b) => a.createdAt - b.createdAt)
                    .slice(0, 4)
                    .map((j) => (
                      <JobRow key={j.id} job={j} />
                    ))}
                  {active.length > 4 && <p className="px-2 pt-2 text-xs text-paper-dim">+ {active.length - 4} more in the queue</p>}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-paper">Throughput</h2>
                <Gauge className="h-4 w-4 text-paper-dim" strokeWidth={1.75} />
              </div>
              <dl className="space-y-3.5 text-sm">
                {[
                  ["Compute load", system ? `${compute}%` : "—"],
                  ["Cores", system ? String(system.cpus) : "—"],
                  ["Downloads", system ? `${system.downloads.active} / ${system.downloads.limit}` : "—"],
                  ["Avg time per video", t.avgWorkSec ? fmtDur(t.avgWorkSec) : "—"],
                  ["Clips per minute", t.clipsPerMin ? t.clipsPerMin.toFixed(1) : "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between border-b border-line/70 pb-3 last:border-0 last:pb-0">
                    <dt className="text-paper-dim">{k}</dt>
                    <dd className="font-mono tabular-nums text-paper">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </div>

          {recentClips.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-paper">Latest clips</h2>
                <Link href="/studio/library" className="inline-flex items-center gap-1 text-xs text-paper-dim transition hover:text-paper">
                  View library <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
                {recentClips.map(({ clip, job }) => (
                  <Link
                    key={clip.id}
                    href={`/editor/${job.id}/${clip.index}`}
                    className="group relative aspect-[9/16] w-32 shrink-0 overflow-hidden rounded-xl border border-line-strong bg-ink-3 transition hover:border-ember sm:w-36"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={clip.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2.5 pt-8">
                      <p className="line-clamp-2 text-[11px] font-medium leading-snug text-paper">{clip.title}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-paper">Recent videos</h2>
              <Link href="/studio/activity" className="inline-flex items-center gap-1 text-xs text-paper-dim transition hover:text-paper">
                All activity <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <Card className="divide-y divide-line/70">
              {recentVideos.map((j) => (
                <div key={j.id} className="flex items-center gap-4 p-3 sm:p-4">
                  <Thumb job={j} className="h-12 w-20" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-paper">{jobTitle(j)}</p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-paper-dim">
                      {fmtAgo(j.createdAt, now)}
                      {j.stage === "done" ? ` · ${j.clips.length} clips` : ""}
                    </p>
                  </div>
                  <StatusPill job={j} />
                  {j.stage === "done" && (
                    <Link href={`/studio/library?job=${j.id}`} className="hidden rounded-lg border border-line-strong px-3 py-1.5 text-xs font-semibold text-paper-dim transition hover:border-ember hover:text-ember sm:block">
                      View clips
                    </Link>
                  )}
                </div>
              ))}
            </Card>
          </section>
        </div>
      )}
    </>
  );
}
