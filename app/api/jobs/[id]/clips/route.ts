import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getJob, updateJob } from "@/lib/store";
import { clipsDir, jobDir } from "@/lib/paths";

export const dynamic = "force-dynamic";

/**
 * Delete clips from a video's library. Body: { indexes: number[] }.
 * Removes the clips' files too (rendered video, thumbnail, editor source, and every edited export).
 * Remaining clips keep their index, so editor links stay valid.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) {
    return NextResponse.json({ error: "Cross-origin request refused" }, { status: 403 });
  }
  const { id } = await params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { indexes?: unknown };
  const indexes = Array.isArray(body.indexes) ? body.indexes.filter((n): n is number => Number.isInteger(n)) : [];
  if (!indexes.length) return NextResponse.json({ error: "No clips selected" }, { status: 400 });
  const doomed = new Set(indexes);

  const root = path.resolve(jobDir(id)) + path.sep;
  const rm = (rel: string | undefined) => {
    if (!rel) return;
    const abs = path.resolve(process.cwd(), rel);
    if (abs.startsWith(root)) fs.rmSync(abs, { force: true }); // never touch anything outside this job's folder
  };

  const removed = job.clips.filter((c) => doomed.has(c.index));
  for (const c of removed) {
    rm(c.videoPath);
    rm(c.thumbPath);
    rm(c.rawPath);
    // the job record only points at the latest render, so also sweep the originals and every edited
    // export by name: clip-<n>.*, raw-<n>.*, clip-<n>-edit-*
    try {
      const dir = clipsDir(id);
      const mine = new RegExp(`^(clip-${c.index}(\\.[a-z0-9]+|-edit-.*)|raw-${c.index}\\.[a-z0-9]+)$`, "i");
      for (const f of fs.readdirSync(dir)) if (mine.test(f)) fs.rmSync(path.join(dir, f), { force: true });
    } catch {
      // folder already gone
    }
  }
  updateJob(id, { clips: job.clips.filter((c) => !doomed.has(c.index)) });
  return NextResponse.json({ ok: true, deleted: removed.length });
}
