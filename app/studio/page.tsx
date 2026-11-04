"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { SourceInput } from "@/components/studio/SourceInput";
import { ProgressView } from "@/components/studio/ProgressView";
import { ClipCard } from "@/components/studio/ClipCard";
import type { Job } from "@/lib/types";

type JobWithUrls = Job & { clips: (Job["clips"][number] & { videoUrl: string; thumbUrl: string })[] };

export default function StudioPage() {
  const [job, setJob] = useState<JobWithUrls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback((id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/jobs/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setJob(data.job);
      if (data.job.stage === "done" || data.job.stage === "error") {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 1500);
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function startWithUrl(url: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start");
      setJob({ id: data.id, stage: "queued", progress: 0, message: "Queued…", clips: [] } as JobWithUrls);
      poll(data.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function startWithFile(file: File) {
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/jobs", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start");
      setJob({ id: data.id, stage: "queued", progress: 0, message: "Queued…", clips: [] } as JobWithUrls);
      poll(data.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setJob(null);
    setError(null);
    if (pollRef.current) clearInterval(pollRef.current);
  }

  const isProcessing = job && job.stage !== "done" && job.stage !== "error";
  const isDone = job && job.stage === "done";
  const isError = job && job.stage === "error";

  return (
    <>
      <header className="border-b border-line px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/">
            <Logo />
          </Link>
          {job && (
            <button
              onClick={reset}
              className="rounded-full border border-line-strong px-4 py-1.5 text-xs font-semibold text-paper-dim transition hover:text-paper"
            >
              New clip
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 px-6 py-16">
        {!job && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-2xl text-center"
          >
            <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Turn a video into clips.
            </h1>
            <p className="mt-3 text-paper-dim">
              YouTube, Instagram, TikTok, Facebook, or your own file.
            </p>
            <div className="mt-10">
              <SourceInput onSubmitUrl={startWithUrl} onSubmitFile={startWithFile} disabled={submitting} />
            </div>
            {error && <p className="mt-4 text-sm text-ember">{error}</p>}
          </motion.div>
        )}

        {isProcessing && job && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mx-auto flex min-h-[40vh] max-w-2xl flex-col justify-center"
          >
            <ProgressView stage={job.stage} progress={job.progress} message={job.message} />
          </motion.div>
        )}

        {isError && job && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mx-auto max-w-lg text-center"
          >
            <p className="font-display text-xl font-semibold text-paper">That one didn't work</p>
            <p className="mt-2 text-sm text-paper-dim">{job.error}</p>
            <button
              onClick={reset}
              className="mt-6 rounded-full bg-ember px-6 py-3 text-sm font-semibold text-ink"
            >
              Try again
            </button>
          </motion.div>
        )}

        {isDone && job && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-6xl">
            <div className="mb-8 flex flex-col gap-1 text-center">
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                {job.clips.length} {job.clips.length === 1 ? "clip" : "clips"}, ready to post
              </h2>
              {job.transcriptMethod === "heuristic" && (
                <p className="text-xs text-paper-dim">
                  Captions were skipped for this video — speech-to-text wasn't available, so clips
                  were picked by pacing instead.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {job.clips.map((c, i) => (
                <ClipCard key={c.id} clip={c} index={i} />
              ))}
            </div>
          </motion.div>
        )}
      </main>
    </>
  );
}
