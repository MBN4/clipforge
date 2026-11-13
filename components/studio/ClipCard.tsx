"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Download, Pencil, Star } from "lucide-react";
import type { ClientClip } from "@/lib/serialize";

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function ClipCard({ clip, index, jobId, videoTitle }: { clip: ClientClip; index: number; jobId: string; videoTitle?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.04 }}
      className="group overflow-hidden rounded-2xl border border-line-strong bg-ink-2 transition-colors hover:border-white/25"
    >
      <div
        className="relative aspect-[9/16] cursor-pointer overflow-hidden bg-ink-3"
        onMouseEnter={() => videoRef.current?.play().catch(() => {})}
        onMouseLeave={() => {
          if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
          }
        }}
      >
        <video ref={videoRef} src={clip.videoUrl} poster={clip.thumbUrl} muted loop playsInline preload="none" className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="pointer-events-none absolute right-2 top-2 rounded-full bg-ink/70 px-2 py-1 font-mono text-[10px] text-paper backdrop-blur">{fmt(clip.duration)}</div>
        <div className="pointer-events-none absolute left-2 top-2 rounded-full bg-ember px-2 py-1 font-mono text-[10px] font-semibold text-ink">#{clip.index + 1}</div>
        {clip.score > 0 && (
          <div className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 font-mono text-[10px] text-moss backdrop-blur">
            <Star className="h-3 w-3 fill-current" /> {clip.score.toFixed(1)}
          </div>
        )}
      </div>

      <div className="p-4">
        {videoTitle && <p className="mb-1.5 truncate font-mono text-[10px] uppercase tracking-wider text-paper-dim">{videoTitle}</p>}
        <h3 className="line-clamp-2 font-display text-sm font-semibold leading-snug text-paper">{clip.title}</h3>
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-paper-dim">{clip.reason}</p>

        <div className="mt-4 flex gap-2">
          <Link
            href={`/editor/${jobId}/${clip.index}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line-strong py-2.5 text-xs font-semibold text-paper transition hover:border-ember hover:text-ember"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Link>
          <a
            href={clip.videoUrl}
            download={`clipforge-${(videoTitle ?? "clip").replace(/[^\w-]+/g, "-").slice(0, 40)}-${clip.index + 1}.mp4`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-paper py-2.5 text-xs font-semibold text-ink transition hover:bg-ember"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </a>
        </div>
      </div>
    </motion.div>
  );
}
