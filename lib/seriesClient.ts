import type { ClientJob } from "./serialize";

// Client-side helpers for long videos that are clipped in consecutive parts (see lib/series.ts).

/** The newest part of each series, keyed by series id. */
export function latestParts(jobs: ClientJob[]): Map<string, ClientJob> {
  const out = new Map<string, ClientJob>();
  for (const j of jobs) {
    if (!j.series) continue;
    const cur = out.get(j.series.id);
    if (!cur || j.series.index > cur.series!.index) out.set(j.series.id, j);
  }
  return out;
}

export interface SeriesSummary {
  parts: number;
  doneParts: number;
  /** seconds of the source actually clipped so far */
  clipped: number;
  /** where the first part started */
  from: number;
  /** footage still to do after the cursor (ignoring skipped ranges) */
  remaining: number;
}

export function summarize(jobs: ClientJob[], seriesId: string): SeriesSummary {
  const parts = jobs.filter((j) => j.series?.id === seriesId);
  const latest = parts.reduce((a, b) => (b.series!.index > a.series!.index ? b : a));
  const s = latest.series!;
  const len = (j: ClientJob) => (j.request?.range ? j.request.range.end - j.request.range.start : 0);
  const skippedAhead = s.skipped.filter((k) => k.end > s.cursor).reduce((n, k) => n + Math.min(k.end, s.videoEnd) - Math.max(k.start, s.cursor), 0);
  return {
    parts: parts.length,
    doneParts: parts.filter((j) => j.stage === "done").length,
    clipped: parts.filter((j) => j.stage === "done").reduce((n, j) => n + len(j), 0),
    from: Math.min(...parts.map((j) => j.request?.range?.start ?? 0)),
    remaining: Math.max(0, s.videoEnd - s.cursor - skippedAhead),
  };
}

/** "1:23:45", "23:45" or plain seconds -> seconds, or null if it isn't a time. */
export function parseClock(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return parseFloat(t);
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})$/.exec(t);
  if (!m) return null;
  const [, h, mm, ss] = m;
  if (Number(mm) > 59 || Number(ss) > 59) return null;
  return Number(h ?? 0) * 3600 + Number(mm) * 60 + Number(ss);
}
