"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { ArrowRight, Clapperboard, Search, X } from "lucide-react";
import { useDashboard } from "./DashboardProvider";
import { ClipCard } from "./ClipCard";
import { EmptyState, PageHeader } from "./ui";
import { jobTitle } from "@/lib/dashboard";

type Sort = "newest" | "score" | "longest" | "shortest";

export function LibraryView() {
  const { jobs, loaded } = useDashboard();
  const router = useRouter();
  const params = useSearchParams();
  const jobFilter = params.get("job") ?? "";
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("newest");

  const doneJobs = useMemo(() => jobs.filter((j) => j.stage === "done" && j.clips.length > 0), [jobs]);

  const clips = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = doneJobs
      .filter((j) => !jobFilter || j.id === jobFilter)
      .flatMap((j) => j.clips.map((c) => ({ clip: c, job: j, at: j.finishedAt ?? j.updatedAt })))
      .filter(({ clip, job }) => !q || `${clip.title} ${clip.hook} ${clip.reason} ${jobTitle(job)}`.toLowerCase().includes(q));
    const by: Record<Sort, (a: (typeof all)[number], b: (typeof all)[number]) => number> = {
      newest: (a, b) => b.at - a.at || a.clip.index - b.clip.index,
      score: (a, b) => b.clip.score - a.clip.score,
      longest: (a, b) => b.clip.duration - a.clip.duration,
      shortest: (a, b) => a.clip.duration - b.clip.duration,
    };
    return all.sort(by[sort]);
  }, [doneJobs, jobFilter, query, sort]);

  const total = doneJobs.reduce((n, j) => n + j.clips.length, 0);
  const selected = doneJobs.find((j) => j.id === jobFilter);

  function setJob(id: string) {
    router.replace(id ? `/studio/library?job=${id}` : "/studio/library", { scroll: false });
  }

  return (
    <>
      <PageHeader title="Library" subtitle={total ? `${total} ${total === 1 ? "clip" : "clips"} from ${doneJobs.length} ${doneJobs.length === 1 ? "video" : "videos"}.` : "Every finished clip from every video."} />

      {!loaded ? (
        <div className="h-64 animate-pulse rounded-2xl border border-line bg-ink-2/60" />
      ) : doneJobs.length === 0 ? (
        <EmptyState icon={Clapperboard} title="No clips yet" body="Finished clips from all your videos collect here, ready to edit and download.">
          <Link href="/studio/new" className="inline-flex items-center gap-2 rounded-full bg-ember px-6 py-3 text-sm font-semibold text-ink transition hover:brightness-110">
            Add videos <ArrowRight className="h-4 w-4" />
          </Link>
        </EmptyState>
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-paper-dim" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search clips by title or topic…"
                className="w-full rounded-xl border border-line-strong bg-ink-2 py-3 pl-11 pr-4 text-sm text-paper outline-none transition placeholder:text-paper-dim/60 focus:border-ember"
              />
            </label>
            <select
              value={jobFilter}
              onChange={(e) => setJob(e.target.value)}
              aria-label="Filter by video"
              className="rounded-xl border border-line-strong bg-ink-2 px-4 py-3 text-sm text-paper outline-none transition focus:border-ember sm:w-56"
            >
              <option value="">All videos</option>
              {doneJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {jobTitle(j).slice(0, 48)}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label="Sort clips"
              className="rounded-xl border border-line-strong bg-ink-2 px-4 py-3 text-sm text-paper outline-none transition focus:border-ember sm:w-40"
            >
              <option value="newest">Newest</option>
              <option value="score">Top score</option>
              <option value="longest">Longest</option>
              <option value="shortest">Shortest</option>
            </select>
          </div>

          {selected && (
            <div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-ember/40 bg-ember/10 py-1.5 pl-4 pr-2 text-xs text-ember-soft">
              <span className="truncate">Showing clips from {jobTitle(selected)}</span>
              <button onClick={() => setJob("")} aria-label="Show all videos" className="rounded-full p-1 transition hover:bg-white/10">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {clips.length === 0 ? (
            <p className="py-16 text-center text-sm text-paper-dim">No clips match that search.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">
              <AnimatePresence initial={false}>
                {clips.map(({ clip, job }, i) => (
                  <ClipCard key={clip.id} clip={clip} index={i} jobId={job.id} videoTitle={jobTitle(job)} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </>
  );
}
