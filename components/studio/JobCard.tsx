"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Clock, Hourglass, Link2, Upload, X } from "lucide-react";
import { activeSeconds, etaSeconds, fmtClock, fmtDur, jobTitle, statusOf, isActive } from "@/lib/dashboard";
import type { ClientJob } from "@/lib/serialize";
import { Card, ConfirmButton, ProgressBar, StageSteps, StatusPill, Thumb } from "./ui";

function Chip({ children, icon: Icon }: { children: React.ReactNode; icon?: typeof Clock }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.05] px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-paper-dim">
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}

export function sourceLabel(job: ClientJob) {
  return job.source.type === "upload" ? "Upload" : (job.source.platform ?? "Link");
}

/** Full live card for the Queue tab. */
export function JobCard({ job, now, line, onCancel }: { job: ClientJob; now: number; line?: number; onCancel: () => void }) {
  const { tone } = statusOf(job);
  const work = activeSeconds(job, now);
  const eta = etaSeconds(job, now);
  const waitingSecs = job.waiting || job.stage === "queued" ? Math.max(0, (now - job.createdAt) / 1000) : null;

  return (
    <motion.div layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.35 }}>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-5 p-4 sm:flex-row sm:p-5">
          <Thumb job={job} className="h-28 w-full sm:aspect-video sm:h-auto sm:w-44 lg:w-52" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-display text-lg font-semibold tracking-tight text-paper" title={jobTitle(job)}>
                  {jobTitle(job)}
                </h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Chip icon={job.source.type === "upload" ? Upload : Link2}>{sourceLabel(job)}</Chip>
                  {job.sourceDuration ? <Chip icon={Clock}>{fmtDur(job.sourceDuration)} source</Chip> : null}
                  {job.request?.clipCount ? <Chip>{job.request.clipCount} clips</Chip> : null}
                  {line != null && line > 0 && <Chip icon={Hourglass}>#{line + 1} in line</Chip>}
                </div>
              </div>
              <StatusPill job={job} />
            </div>

            <div className="mt-5">
              <StageSteps job={job} />
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-mono text-paper-dim">{job.message}</span>
                <span className="shrink-0 font-mono tabular-nums text-paper">{Math.round(job.progress)}%</span>
              </div>
              <ProgressBar value={job.progress} tone={tone} />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-paper-dim">
                {waitingSecs != null ? (
                  <span>
                    Waiting <span className="tabular-nums text-paper">{fmtClock(waitingSecs)}</span>
                  </span>
                ) : (
                  <>
                    <span>
                      Working <span className="tabular-nums text-paper">{work != null ? fmtClock(work) : "0:00"}</span>
                    </span>
                    <span>
                      ETA <span className="tabular-nums text-paper">{eta != null ? `~${fmtDur(eta)}` : "estimating…"}</span>
                    </span>
                  </>
                )}
              </div>
              {isActive(job) && <ConfirmButton label="Cancel" confirmLabel="Stop this video?" icon={X} onConfirm={onCancel} />}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

/** Compact row for the Overview tab. */
export function JobRow({ job }: { job: ClientJob }) {
  const { tone } = statusOf(job);
  return (
    <Link href="/studio/queue" className="group flex items-center gap-3 rounded-xl p-2 transition hover:bg-white/[0.04]">
      <Thumb job={job} className="h-11 w-[78px]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-paper">{jobTitle(job)}</p>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-paper-dim">{Math.round(job.progress)}%</span>
        </div>
        <div className="mt-1.5">
          <ProgressBar value={job.progress} tone={tone} />
        </div>
        <p className="mt-1.5 truncate font-mono text-[10px] uppercase tracking-wider text-paper-dim">{job.message}</p>
      </div>
    </Link>
  );
}
