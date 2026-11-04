"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { ClipResult } from "@/lib/types";

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function ClipCard({
  clip,
  index,
  jobId,
}: {
  clip: ClipResult & { videoUrl: string; thumbUrl: string };
  index: number;
  jobId: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className="group overflow-hidden rounded-2xl border border-line-strong bg-ink-2"
    >
      <div
        className="relative aspect-[9/16] cursor-pointer overflow-hidden bg-ink-3"
        onMouseEnter={() => videoRef.current?.play()}
        onMouseLeave={() => {
          if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
          }
        }}
      >
        <video
          ref={videoRef}
          src={clip.videoUrl}
          poster={clip.thumbUrl}
          muted
          loop
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute right-2 top-2 rounded-full bg-ink/70 px-2 py-1 font-mono text-[10px] text-paper backdrop-blur">
          {fmt(clip.duration)}
        </div>
        <div className="pointer-events-none absolute left-2 top-2 rounded-full bg-ember px-2 py-1 font-mono text-[10px] font-semibold text-ink">
          #{index + 1}
        </div>
      </div>

      <div className="p-4">
        <h3 className="line-clamp-2 font-display text-sm font-semibold leading-snug text-paper">
          {clip.title}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-paper-dim">{clip.reason}</p>

        <div className="mt-4 flex gap-2">
          <Link
            href={`/editor/${jobId}/${clip.index}`}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line-strong py-2.5 text-xs font-semibold text-paper transition hover:border-ember hover:text-ember"
          >
            Edit
          </Link>
          <a
            href={clip.videoUrl}
            download={`clipforge-${index + 1}.mp4`}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-paper py-2.5 text-xs font-semibold text-ink transition hover:bg-ember"
          >
            Download
          </a>
        </div>
      </div>
    </motion.div>
  );
}
