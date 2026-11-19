import { nanoid } from "nanoid";
import { createJob, getJob, listJobs, updateJob } from "./store";
import { ensureDir, jobDir } from "./paths";
import { isRunning } from "./scheduler";
import type { ClipMode, Job, SeriesInfo } from "./types";

// Long videos (a 9-hour stream) are clipped in consecutive 30-minute parts, each one an ordinary job.
// When a part finishes the next one starts by itself; after 2 hours of footage the series pauses and
// the user decides: continue, skip some of the video, or stop. All the shared series state lives in
// SeriesInfo, mirrored on every job of the series so any of them can be read on its own.

export type RunFn = (jobId: string, url: string, clipCount: number | undefined, range: { start: number; end: number }, mode: ClipMode) => void;

const MIN_PART = 20; // a leftover sliver shorter than this isn't worth a part

export function seriesJobs(seriesId: string): Job[] {
  return listJobs()
    .filter((j) => j.series?.id === seriesId)
    .sort((a, b) => (a.series?.index ?? 0) - (b.series?.index ?? 0));
}

/** Write shared series state onto every job of the series. */
export function updateSeries(seriesId: string, patch: Partial<SeriesInfo>) {
  for (const j of seriesJobs(seriesId)) updateJob(j.id, { series: { ...j.series!, ...patch } });
}

/** The next stretch to clip from `s.cursor`, honouring skipped ranges, or null at the end of the video. */
export function nextRange(s: Pick<SeriesInfo, "cursor" | "videoEnd" | "partSec" | "skipped">): { start: number; end: number } | null {
  const skipped = [...s.skipped].sort((a, b) => a.start - b.start);
  let start = s.cursor;
  for (let guard = 0; guard < 500; guard++) {
    for (const k of skipped) if (start >= k.start && start < k.end) start = k.end;
    if (start >= s.videoEnd - MIN_PART) return null;
    let end = Math.min(s.videoEnd, start + s.partSec);
    for (const k of skipped) if (k.start > start && k.start < end) end = k.start;
    // fold a tiny tail into this part rather than leaving a sliver
    if (s.videoEnd - end < MIN_PART && !skipped.some((k) => k.start >= end && k.start < s.videoEnd)) end = s.videoEnd;
    if (end - start >= MIN_PART) return { start, end };
    start = end; // too small (squeezed against a skipped range): move on
  }
  return null;
}

/** Create + start the next part of a series. Returns false when there's nothing left. */
export function startNextPart(seriesId: string, run: RunFn): boolean {
  const jobs = seriesJobs(seriesId);
  const last = jobs[jobs.length - 1];
  if (!last?.series || !last.source.url) return false;
  const s = last.series;
  const range = nextRange(s);
  if (!range) {
    updateSeries(seriesId, { status: "complete", cursor: s.videoEnd });
    return false;
  }
  const id = nanoid(10);
  ensureDir(jobDir(id));
  const index = s.index + 1;
  const series: SeriesInfo = { ...s, index, cursor: range.end, batchDone: s.batchDone + (range.end - range.start), status: "running", pausedFor: undefined };
  const job: Job = {
    id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    source: last.source,
    title: `${s.baseTitle} · Part ${index}`,
    thumbnail: last.thumbnail,
    sourceDuration: s.videoEnd,
    request: { clipCount: last.request?.clipCount, range, mode: last.request?.mode },
    stage: "queued",
    progress: 2,
    message: "Queued…",
    clips: [],
    series,
  };
  createJob(job);
  // keep every earlier part's copy of the shared state current
  updateSeries(seriesId, { cursor: series.cursor, batchDone: series.batchDone, status: "running", pausedFor: undefined });
  run(id, last.source.url, job.request?.clipCount, range, job.request?.mode ?? "auto");
  return true;
}

/** Called when a part has finished successfully: carry on, or pause for the user's decision. */
export function afterPartDone(jobId: string, run: RunFn) {
  const job = getJob(jobId);
  const s = job?.series;
  if (!job || !s) return;
  const fresh = seriesJobs(s.id).at(-1)?.series ?? s; // newest shared state
  if (fresh.status !== "running" || job.series!.index !== fresh.index) return; // stopped meanwhile / not the newest part
  if (!nextRange(fresh)) return void updateSeries(s.id, { status: "complete", cursor: fresh.videoEnd });
  if (fresh.batchDone >= fresh.batchSec) return void updateSeries(s.id, { status: "paused", pausedFor: "batch" });
  startNextPart(s.id, run);
}

/** A part failed or was cancelled: stop chaining until the user retries it or decides. */
export function onPartFailed(jobId: string, cancelled: boolean) {
  const s = getJob(jobId)?.series;
  if (!s) return;
  updateSeries(s.id, cancelled ? { status: "stopped" } : { status: "paused", pausedFor: "error" });
}

export type SeriesAction =
  | { action: "stop" }
  /** keep going: next batch of 2h, optionally skipping a range of the video first */
  | { action: "continue"; skip?: { start: number; end: number } };

/** Apply a user decision. Returns an error message, or null on success. */
export function applyAction(seriesId: string, act: SeriesAction, run: RunFn): string | null {
  const jobs = seriesJobs(seriesId);
  const last = jobs.at(-1);
  if (!last?.series) return "Series not found";
  const s = last.series;
  if (act.action === "stop") {
    updateSeries(seriesId, { status: "stopped" });
    return null;
  }
  let skipped = s.skipped;
  if (act.skip) {
    const { start, end } = act.skip;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return "That skip range isn't valid";
    if (start < s.cursor && end > s.cursor) {
      // a range that begins inside what's already been clipped just means "jump ahead to its end"
      skipped = [...skipped, { start: s.cursor, end: Math.min(end, s.videoEnd) }];
    } else if (end > s.cursor) {
      skipped = [...skipped, { start: Math.max(start, s.cursor), end: Math.min(end, s.videoEnd) }];
    } else return "That part has already been clipped";
  }
  if (last.stage === "error" || last.stage === "cancelled") return `Part ${s.index} didn't finish — retry it from the Queue first (or stop here).`;
  updateSeries(seriesId, { status: "running", pausedFor: undefined, batchDone: 0, skipped });
  // if the newest part is still working, the chain continues when it ends; otherwise start the next one now
  if (last.stage === "done" && !isRunning(last.id)) startNextPart(seriesId, run);
  return null;
}
