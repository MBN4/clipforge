import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { getJob, updateJob } from "@/lib/store";
import { clipsDir } from "@/lib/paths";
import { exportClip } from "@/lib/exportRender";
import { toFileUrl } from "@/lib/url";
import { nanoid } from "nanoid";
import type { ExportSpec } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  const { id, index } = await params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const clipIndex = parseInt(index, 10);
  const clip = job.clips.find((c) => c.index === clipIndex);
  if (!clip) return NextResponse.json({ error: "Clip not found" }, { status: 404 });

  let spec: ExportSpec;
  try {
    spec = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid edit data" }, { status: 400 });
  }

  const rawPath = path.join(process.cwd(), clip.rawPath);
  const outDir = clipsDir(id);
  const baseName = `clip-${clipIndex}-edit-${nanoid(6)}`;

  try {
    const { videoPath, thumbPath } = await exportClip({
      rawPath,
      outDir,
      baseName,
      spec: {
        ...spec,
        music: spec.music
          ? { ...spec.music, path: path.join(process.cwd(), spec.music.path) }
          : null,
      },
    });

    const videoRel = path.relative(process.cwd(), videoPath);
    const thumbRel = path.relative(process.cwd(), thumbPath);

    const updatedClips = job.clips.map((c) =>
      c.index === clipIndex ? { ...c, videoPath: videoRel, thumbPath: thumbRel } : c
    );
    updateJob(id, { clips: updatedClips });

    return NextResponse.json({
      videoUrl: toFileUrl(videoRel),
      thumbUrl: toFileUrl(thumbRel),
    });
  } catch (e: any) {
    console.error("[export] failed", e);
    return NextResponse.json({ error: "Export failed. Try simplifying the edit and try again." }, { status: 500 });
  }
}
