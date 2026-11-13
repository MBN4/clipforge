import path from "node:path";
import fs from "node:fs";
import { nanoid } from "nanoid";
import { updateJob, getJob } from "./store";
import { runInContext, withSlot, throwIfCancelled, isCancelled, cancelRequested, blockedMs, RENDER_WEIGHT, TRANSCRIBE_WEIGHT } from "./scheduler";
import { ensureDir, jobDir, clipsDir } from "./paths";
import { downloadFromUrl, type TimeRange } from "./download";
import { probe, trimSource, extractThumb } from "./ffmpeg";
import { toFileUrl } from "./url";
import { transcribe } from "./transcribe";
import { selectHighlights } from "./highlights";
import { aiRankHighlights } from "./ai";
import { renderClip } from "./render";
import { clampClipCount } from "./clipCount";
import type { ClipResult, JobStage } from "./types";

const WAIT_LABEL = { download: "a download slot", cpu: "free CPU" } as const;

export function runPipeline(
  jobId: string,
  sourceUrl: string | null,
  uploadedPath: string | null,
  requestedClipCount?: number,
  range?: TimeRange
) {
  const priority = getJob(jobId)?.createdAt ?? Date.now();
  return runInContext(
    jobId,
    // shown on the dashboard while the job is queued behind others
    (ctx, waiting, ahead, pool) => {
      // a clip waiting for a slot while others render isn't "in line" — only flag a job with nothing running
      if (ctx.holding > 0) return;
      updateJob(jobId, {
        waitedMs: blockedMs(ctx),
        waiting: waiting > 0,
        message: `Waiting for ${WAIT_LABEL[pool]}${ahead > 0 ? ` — ${ahead} ahead` : ""}…`,
      });
    },
    (ctx) => pipelineBody(ctx.jobId, priority, sourceUrl, uploadedPath, requestedClipCount, range, () => blockedMs(ctx))
  );
}

