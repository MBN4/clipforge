import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline as pipe } from "node:stream/promises";
import { createJob, listJobs } from "@/lib/store";
import { systemSnapshot } from "@/lib/scheduler";
import { toClientJob } from "@/lib/serialize";
import { ensureDir, jobDir } from "@/lib/paths";
import { detectPlatform } from "@/lib/download";
import { runPipeline } from "@/lib/pipeline";
import { SERIES_BATCH_SEC, SERIES_PART_SEC, type SeriesInfo } from "@/lib/types";

// optional tuning: CLIPFORGE_SERIES_PART_SEC (default 1800) and CLIPFORGE_SERIES_BATCH_SEC (default 7200)
const envSec = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 30 ? n : fallback;
};
import type { TimeRange } from "@/lib/download";
import { normalizeQuality } from "@/lib/quality";
import type { ClipMode, Job } from "@/lib/types";

function parseRange(rawStart: unknown, rawEnd: unknown): TimeRange | undefined {
  const start = typeof rawStart === "string" ? parseFloat(rawStart) : typeof rawStart === "number" ? rawStart : NaN;
  const end = typeof rawEnd === "string" ? parseFloat(rawEnd) : typeof rawEnd === "number" ? rawEnd : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return undefined;
  return { start: Math.max(0, start), end };
}

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
const parseMode = (v: unknown): ClipMode => (v === "peaks" ? "peaks" : "auto");
const num = (v: unknown) => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export async function GET() {
  return NextResponse.json({ jobs: listJobs().map((j) => toClientJob(j)), system: systemSnapshot() });
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  const id = nanoid(10);
  const dir = jobDir(id);
  ensureDir(dir);

  let sourceUrl: string | null = null;
  let uploadedPath: string | null = null;
  let source: Job["source"];
  let clipCount: number | undefined;
  let range: TimeRange | undefined;
  let mode: ClipMode = "auto";
  let quality = normalizeQuality(undefined);
  let title: string | undefined;
  let thumbnail: string | undefined;
  let duration: number | undefined;
  let seriesFrom: number | undefined; // set when a long link should be clipped part by part

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    const ext = path.extname(file.name) || ".mp4";
    uploadedPath = path.join(dir, `source${ext}`);
    await pipe(Readable.fromWeb(file.stream() as never), fs.createWriteStream(uploadedPath));
    source = { type: "upload", filename: file.name };
    title = str(form.get("title"), 200) ?? file.name;
    duration = num(form.get("duration"));
    const rawCount = form.get("clipCount");
    if (typeof rawCount === "string") clipCount = parseInt(rawCount, 10);
    range = parseRange(form.get("rangeStart"), form.get("rangeEnd"));
    mode = parseMode(form.get("mode"));
    quality = normalizeQuality(form.get("quality"));
  } else {
    const body = await req.json().catch(() => ({}));
    const url = (body.url || "").trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: "Please provide a valid video URL" }, { status: 400 });
    }
    sourceUrl = url;
    source = { type: "url", url, platform: detectPlatform(url) };
    if (typeof body.clipCount === "number") clipCount = body.clipCount;
    range = parseRange(body.rangeStart, body.rangeEnd);
    mode = parseMode(body.mode);
    quality = normalizeQuality(body.quality);
    title = str(body.title, 200);
    thumbnail = str(body.thumbnail, 1000);
    duration = num(body.duration);
    if (body.series && typeof body.series === "object" && duration && duration > envSec("CLIPFORGE_SERIES_PART_SEC", SERIES_PART_SEC)) {
      const from = Number((body.series as { from?: unknown }).from);
      seriesFrom = Number.isFinite(from) ? Math.min(Math.max(0, from), duration - 60) : 0;
    }
  }

  // a long video clipped automatically in consecutive parts: this job is part 1
  let series: SeriesInfo | undefined;
  if (seriesFrom !== undefined && duration) {
    const partSec = envSec("CLIPFORGE_SERIES_PART_SEC", SERIES_PART_SEC);
    const end = Math.min(duration, seriesFrom + partSec);
    range = { start: seriesFrom, end: duration - end < 20 ? duration : end };
    series = {
      id: nanoid(10),
      baseTitle: title ?? "Long video",
      videoEnd: duration,
      partSec,
      batchSec: envSec("CLIPFORGE_SERIES_BATCH_SEC", SERIES_BATCH_SEC),
      index: 1,
      cursor: range.end,
      batchDone: range.end - range.start,
      skipped: [],
      status: "running",
    };
    title = `${series.baseTitle} · Part 1`;
  }

  const job: Job = {
    id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    source,
    title,
    thumbnail,
    sourceDuration: duration,
    request: { clipCount, range, mode, quality },
    series,
    stage: "queued",
    progress: 2,
    message: "Queued…",
    clips: [],
  };
  createJob(job);

  runPipeline(id, sourceUrl, uploadedPath, clipCount, range, mode).catch((e) => console.error("pipeline crash", e));

  return NextResponse.json({ id });
}
