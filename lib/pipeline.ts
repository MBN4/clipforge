import path from "node:path";
import fs from "node:fs";
import { nanoid } from "nanoid";
import { updateJob, getJob } from "./store";
import { ensureDir, jobDir, clipsDir } from "./paths";
import { downloadFromUrl, type TimeRange } from "./download";
import { probe, trimSource } from "./ffmpeg";
import { transcribe } from "./transcribe";
import { selectHighlights } from "./highlights";
import { aiRankHighlights } from "./ai";
import { renderClip } from "./render";
import { clampClipCount } from "./clipCount";
import type { ClipResult } from "./types";

export async function runPipeline(
  jobId: string,
  sourceUrl: string | null,
  uploadedPath: string | null,
  requestedClipCount?: number,
  range?: TimeRange
) {
  const dir = jobDir(jobId);
  const clipsOut = clipsDir(jobId);
  ensureDir(dir);
  ensureDir(clipsOut);

  try {
    let sourcePath: string;

    if (sourceUrl) {
      updateJob(jobId, { stage: "downloading", progress: 8, message: "Fetching video…" });
      try {
        sourcePath = await downloadFromUrl(sourceUrl, dir, range);
      } catch (e: any) {
        console.error("[pipeline] download failed", e);
        throw new Error(
          "Couldn't fetch that video. The link may be private, age-restricted, or the platform blocked the request — try a direct upload instead."
        );
      }
    } else if (uploadedPath) {
      sourcePath = uploadedPath;
      if (range) {
        updateJob(jobId, { stage: "downloading", progress: 8, message: "Trimming to the selected range…" });
        const trimmedPath = path.join(dir, `trimmed${path.extname(uploadedPath) || ".mp4"}`);
        await trimSource(uploadedPath, range.start, range.end, trimmedPath);
        sourcePath = trimmedPath;
      }
    } else {
      throw new Error("No source provided");
    }

    const info = await probe(sourcePath);
    updateJob(jobId, {
      sourceDuration: info.duration,
      stage: "transcribing",
      progress: 25,
      message: "Transcribing speech…",
    });

    const transcript = await transcribe(sourcePath, dir, info.duration);
    fs.writeFileSync(path.join(dir, "transcript.json"), JSON.stringify(transcript, null, 2));

    updateJob(jobId, {
      transcriptMethod: transcript.method,
      stage: "analyzing",
      progress: 50,
      message: "Finding the best moments…",
    });

    const clipCount = clampClipCount(requestedClipCount ?? 4, info.duration);
    const heuristic = selectHighlights(transcript, clipCount);
    const ranked = await aiRankHighlights(transcript, heuristic, clipCount);

    updateJob(jobId, { stage: "rendering", progress: 60, message: "Cutting vertical clips…" });

    // Render a few clips concurrently instead of strictly one-at-a-time —
    // a single ffmpeg encode at these settings doesn't saturate a modern
    // multi-core box, so this cuts real wall-clock time on the slowest
    // stage of the pipeline.
    const RENDER_CONCURRENCY = 3;
    const clipsByIndex: ClipResult[] = new Array(ranked.length);
    let completed = 0;

    async function renderOne(i: number) {
      const c = ranked[i];
      const baseName = `clip-${i}`;
      const { videoPath, thumbPath } = await renderClip({
        sourcePath,
        start: c.start,
        end: c.end,
        words: c.words,
        outDir: clipsOut,
        baseName,
      });

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
      };

      completed += 1;
      updateJob(jobId, {
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

    const clips = clipsByIndex;
    updateJob(jobId, { stage: "done", progress: 100, message: "Done", clips });
  } catch (err: any) {
    console.error("[pipeline] failed", err);
    updateJob(jobId, {
      stage: "error",
      message: "Something went wrong",
      error: err?.message ?? String(err),
    });
  }
}
