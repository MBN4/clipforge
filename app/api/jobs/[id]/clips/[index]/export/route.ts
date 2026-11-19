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

  // the spec ends up inside an ffmpeg filter graph, so check what it relies on
  const t = spec?.trim;
  if (!t || !Number.isFinite(t.start) || !Number.isFinite(t.end) || t.end <= t.start || t.start < 0) {
    return NextResponse.json({ error: "Invalid trim range" }, { status: 400 });
  }
  const hex = (c: unknown, fallback: string) => (typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback);
  const n = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
  spec = {
    ...spec,
    textOverlays: (spec.textOverlays ?? []).map((o) => ({
      ...o,
      text: String(o.text ?? "").slice(0, 200),
      color: hex(o.color, "#ffffff"),
      x: n(o.x, 0.5),
      y: n(o.y, 0.5),
      fontSize: n(o.fontSize, 64),
      start: n(o.start, 0),
      end: n(o.end, 0),
    })),
    stickers: (spec.stickers ?? []).map((st) => ({
      ...st,
      color: hex(st.color, "#ff4e1f"),
      x: n(st.x, 0.5),
      y: n(st.y, 0.5),
      size: n(st.size, 160),
      start: n(st.start, 0),
      end: n(st.end, 0),
    })),
  };

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
