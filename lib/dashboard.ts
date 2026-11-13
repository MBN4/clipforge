// Pure helpers for the studio dashboard: stage metadata, formatting and the
// speed metrics derived from each job's timings.
import type { ClientJob } from "./serialize";
import type { JobStage } from "./types";

export const ACTIVE_STAGES: JobStage[] = ["queued", "downloading", "transcribing", "analyzing", "rendering"];
export const isActive = (j: Pick<ClientJob, "stage">) => ACTIVE_STAGES.includes(j.stage);

/** The four working stages, in order. Colours are the validated dark categorical slots 1–4. */
export const PIPELINE = [
  { key: "downloading", short: "Fetch", label: "Fetching", color: "#3987e5" },
  { key: "transcribing", short: "Listen", label: "Listening", color: "#d95926" },
  { key: "analyzing", short: "Find", label: "Finding moments", color: "#199e70" },
  { key: "rendering", short: "Cut", label: "Cutting clips", color: "#c98500" },
] as const;

export function stageIndex(stage: JobStage): number {
  return PIPELINE.findIndex((s) => s.key === stage);
}

export type Tone = "active" | "wait" | "done" | "fail" | "idle";

export function statusOf(job: ClientJob): { label: string; tone: Tone } {
  if (job.stage === "done") return { label: "Done", tone: "done" };
  if (job.stage === "error") return { label: "Failed", tone: "fail" };
  if (job.stage === "cancelled") return { label: "Cancelled", tone: "idle" };
  if (job.waiting || job.stage === "queued") return { label: "In line", tone: "wait" };
  const s = PIPELINE.find((p) => p.key === job.stage);
  return { label: s?.label ?? "Working", tone: "active" };
}

export function fmtDur(sec: number | undefined | null): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return "—";
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(r).padStart(2, "0")}s`;
  return `${r}s`;
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function fmtAgo(ts: number, now: number): string {
  const d = Math.max(0, Math.round((now - ts) / 1000));
  if (d < 45) return "just now";
  if (d < 3600) return `${Math.round(d / 60)}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  return `${Math.round(d / 86400)}d ago`;
}

export function fmtSpeed(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return "—";
  return x >= 10 ? `${Math.round(x)}×` : `${x.toFixed(1)}×`;
}

export const jobTitle = (j: ClientJob) => j.title || j.source.filename || j.source.url?.replace(/^https?:\/\/(www\.)?/, "") || "Untitled video";

/** Seconds the job has really been working: wall time minus time spent waiting in line. */
export function activeSeconds(job: ClientJob, now: number): number | null {
  if (!job.startedAt) return null;
  const end = job.finishedAt ?? now;
  return Math.max(0, (end - job.startedAt - (job.waitedMs ?? 0)) / 1000);
}

/** How many seconds of source video were processed per second of work (×realtime). */
export function speedX(job: ClientJob, now: number): number | null {
  if (job.stage !== "done" || !job.sourceDuration) return null;
  const a = activeSeconds(job, now);
  return a && a > 0 ? job.sourceDuration / a : null;
}

export function etaSeconds(job: ClientJob, now: number): number | null {
  if (!isActive(job) || job.waiting || job.progress < 20 || job.progress >= 99) return null;
  const a = activeSeconds(job, now);
  if (!a || a < 4) return null;
  return (a / job.progress) * (100 - job.progress);
}

export function stageBreakdown(job: ClientJob) {
  const t = job.timings ?? {};
  return PIPELINE.map((p) => ({ ...p, ms: t[p.key] ?? 0 }));
}

export interface Totals {
  videos: number;
  done: number;
  active: number;
  waiting: number;
  failed: number;
  clips: number;
  footageSec: number;
  avgSpeed: number | null;
  bestSpeed: number | null;
  avgWorkSec: number | null;
  clipsPerMin: number | null;
}

export function totalsOf(jobs: ClientJob[], now: number): Totals {
  const done = jobs.filter((j) => j.stage === "done");
  const speeds = done.map((j) => speedX(j, now)).filter((x): x is number => x != null);
  const work = done.map((j) => activeSeconds(j, now)).filter((x): x is number => x != null && x > 0);
  const workTotal = work.reduce((a, b) => a + b, 0);
  const clips = done.reduce((a, j) => a + j.clips.length, 0);
  return {
    videos: jobs.length,
    done: done.length,
    active: jobs.filter(isActive).length,
    waiting: jobs.filter((j) => isActive(j) && (j.waiting || j.stage === "queued")).length,
    failed: jobs.filter((j) => j.stage === "error").length,
    clips,
    footageSec: done.reduce((a, j) => a + (j.sourceDuration ?? 0), 0),
    avgSpeed: speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null,
    bestSpeed: speeds.length ? Math.max(...speeds) : null,
    avgWorkSec: work.length ? workTotal / work.length : null,
    clipsPerMin: workTotal > 0 ? (clips / workTotal) * 60 : null,
  };
}
