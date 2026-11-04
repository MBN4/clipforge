"use client";

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return `${m}:${sec.padStart(4, "0")}`;
}

export function TrimPanel({
  duration,
  trim,
  onChange,
}: {
  duration: number;
  trim: { start: number; end: number };
  onChange: (t: { start: number; end: number }) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-sm font-semibold text-paper">Trim</h3>
        <p className="mt-1 text-xs text-paper-dim">
          Drag the handles on the timeline below the preview, or set exact times here.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[11px] text-paper-dim">Start</span>
          <input
            type="number"
            min={0}
            max={trim.end - 0.5}
            step={0.1}
            value={trim.start.toFixed(1)}
            onChange={(e) => onChange({ start: parseFloat(e.target.value) || 0, end: trim.end })}
            className="mt-1 w-full rounded-lg border border-line-strong bg-ink-3 px-3 py-2 font-mono text-sm text-paper"
          />
        </label>
        <label className="block">
          <span className="text-[11px] text-paper-dim">End</span>
          <input
            type="number"
            min={trim.start + 0.5}
            max={duration}
            step={0.1}
            value={trim.end.toFixed(1)}
            onChange={(e) => onChange({ start: trim.start, end: parseFloat(e.target.value) || duration })}
            className="mt-1 w-full rounded-lg border border-line-strong bg-ink-3 px-3 py-2 font-mono text-sm text-paper"
          />
        </label>
      </div>

      <p className="font-mono text-xs text-paper-dim">
        Selected: {fmt(trim.end - trim.start)} of {fmt(duration)}
      </p>

      <button
        onClick={() => onChange({ start: 0, end: duration })}
        className="rounded-full border border-line-strong px-4 py-2 text-xs font-semibold text-paper-dim transition hover:text-paper"
      >
        Reset to full clip
      </button>
    </div>
  );
}