async function pipelineBody(
  jobId: string,
  priority: number,
  sourceUrl: string | null,
  uploadedPath: string | null,
  requestedClipCount: number | undefined,
  range: TimeRange | undefined,
  waitedMs: () => number
) {
  const dir = jobDir(jobId);
  const clipsOut = clipsDir(jobId);
  ensureDir(dir);
  ensureDir(clipsOut);

  // per-stage wall-clock timings, for the dashboard's speed breakdown
  const timings: Partial<Record<JobStage, number>> = {};
  let stage: JobStage = "queued";
  let stageAt = Date.now();
  function enter(next: JobStage, patch: Parameters<typeof updateJob>[1] = {}) {
    const now = Date.now();
    timings[stage] = (timings[stage] ?? 0) + (now - stageAt);
    stage = next;
    stageAt = now;
    updateJob(jobId, { stage: next, waiting: false, timings: { ...timings }, waitedMs: waitedMs(), ...patch });
  }
  updateJob(jobId, { startedAt: Date.now() });

  try {
    let sourcePath: string;

    enter("downloading", { progress: 8, message: sourceUrl ? "Fetching video…" : "Preparing video…" });
    if (sourceUrl) {
      try {
        sourcePath = await withSlot("download", 1, priority, () => {
          updateJob(jobId, { waiting: false, waitedMs: waitedMs(), message: "Fetching video…" });
          return downloadFromUrl(sourceUrl, dir, range);
        });
      } catch (e: any) {
        if (isCancelled(e) || cancelRequested()) throw e;
        console.error("[pipeline] download failed", e);
        throw new Error(
          "Couldn't fetch that video. The link may be private, age-restricted, or the platform blocked the request — try a direct upload instead."
        );
      }
    } else if (uploadedPath) {
      sourcePath = uploadedPath;
      if (range) {
        updateJob(jobId, { message: "Trimming to the selected range…" });
        const trimmedPath = path.join(dir, `trimmed${path.extname(uploadedPath) || ".mp4"}`);
        await trimSource(uploadedPath, range.start, range.end, trimmedPath);
        sourcePath = trimmedPath;
      }
    } else {
      throw new Error("No source provided");
    }
    throwIfCancelled();

    const info = await probe(sourcePath);
    // a local frame for the dashboard (uploads have no remote thumbnail; links' ones can be blocked)
    try {
      const thumbPath = path.join(dir, "thumb.jpg");
      await extractThumb(sourcePath, thumbPath, Math.min(2, info.duration / 3));
      updateJob(jobId, { thumbnail: toFileUrl(thumbPath) });
    } catch {
      // purely cosmetic — the placeholder icon is fine
    }
    enter("transcribing", { sourceDuration: info.duration, progress: 25, message: "Transcribing speech…" });

    // whisper uses every core, so it takes the whole compute pool: it never
    // overlaps another job's transcription or renders, which is what keeps
    // each video's speed the same no matter how many are queued.
    const transcript = await withSlot("cpu", TRANSCRIBE_WEIGHT, priority, () => {
      updateJob(jobId, { waiting: false, waitedMs: waitedMs(), message: "Transcribing speech…" });
      return transcribe(sourcePath, dir, info.duration);
    });
    throwIfCancelled();
    fs.writeFileSync(path.join(dir, "transcript.json"), JSON.stringify(transcript, null, 2));

    enter("analyzing", { transcriptMethod: transcript.method, progress: 50, message: "Finding the best moments…" });

    const clipCount = clampClipCount(requestedClipCount ?? 4, info.duration);
    const heuristic = selectHighlights(transcript, clipCount);
    const ranked = await aiRankHighlights(transcript, heuristic, clipCount);

    throwIfCancelled();
    enter("rendering", { progress: 60, message: "Cutting vertical clips…" });

    // Render a few clips concurrently instead of strictly one-at-a-time —
    // a single ffmpeg encode at these settings doesn't saturate a modern
    // multi-core box, so this cuts real wall-clock time on the slowest
    // stage of the pipeline. Each encode borrows a render slot from the
    // shared pool, so clips from several jobs interleave (earliest job
    // first) without ever oversubscribing the machine.
    const RENDER_CONCURRENCY = 3;
    const clipsByIndex: ClipResult[] = new Array(ranked.length);
    let completed = 0;

    async function renderOne(i: number) {
      const c = ranked[i];
      const baseName = `clip-${i}`;
      const rawPath = path.join(clipsOut, `raw-${i}.mp4`);

      const [{ videoPath, thumbPath }] = await withSlot("cpu", RENDER_WEIGHT, priority, () => {
        updateJob(jobId, { waiting: false, waitedMs: waitedMs(), message: `Rendering clip ${completed + 1} of ${ranked.length}…` });
        return Promise.all([
          renderClip({
            sourcePath,
            start: c.start,
            end: c.end,
            words: c.words,
            outDir: clipsOut,
            baseName,
          }),
          // Also keep an uncropped, unedited copy of just this window — the
          // editor works from this rather than the polished render, since the
          // polished one already has crop/captions baked in permanently.
          trimSource(sourcePath, c.start, c.end, rawPath),
        ]);
      });

      const relativeWords = c.words.map((w) => ({
        word: w.word,
        start: Math.max(0, w.start - c.start),
        end: Math.max(0, w.end - c.start),
      }));

      clipsByIndex[i] = {
        id: nanoid(8),
        index: i,
        start: c.start,
        end: c.end,
        duration: c.end - c.start,
        title: c.title,
        hook: c.hook,
        score: c.score,
        reason: c.reason,
        videoPath: path.relative(process.cwd(), videoPath),
        thumbPath: path.relative(process.cwd(), thumbPath),
        rawPath: path.relative(process.cwd(), rawPath),
        words: relativeWords,
      };

      completed += 1;
      updateJob(jobId, {
        waiting: false,
        progress: 60 + Math.round((completed / ranked.length) * 38),
        message: `Rendering clip ${completed} of ${ranked.length}…`,
      });
    }

    let next = 0;
    async function worker() {
      while (next < ranked.length) {
        const i = next++;
        await renderOne(i);
      }
    }
    await Promise.all(Array.from({ length: Math.min(RENDER_CONCURRENCY, ranked.length) }, worker));

    throwIfCancelled();
    const clips = clipsByIndex;
    enter("done", { progress: 100, message: "Done", clips, finishedAt: Date.now() });
  } catch (err: any) {
    if (isCancelled(err) || cancelRequested()) {
      enter("cancelled", { message: "Cancelled", finishedAt: Date.now() });
      return;
    }
    console.error("[pipeline] failed", err);
    enter("error", { message: "Something went wrong", error: err?.message ?? String(err), finishedAt: Date.now() });
  }
}
