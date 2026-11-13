"use client";

import { useState } from "react";
import { PIPELINE, activeSeconds, fmtDur, fmtSpeed, jobTitle, speedX, stageBreakdown } from "@/lib/dashboard";
import type { ClientJob } from "@/lib/serialize";
import { Card, Label } from "./ui";

// Chart colours: single series = the brand accent; the four stage colours are the
// validated dark categorical slots (see PIPELINE in lib/dashboard.ts).

function niceMax(v: number) {
  const steps = [2, 5, 10, 20, 30, 50, 100, 200, 500];
  return steps.find((s) => s >= v) ?? Math.ceil(v / 100) * 100;
}

function Tip({ children, left }: { children: React.ReactNode; left: string }) {
  return (
    <div
      className="pointer-events-none absolute bottom-full z-20 mb-2 w-44 -translate-x-1/2 rounded-xl border border-white/15 bg-ink px-3 py-2 text-xs shadow-2xl shadow-black/60"
      style={{ left }}
    >
      {children}
    </div>
  );
}

/** Column chart: how many seconds of video were processed per second of work, per finished video. */
export function SpeedChart({ jobs, now }: { jobs: ClientJob[]; now: number }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const [hover, setHover] = useState<number | null>(null);

  const data = jobs
    .filter((j) => j.stage === "done")
    .sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0))
    .slice(-12)
    .map((j) => ({ job: j, speed: speedX(j, now) ?? 0, work: activeSeconds(j, now) }));

  const max = niceMax(Math.max(1, ...data.map((d) => d.speed)));
  const ticks = [max, max / 2, 0];

  return (
    <Card className="flex flex-col p-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-paper">Clipping speed</h3>
          <p className="mt-1 text-xs text-paper-dim">Seconds of video processed per second of work — higher is faster.</p>
        </div>
        <div className="inline-flex rounded-full border border-line-strong bg-ink-3 p-0.5 text-[11px]">
          {(["chart", "table"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`rounded-full px-3 py-1 font-semibold capitalize transition ${view === v ? "bg-paper text-ink" : "text-paper-dim hover:text-paper"}`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <p className="py-14 text-center text-sm text-paper-dim">Finish a video and its speed shows up here.</p>
      ) : view === "table" ? (
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-line text-paper-dim">
              <th className="py-2 font-mono font-normal uppercase tracking-wider">Video</th>
              <th className="py-2 text-right font-mono font-normal uppercase tracking-wider">Work</th>
              <th className="py-2 text-right font-mono font-normal uppercase tracking-wider">Speed</th>
            </tr>
          </thead>
          <tbody>
            {[...data].reverse().map((d) => (
              <tr key={d.job.id} className="border-b border-line/60 last:border-0">
                <td className="max-w-0 truncate py-2 pr-3 text-paper">{jobTitle(d.job)}</td>
                <td className="py-2 text-right tabular-nums text-paper-dim">{fmtDur(d.work)}</td>
                <td className="py-2 text-right tabular-nums text-paper">{fmtSpeed(d.speed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="flex min-h-48 flex-1 gap-3">
          <div className="flex flex-col justify-between pb-6 text-right font-mono text-[10px] tabular-nums text-paper-dim">
            {ticks.map((t) => (
              <span key={t}>{t}×</span>
            ))}
          </div>
          <div className="relative min-w-0 flex-1">
            <div className="pointer-events-none absolute inset-x-0 bottom-6 top-0 flex flex-col justify-between" aria-hidden>
              {ticks.map((t) => (
                <div key={t} className="h-px bg-white/[0.07]" />
              ))}
            </div>
            <div className="absolute inset-x-0 bottom-6 top-0 flex items-end gap-2" onMouseLeave={() => setHover(null)}>
              {data.map((d, i) => {
                const h = Math.max(2, (d.speed / max) * 100);
                const last = i === data.length - 1;
                return (
                  <div key={d.job.id} className="relative flex h-full flex-1 items-end justify-center" onMouseEnter={() => setHover(i)}>
                    <button
                      type="button"
                      aria-label={`${jobTitle(d.job)}: ${fmtSpeed(d.speed)} realtime`}
                      onFocus={() => setHover(i)}
                      onBlur={() => setHover(null)}
                      className="absolute inset-0 cursor-default outline-none"
                    />
                    <div
                      className={`relative w-full max-w-6 rounded-t-[4px] bg-ember transition-opacity ${hover != null && hover !== i ? "opacity-40" : ""}`}
                      style={{ height: `${h}%` }}
                    >
                      {last && <span className="absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[10px] tabular-nums text-paper">{fmtSpeed(d.speed)}</span>}
                    </div>
                    {hover === i && (
                      <Tip left="50%">
                        <p className="truncate font-medium text-paper">{jobTitle(d.job)}</p>
                        <p className="mt-1 font-mono text-[11px] text-paper-dim">
                          <span className="text-paper">{fmtSpeed(d.speed)}</span> realtime · {fmtDur(d.work)} · {d.job.clips.length} clips
                        </p>
                      </Tip>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="absolute inset-x-0 bottom-6 h-px bg-white/20" aria-hidden />
            <p className="absolute inset-x-0 bottom-0 flex justify-between font-mono text-[10px] text-paper-dim">
              <span>older</span>
              <span>latest</span>
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

/** Stacked bars: where each recent video spent its time, by stage. */
export function TimeSplit({ jobs }: { jobs: ClientJob[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const rows = jobs
    .filter((j) => j.stage === "done")
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))
    .slice(0, 6)
    .map((j) => {
      const parts = stageBreakdown(j);
      return { job: j, parts, total: parts.reduce((n, p) => n + p.ms, 0) };
    })
    .filter((r) => r.total > 0);
  const widest = Math.max(1, ...rows.map((r) => r.total));

  return (
    <Card className="p-5">
      <h3 className="font-display text-base font-semibold text-paper">Where the time goes</h3>
      <p className="mt-1 text-xs text-paper-dim">Time spent in each stage for your latest videos.</p>

      <ul className="mb-5 mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {PIPELINE.map((p) => (
          <li key={p.key} className="flex items-center gap-2 text-xs text-paper-dim">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: p.color }} /> {p.label}
          </li>
        ))}
      </ul>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-paper-dim">Stage timings appear after your first finished video.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.job.id} className="relative" onMouseLeave={() => setHover(null)}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate text-paper">{jobTitle(r.job)}</span>
                <span className="shrink-0 font-mono tabular-nums text-paper-dim">{fmtDur(r.total / 1000)}</span>
              </div>
              <div className="flex h-3 gap-[2px]" style={{ width: `${Math.max(12, (r.total / widest) * 100)}%` }}>
                {r.parts
                  .filter((p) => p.ms > 0)
                  .map((p) => (
                    <div
                      key={p.key}
                      tabIndex={0}
                      aria-label={`${p.label}: ${fmtDur(p.ms / 1000)}`}
                      onMouseEnter={() => setHover(`${r.job.id}:${p.key}`)}
                      onFocus={() => setHover(`${r.job.id}:${p.key}`)}
                      onBlur={() => setHover(null)}
                      className={`rounded-[3px] outline-none transition-opacity first:rounded-l-[5px] last:rounded-r-[5px] ${hover && hover !== `${r.job.id}:${p.key}` ? "opacity-40" : ""}`}
                      style={{ flex: p.ms, background: p.color, minWidth: 3 }}
                    />
                  ))}
              </div>
              {hover?.startsWith(r.job.id) && (
                <Tip left="50%">
                  {r.parts.map((p) => (
                    <p key={p.key} className="flex items-center justify-between gap-3 font-mono text-[11px] text-paper-dim">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-[2px]" style={{ background: p.color }} />
                        {p.short}
                      </span>
                      <span className="tabular-nums text-paper">{fmtDur(p.ms / 1000)}</span>
                    </p>
                  ))}
                </Tip>
              )}
            </li>
          ))}
        </ul>
      )}
      <Label className="mt-5 block text-paper-dim/60">Includes any time a stage spent waiting its turn</Label>
    </Card>
  );
}
