import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { ensureDir, jobDir } from "@/lib/paths";
import { getJob } from "@/lib/store";
import { toFileUrl } from "@/lib/url";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
  }

  const assetsDir = path.join(jobDir(id), "assets");
  ensureDir(assetsDir);
  const ext = path.extname(file.name) || ".mp3";
  const filename = `music-${nanoid(8)}${ext}`;
  const filePath = path.join(assetsDir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  const relPath = path.relative(process.cwd(), filePath);
  return NextResponse.json({ path: relPath, url: toFileUrl(relPath), name: file.name });
}
