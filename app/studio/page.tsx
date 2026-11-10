"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { SourceInput } from "@/components/studio/SourceInput";
import { ClipCountStep } from "@/components/studio/ClipCountStep";
import { ProgressView } from "@/components/studio/ProgressView";
import { ProcessingAmbience } from "@/components/studio/ProcessingAmbience";
import { TipTicker } from "@/components/studio/TipTicker";
import { ClipCard } from "@/components/studio/ClipCard";
import { GameHub } from "@/components/games/GameHub";
import { SoundToggle } from "@/components/SoundToggle";
import { ToastStack, type ToastData } from "@/components/Toast";
import { sfx } from "@/lib/sound";
import { requestNotificationPermission, notifyJobDone } from "@/lib/notify";
import { nanoid } from "nanoid";
import type { Job } from "@/lib/types";

type JobWithUrls = Omit<Job, "clips"> & { clips: (Job["clips"][number] & { videoUrl: string; thumbUrl: string })[] };

type PendingSource = { type: "url"; url: string } | { type: "upload"; file: File };

type Step = "input" | "probing" | "configuring" | "processing" | "done" | "error";

interface SourceInfo {
  duration: number;
  title: string;
  thumbnail?: string;
}

function readFileDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = URL.createObjectURL(file);
    video.onloadedmetadata = () => {
      resolve(video.duration || 0);
      URL.revokeObjectURL(video.src);
    };
    video.onerror = () => resolve(0);
  });
}

export default function StudioPage() {
  const [step, setStep] = useState<Step>("input");
  const [pending, setPending] = useState<PendingSource | null>(null);
  const [sourceInfo, setSourceInfo] = useState<SourceInfo | null>(null);
  const [job, setJob] = useState<JobWithUrls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function pushToast(title: string, body?: string) {
    const id = nanoid(6);
    setToasts((t) => [...t, { id, title, body }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const poll = useCallback((id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/jobs/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setJob(data.job);
      if (data.job.stage === "done" || data.job.stage === "error") {
        if (pollRef.current) clearInterval(pollRef.current);
        setStep(data.job.stage);
        if (data.job.stage === "done") {
          sfx.jobDone();
          const count = data.job.clips.length;
          pushToast("Your clips are ready", `${count} ${count === 1 ? "clip" : "clips"} finished rendering`);
          notifyJobDone("Clipforge", `${count} ${count === 1 ? "clip" : "clips"} ready to post`);
        } else {
          pushToast("That one didn't work", data.job.error);
          notifyJobDone("Clipforge", "Something went wrong with your clip");
        }
      }
    }, 1500);
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function handleUrl(url: string) {
    setError(null);
    setPending({ type: "url", url });
    setStep("probing");
    try {
      const res = await fetch("/api/probe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't read that video");
      setSourceInfo({ duration: data.duration, title: data.title, thumbnail: data.thumbnail });
      setStep("configuring");
    } catch (e: any) {
      setError(e.message);
      setStep("input");
    }
  }

  async function handleFile(file: File) {
    setError(null);
    setPending({ type: "upload", file });
    setStep("probing");
    const duration = await readFileDuration(file);
    setSourceInfo({ duration, title: file.name });
    setStep("configuring");
  }

  async function confirmClipCount(count: number, range?: { start: number; end: number }) {
    if (!pending) return;
    setError(null);
    try {
      let res: Response;
      if (pending.type === "url") {
        res = await fetch("/api/jobs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            url: pending.url,
            clipCount: count,
            rangeStart: range?.start,
            rangeEnd: range?.end,
          }),
        });
      } else {
        const form = new FormData();
        form.append("file", pending.file);
        form.append("clipCount", String(count));
        if (range) {
          form.append("rangeStart", String(range.start));
          form.append("rangeEnd", String(range.end));
        }
        res = await fetch("/api/jobs", { method: "POST", body: form });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start");
      setJob({ id: data.id, stage: "queued", progress: 0, message: "Queued…", clips: [] } as unknown as JobWithUrls);
      setStep("processing");
      poll(data.id);
    } catch (e: any) {
      setError(e.message);
      setStep("input");
    }
  }

  function reset() {
    setJob(null);
    setError(null);
    setPending(null);
    setSourceInfo(null);
    setStep("input");
    if (pollRef.current) clearInterval(pollRef.current);
  }

  return (
    <>
      {step === "processing" && <ProcessingAmbience />}
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />

      <header className="border-b border-line px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <SoundToggle />
            {step !== "input" && (
              <button
                onClick={reset}
                className="rounded-full border border-line-strong px-4 py-1.5 text-xs font-semibold text-paper-dim transition hover:text-paper"
              >
                New clip
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-16">
        {step === "input" && (
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
              <SourceInput onSubmitUrl={handleUrl} onSubmitFile={handleFile} />
            </div>
            {error && <p className="mt-4 text-sm text-ember">{error}</p>}
          </motion.div>
        )}

        {step === "probing" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mx-auto flex min-h-[30vh] max-w-lg flex-col items-center justify-center gap-3"
          >
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-line-strong border-t-ember" />
            <p className="font-mono text-sm text-paper-dim">Reading the video…</p>
          </motion.div>
        )}

        {step === "configuring" && sourceInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mx-auto flex min-h-[40vh] max-w-lg flex-col justify-center"
          >
            <ClipCountStep
              title={sourceInfo.title}
              duration={sourceInfo.duration}
              thumbnail={sourceInfo.thumbnail}
              onConfirm={confirmClipCount}
              onCancel={reset}
            />
            {error && <p className="mt-4 text-center text-sm text-ember">{error}</p>}
          </motion.div>
        )}

        {step === "processing" && job && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mx-auto flex max-w-2xl flex-col justify-center gap-12 py-8"
          >
            <ProgressView stage={job.stage} progress={job.progress} message={job.message} />
            <TipTicker />
            <GameHub />
          </motion.div>
        )}

        {step === "error" && job && (
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

        {step === "done" && job && (
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
                <ClipCard key={c.id} clip={c} index={i} jobId={job.id} />
              ))}
            </div>
          </motion.div>
        )}
      </main>
    </>
  );
}
