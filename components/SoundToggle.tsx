"use client";

import { useEffect, useState } from "react";
import { getMuted, setMuted } from "@/lib/sound";

export function SoundToggle({ className = "" }: { className?: string }) {
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    setMutedState(getMuted());
  }, []);

  function toggle() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={muted ? "Unmute sound" : "Mute sound"}
      className={`flex h-8 w-8 items-center justify-center rounded-full border border-line-strong bg-ink-2 text-paper-dim transition hover:text-paper ${className}`}
    >
      {muted ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 5 6 9H2v6h4l5 4V5Z" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 5 6 9H2v6h4l5 4V5Z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 6a9 9 0 0 1 0 12" />
        </svg>
      )}
    </button>
  );
}
