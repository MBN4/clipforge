"use client";

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return `${m}:${sec.padStart(4, "0")}`;
}

const MIN_GAP = 1;

export function TrimBar({
  duration,
  trim,
  currentTime,
  onChange,
  onSeek,
}: {
  duration: number;
  trim: { start: number; end: number };
  currentTime: number;
  onChange: (trim: { start: number; end: number }) => void;
  onSeek: (t: number) => void;
}) {
  function setStart(v: number) {
    onChange({ start: Math.min(v, trim.end - MIN_GAP), end: trim.end });
  }
  function setEnd(v: number) {
    onChange({ start: trim.start, end: Math.max(v, trim.start + MIN_GAP) });
  }

  const startPct = (trim.start / duration) * 100;
  const endPct = (trim.end / duration) * 100;
  const playheadPct = (currentTime / duration) * 100;

  return (
    <div className="w-full max-w-2xl">
      <div className="relative h-8">
        <div
          className="absolute top-1/2 h-2 w-full -translate-y-1/2 cursor-pointer rounded-full bg-ink-3"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            onSeek(Math.max(trim.start, Math.min(trim.end, pct * duration)));
          }}
        />
        <div
          className="pointer-events-none absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-ember/70"
          style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
        />
        <div
          className="pointer-events-none absolute top-0 h-8 w-0.5 bg-paper"
          style={{ left: `${playheadPct}%` }}
        />
        <input
          type="range"
          min={0}
          max={duration}
          step={0.05}
          value={trim.start}
          onChange={(e) => setStart(parseFloat(e.target.value))}
          className="range-thumb pointer-events-none absolute top-1/2 h-8 w-full -translate-y-1/2 appearance-none bg-transparent"
        />
        <input
          type="range"
          min={0}
          max={duration}
          step={0.05}
          value={trim.end}
          onChange={(e) => setEnd(parseFloat(e.target.value))}
          className="range-thumb pointer-events-none absolute top-1/2 h-8 w-full -translate-y-1/2 appearance-none bg-transparent"
        />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[11px] text-paper-dim">
        <span>{fmt(trim.start)}</span>
        <span className="text-paper">{fmt(currentTime)}</span>
        <span>{fmt(trim.end)}</span>
      </div>

      <style jsx>{`
        .range-thumb::-webkit-slider-thumb {
          pointer-events: auto;
          appearance: none;
          width: 14px;
          height: 24px;
          border-radius: 4px;
          background: var(--paper);
          border: 2px solid var(--ember);
          cursor: ew-resize;
        }
        .range-thumb::-moz-range-thumb {
          pointer-events: auto;
          width: 14px;
          height: 24px;
          border-radius: 4px;
          background: var(--paper);
          border: 2px solid var(--ember);
          cursor: ew-resize;
        }
      `}</style>
    </div>
  );
}
