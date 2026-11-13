import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getJob, updateJob } from "@/lib/store";
import { isRunning } from "@/lib/scheduler";
import { jobDir, clipsDir } from "@/lib/paths";
import { runPipeline } from "@/lib/pipeline";

/** Re-run a failed or cancelled video with the same settings. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (isRunning(id)) return NextResponse.json({ error: "Already running" }, { status: 409 });
  if (job.stage === "done") return NextResponse.json({ error: "Already finished" }, { status: 409 });

  const dir = jobDir(id);
  let sourceUrl: string | null = null;
  let uploadedPath: string | null = null;
  if (job.source.type === "url" && job.source.url) {
    sourceUrl = job.source.url;
    // clear any partial download so it can't be mistaken for the finished source
    if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (/^source\./.test(f)) fs.rmSync(path.join(dir, f), { force: true });
  } else {
    // the original upload is kept as source.<ext>; derived files (trimmed.*, audio…) are rebuilt
    const original = fs.existsSync(dir) ? fs.readdirSync(dir).find((f) => /^source\./.test(f)) : undefined;
    if (!original) return NextResponse.json({ error: "The original upload is gone — upload it again." }, { status: 410 });
    uploadedPath = path.join(dir, original);
  }
  await fs.promises.rm(clipsDir(id), { recursive: true, force: true }).catch(() => {});

  updateJob(id, {
    stage: "queued",
    progress: 2,
    message: "Queued…",
    error: undefined,
    clips: [],
    timings: undefined,
    startedAt: undefined,
    finishedAt: undefined,
    waitedMs: 0,
    waiting: false,
    createdAt: Date.now(), // goes to the back of the line
  });
  const { clipCount, range } = job.request ?? {};
  runPipeline(id, sourceUrl, uploadedPath, clipCount, range).catch((e) => console.error("pipeline crash", e));
  return NextResponse.json({ ok: true });
}
