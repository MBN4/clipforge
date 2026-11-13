import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/store";
import { cancelRun } from "@/lib/scheduler";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getJob(id)) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  // the pipeline notices the cancel, kills its processes and marks the job "cancelled"
  const cancelled = cancelRun(id);
  return NextResponse.json({ ok: cancelled });
}
