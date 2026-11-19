"use client";

import { useState, type ReactNode } from "react";
import type { AudioSpec, LayoutMode, PolishSpec, TimeRange } from "@/lib/types";
import type { Timeline } from "@/lib/timeline";

export interface Cuts {
  silences: TimeRange[];
  fillers: TimeRange[];
}

const SENSITIVITY = [
  { key: "gentle", label: "Gentle", hint: "Only long pauses (0.7s+)", noiseDb: -35, minSilence: 0.7 },
  { key: "balanced", label: "Balanced", hint: "Natural-sounding tightening", noiseDb: -32, minSilence: 0.45 },
  { key: "tight", label: "Tight", hint: "Fast, jump-cut pacing", noiseDb: -28, minSilence: 0.28 },
] as const;

const SPEEDS = [0.75, 1, 1.15, 1.25, 1.5, 2];

/** Keep a little air on each side of a cut so it never clips the end of a word. */
const CUT_PAD = 0.08;

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line-strong p-3">
      <h4 className="text-[12px] font-semibold text-paper">{title}</h4>
      {hint && <p className="mt-0.5 text-[11px] leading-snug text-paper-dim">{hint}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <span>
        <span className="block text-[12px] text-paper">{label}</span>
        {hint && <span className="block text-[11px] text-paper-dim">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-ember" : "bg-ink-3"}`}
      >
        <span className={`block h-4 w-4 translate-y-0.5 rounded-full bg-paper transition ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}

function Seg<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.key)}
          title={o.hint}
          onClick={() => onChange(o.key)}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
            value === o.key ? "border-ember bg-ember text-ink" : "border-line-strong text-paper-dim hover:text-paper"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] text-paper-dim">{label}</span>
        <span className="font-mono text-xs text-paper">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-3 accent-ember"
      />
    </label>
  );
}

const fmtSec = (s: number) => `${s.toFixed(1)}s`;

export function EnhancePanel({
  jobId,
  clipIndex,
  trim,
  timeline,
  speed,
  onSpeed,
  cuts,
  onCuts,
  fillerCount,
  onCutFillers,
  hasWords,
  audio,
  onAudio,
  polish,
  onPolish,
  layout,
  onLayout,
}: {
  jobId: string;
  clipIndex: number;
  trim: TimeRange;
  timeline: Timeline;
  speed: number;
  onSpeed: (v: number) => void;
  cuts: Cuts;
  onCuts: (c: Cuts) => void;
  /** filler words ("um", "uh"…) found in the transcript, not yet cut */
  fillerCount: number;
  onCutFillers: () => void;
  hasWords: boolean;
  audio: AudioSpec;
  onAudio: (a: AudioSpec) => void;
  polish: PolishSpec;
  onPolish: (p: PolishSpec) => void;
  layout: LayoutMode;
  onLayout: (l: LayoutMode) => void;
}) {
  const [sens, setSens] = useState<(typeof SENSITIVITY)[number]["key"]>("balanced");
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  const trimLen = trim.end - trim.start;
  const keptSource = timeline.segments.reduce((a, s) => a + (s.src1 - s.src0), 0);
  const cutSeconds = Math.max(0, trimLen - keptSource);
  const cutCount = cuts.silences.length + cuts.fillers.length;

  async function scanSilences() {
    const level = SENSITIVITY.find((s) => s.key === sens)!;
    setScanning(true);
    setScanMsg(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/clips/${clipIndex}/silences`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ noiseDb: level.noiseDb, minSilence: level.minSilence }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      const found: TimeRange[] = (data.silences as TimeRange[])
        .map((s) => ({ start: Math.max(trim.start, s.start + CUT_PAD), end: Math.min(trim.end, s.end - CUT_PAD) }))
        .filter((s) => s.end - s.start >= 0.12);
      onCuts({ ...cuts, silences: found });
      setScanMsg(found.length ? null : "No pauses that long — try Tight.");
    } catch (e) {
      setScanMsg(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  const setBar = (patch: Partial<PolishSpec["progressBar"]>) => onPolish({ ...polish, progressBar: { ...polish.progressBar, ...patch } });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-sm font-semibold text-paper">Magic</h3>
        <p className="mt-1 text-xs text-paper-dim">One-click automatic edits.</p>
        <p className="mt-2 rounded-lg bg-ink-3 px-2.5 py-1.5 font-mono text-[11px] text-paper-dim">
          Final length <span className="text-paper">{fmtSec(timeline.duration)}</span>
          {cutSeconds > 0.05 && <span> · {fmtSec(cutSeconds)} cut</span>}
          {speed !== 1 && <span> · {speed}×</span>}
        </p>
      </div>

      <Card title="Remove silences" hint="Detects dead air and jump-cuts it out. Captions and overlays re-time automatically.">
        <Seg options={SENSITIVITY.map((s) => ({ key: s.key, label: s.label, hint: s.hint }))} value={sens} onChange={setSens} />
        <div className="flex items-center gap-2">
          <button
            onClick={scanSilences}
            disabled={scanning}
            className="rounded-full bg-ember px-4 py-1.5 text-[11px] font-semibold text-ink transition hover:brightness-110 disabled:opacity-50"
          >
            {scanning ? "Scanning…" : cuts.silences.length ? "Re-scan" : "Remove silences"}
          </button>
          {cuts.silences.length > 0 && (
            <button onClick={() => onCuts({ ...cuts, silences: [] })} className="text-[11px] font-semibold text-paper-dim hover:text-paper">
              Restore ({cuts.silences.length})
            </button>
          )}
        </div>
        {scanMsg && <p className="text-[11px] text-ember">{scanMsg}</p>}
      </Card>

      <Card title="Cut filler words" hint={hasWords ? "Removes “um”, “uh”, “er” found in the transcript." : "Generate captions first — this uses the transcript."}>
        <div className="flex items-center gap-2">
          <button
            onClick={onCutFillers}
            disabled={!hasWords || fillerCount === 0}
            className="rounded-full border border-line-strong px-4 py-1.5 text-[11px] font-semibold text-paper transition hover:border-paper/40 disabled:opacity-40"
          >
            {fillerCount ? `Cut ${fillerCount} filler${fillerCount === 1 ? "" : "s"}` : hasWords ? "None found" : "Cut fillers"}
          </button>
          {cuts.fillers.length > 0 && (
            <button onClick={() => onCuts({ ...cuts, fillers: [] })} className="text-[11px] font-semibold text-paper-dim hover:text-paper">
              Restore ({cuts.fillers.length})
            </button>
          )}
        </div>
      </Card>

      {cutCount > 0 && (
        <button
          onClick={() => onCuts({ silences: [], fillers: [] })}
          className="w-full rounded-full border border-line-strong py-1.5 text-[11px] font-semibold text-paper-dim transition hover:text-paper"
        >
          Restore everything that was cut
        </button>
      )}

      <Card title="Speed">
        <Seg options={SPEEDS.map((v) => ({ key: v, label: `${v}×` }))} value={speed} onChange={onSpeed} />
      </Card>

      <Card title="Layout" hint="Fill crops to vertical. Fit keeps the whole frame over a blurred background.">
        <Seg
          options={[
            { key: "fill" as LayoutMode, label: "Fill (crop)" },
            { key: "fit" as LayoutMode, label: "Fit + blur" },
          ]}
          value={layout}
          onChange={onLayout}
        />
        {layout === "fit" && <p className="text-[11px] text-paper-dim/80">Reframe pan/zoom is ignored while Fit is on.</p>}
      </Card>

      <Card title="Audio" hint="Applied to the clip's own sound.">
        <Toggle label="Voice clean-up" hint="Cuts rumble and background hiss" checked={audio.denoise} onChange={(v) => onAudio({ ...audio, denoise: v })} />
        <Toggle label="Loudness boost" hint="Evens out volume to the short-form standard (-16 LUFS)" checked={audio.normalize} onChange={(v) => onAudio({ ...audio, normalize: v })} />
      </Card>

      <Card title="Polish" hint="Fades and the progress bar appear in the exported video.">
        <SliderRow label="Fade in" value={polish.fadeIn} min={0} max={2} step={0.1} format={(v) => (v ? `${v.toFixed(1)}s` : "Off")} onChange={(v) => onPolish({ ...polish, fadeIn: v })} />
        <SliderRow label="Fade out" value={polish.fadeOut} min={0} max={2} step={0.1} format={(v) => (v ? `${v.toFixed(1)}s` : "Off")} onChange={(v) => onPolish({ ...polish, fadeOut: v })} />
        <Toggle label="Progress bar" hint="A bar that fills as the video plays — boosts watch-through" checked={polish.progressBar.enabled} onChange={(v) => setBar({ enabled: v })} />
        {polish.progressBar.enabled && (
          <div className="space-y-3">
            <Seg
              options={[
                { key: "bottom" as const, label: "Bottom" },
                { key: "top" as const, label: "Top" },
              ]}
              value={polish.progressBar.position}
              onChange={(v) => setBar({ position: v })}
            />
            <SliderRow label="Thickness" value={polish.progressBar.height} min={4} max={40} step={1} format={(v) => `${v}px`} onChange={(v) => setBar({ height: v })} />
            <label className="flex items-center gap-2 rounded-lg border border-line-strong bg-ink-3 px-1.5 py-1">
              <input type="color" value={polish.progressBar.color} onChange={(e) => setBar({ color: e.target.value })} className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent" />
              <span className="font-mono text-[11px] uppercase text-paper-dim">{polish.progressBar.color}</span>
            </label>
          </div>
        )}
      </Card>
    </div>
  );
}
