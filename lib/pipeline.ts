import path from "node:path";
import fs from "node:fs";
import { nanoid } from "nanoid";
import { updateJob, getJob } from "./store";
import { ensureDir, jobDir, clipsDir } from "./paths";
import { downloadFromUrl } from "./download";
import { probe } from "./ffmpeg";
import { transcribe } from "./transcribe";
import { selectHighlights } from "./highlights";
import { aiRankHighlights } from "./ai";
import { renderClip } from "./render";
import type { ClipResult } from "./types";

export async function runPipeline(jobId: string, sourceUrl: string | null, uploadedPath: string | null) {
  const dir = jobDir(jobId);
  const clipsOut = clipsDir(jobId);
  ensureDir(dir);
  ensureDir(clipsOut);

  try {
    let sourcePath: string;

    if (sourceUrl) {
      updateJob(jobId, { stage: "downloading", progress: 8, message: "Fetching video…" });
      try {
        sourcePath = await downloadFromUrl(sourceUrl, dir);
      } catch (e: any) {
        console.error("[pipeline] download failed", e);
        throw new Error(
          "Couldn't fetch that video. The link may be private, age-restricted, or the platform blocked the request — try a direct upload instead."
        );
      }
    } else if (uploadedPath) {
      sourcePath = uploadedPath;
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

    const transcript = await transcribe(sourcePath, dir);
    fs.writeFileSync(path.join(dir, "transcript.json"), JSON.stringify(transcript, null, 2));

    updateJob(jobId, {
      transcriptMethod: transcript.method,
      stage: "analyzing",
      progress: 50,
      message: "Finding the best moments…",
    });

    const heuristic = selectHighlights(transcript);
    const ranked = await aiRankHighlights(transcript, heuristic);

    updateJob(jobId, { stage: "rendering", progress: 60, message: "Cutting vertical clips…" });

    const clips: ClipResult[] = [];
    for (let i = 0; i < ranked.length; i++) {
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

      clips.push({
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
      });

      updateJob(jobId, {
        progress: 60 + Math.round(((i + 1) / ranked.length) * 38),
        message: `Rendering clip ${i + 1} of ${ranked.length}…`,
      });
    }

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
