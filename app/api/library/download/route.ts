import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { getJob } from "@/lib/store";
import { STORAGE_ROOT } from "@/lib/paths";
import { ZIP_MAX_BYTES, zipStream, type ZipEntry } from "@/lib/zipStream";

export const dynamic = "force-dynamic";

const slug = (s: string) =>
  s.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "clip";

/**
 * Download several clips as one .zip. Posted by a plain HTML form (not fetch) so the browser streams the
 * archive straight to disk. Body: items = "<jobId>:<clipIndex>,<jobId>:<clipIndex>,…"
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const raw = form?.get("items");
  const wanted = typeof raw === "string" ? raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 2000) : [];
  if (!wanted.length) return NextResponse.json({ error: "No clips chosen" }, { status: 400 });

  const entries: ZipEntry[] = [];
  const used = new Set<string>();
  let total = 0;
  for (const key of wanted) {
    const [jobId, idx] = key.split(":");
    const job = jobId ? getJob(jobId) : undefined;
    const clip = job?.clips.find((c) => c.index === Number(idx));
    if (!job || !clip?.videoPath) continue;
    const file = path.resolve(process.cwd(), clip.videoPath);
    // only ever serve files from the storage folder
    if (!file.startsWith(STORAGE_ROOT + path.sep) || !fs.existsSync(file)) continue;
    let name = `${slug(job.title ?? "video")}-clip-${clip.index + 1}.mp4`;
    for (let n = 2; used.has(name); n++) name = `${slug(job.title ?? "video")}-clip-${clip.index + 1}-${n}.mp4`;
    used.add(name);
    total += fs.statSync(file).size;
    entries.push({ name, file });
  }
  if (!entries.length) return NextResponse.json({ error: "Those clips are no longer available" }, { status: 404 });
  if (total > ZIP_MAX_BYTES) {
    return NextResponse.json({ error: "That's over 4 GB — download fewer clips at a time." }, { status: 413 });
  }

  const body = Readable.toWeb(Readable.from(zipStream(entries))) as unknown as ReadableStream;
  return new Response(body, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="clipforge-clips-${entries.length}.zip"`,
      "content-length": String(
        entries.reduce((n, e) => n + 30 + Buffer.byteLength(e.name) + fs.statSync(e.file).size + 16 + 46 + Buffer.byteLength(e.name), 0) + 22
      ),
    },
  });
}
