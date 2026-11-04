import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/store";
import { toFileUrl } from "@/lib/url";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const clips = job.clips.map((c) => ({
    ...c,
    videoUrl: toFileUrl(c.videoPath),
    thumbUrl: toFileUrl(c.thumbPath),
  }));

  return NextResponse.json({ job: { ...job, clips } });
}
