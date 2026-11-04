"use client";

import { useRef, useState } from "react";
import type { MusicState } from "@/app/editor/[jobId]/[clipIndex]/page";

export function MusicPanel({
  jobId,
  music,
  onChange,
}: {
  jobId: string;
  music: MusicState | null;
  onChange: (m: MusicState | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/jobs/${jobId}/music`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onChange({ path: data.path, url: data.url, name: data.name, volume: 0.5, duckOriginal: 0.4 });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-sm font-semibold text-paper">Music</h3>
        <p className="mt-1 text-xs text-paper-dim">Upload a track to mix under the clip's own audio.</p>
      </div>

      {!music ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-strong p-6 text-center transition hover:border-ember"
        >
          <p className="text-sm text-paper">{uploading ? "Uploading…" : "Choose an audio file"}</p>
          <p className="text-[11px] text-paper-dim">mp3, wav, m4a</p>
          <input
            ref={inputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-line-strong p-3">
          <div className="flex items-center justify-between">
            <p className="truncate text-sm text-paper">{music.name}</p>
            <button onClick={() => onChange(null)} className="shrink-0 text-[11px] text-paper-dim hover:text-ember">
              Remove
            </button>
          </div>
          <audio controls src={music.url} className="w-full" style={{ height: 32 }} />

          <label className="block">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-paper-dim">Music volume</span>
              <span className="font-mono text-xs text-paper">{Math.round(music.volume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={music.volume}
              onChange={(e) => onChange({ ...music, volume: parseFloat(e.target.value) })}
              className="mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-3 accent-ember"
            />
          </label>

          <label className="block">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-paper-dim">Original clip audio</span>
              <span className="font-mono text-xs text-paper">{Math.round(music.duckOriginal * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={music.duckOriginal}
              onChange={(e) => onChange({ ...music, duckOriginal: parseFloat(e.target.value) })}
              className="mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-3 accent-ember"
            />
          </label>
        </div>
      )}

      {error && <p className="text-xs text-ember">{error}</p>}
    </div>
  );
}
