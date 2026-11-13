import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { getJob, deleteJob } from "@/lib/store";
import { cancelRun, isRunning } from "@/lib/scheduler";
import { toClientJob } from "@/lib/serialize";
import { jobDir } from "@/lib/paths";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json({ job: toClientJob(job, true) });
}

/** Remove a video and everything generated from it. A running job is cancelled first. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (isRunning(id)) {
    cancelRun(id);
    // give killed ffmpeg/yt-dlp processes a moment to release their files
    await new Promise((r) => setTimeout(r, 400));
  }
  deleteJob(id);
  await fs.promises.rm(jobDir(id), { recursive: true, force: true }).catch(() => {});
  return NextResponse.json({ ok: true });
}
