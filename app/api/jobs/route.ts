import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import fs from "node:fs";
import path from "node:path";
import { createJob, listJobs } from "@/lib/store";
import { ensureDir, jobDir } from "@/lib/paths";
import { detectPlatform } from "@/lib/download";
import { runPipeline } from "@/lib/pipeline";
import type { Job } from "@/lib/types";

export async function GET() {
  return NextResponse.json({ jobs: listJobs() });
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

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    const ext = path.extname(file.name) || ".mp4";
    uploadedPath = path.join(dir, `source${ext}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(uploadedPath, buffer);
    source = { type: "upload", filename: file.name };
    const rawCount = form.get("clipCount");
    if (typeof rawCount === "string") clipCount = parseInt(rawCount, 10);
  } else {
    const body = await req.json().catch(() => ({}));
    const url = (body.url || "").trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: "Please provide a valid video URL" }, { status: 400 });
    }
    sourceUrl = url;
    source = { type: "url", url, platform: detectPlatform(url) };
    if (typeof body.clipCount === "number") clipCount = body.clipCount;
  }

  const job: Job = {
    id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    source,
    stage: "queued",
    progress: 2,
    message: "Queued…",
    clips: [],
  };
  createJob(job);

  runPipeline(id, sourceUrl, uploadedPath, clipCount).catch((e) => console.error("pipeline crash", e));

  return NextResponse.json({ id });
}
