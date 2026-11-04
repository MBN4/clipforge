"use client";

function fmtTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const MIN_GAP = 10;

export function RangePicker({
  duration,
  start,
  end,
  onChange,
}: {
  duration: number;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
}) {
  function setStart(v: number) {
    onChange(Math.min(v, end - MIN_GAP), end);
  }
  function setEnd(v: number) {
    onChange(start, Math.max(v, start + MIN_GAP));
  }

  const startPct = (start / duration) * 100;
  const endPct = (end / duration) * 100;

  return (
    <div>
      <div className="relative h-6">
        <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-ink-3" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-ember"
          style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
        />
        <input
          type="range"
          min={0}
          max={duration}
          step={1}
          value={start}
          onChange={(e) => setStart(parseFloat(e.target.value))}
          className="range-thumb pointer-events-none absolute top-1/2 h-6 w-full -translate-y-1/2 appearance-none bg-transparent"
        />
        <input
          type="range"
          min={0}
          max={duration}
          step={1}
          value={end}
          onChange={(e) => setEnd(parseFloat(e.target.value))}
          className="range-thumb pointer-events-none absolute top-1/2 h-6 w-full -translate-y-1/2 appearance-none bg-transparent"
        />
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-paper-dim">
        <span>{fmtTime(start)}</span>
        <span className="text-paper">{fmtTime(end - start)} selected</span>
        <span>{fmtTime(end)}</span>
      </div>

      <style jsx>{`
        .range-thumb::-webkit-slider-thumb {
          pointer-events: auto;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: var(--paper);
          border: 2px solid var(--ember);
          cursor: pointer;
        }
        .range-thumb::-moz-range-thumb {
          pointer-events: auto;
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: var(--paper);
          border: 2px solid var(--ember);
          cursor: pointer;
        }
        .range-thumb::-webkit-slider-runnable-track {
          background: transparent;
        }
      `}</style>
    </div>
  );
}
