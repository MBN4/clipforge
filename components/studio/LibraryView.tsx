"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { ArrowRight, Captions, Clapperboard, Loader, Search, Trash2, X } from "lucide-react";
import { useDashboard } from "./DashboardProvider";
import { ClipCard } from "./ClipCard";
import { Select } from "@/components/ui/Select";
import { BulkCaptionsDialog } from "./BulkCaptionsDialog";
import { EmptyState, PageHeader } from "./ui";
import { jobTitle } from "@/lib/dashboard";
import { fmtTimestamp } from "@/lib/clipCount";

type Sort = "newest" | "score" | "longest" | "shortest";

export function LibraryView() {
  const { jobs, loaded, refresh, toast } = useDashboard();
  const router = useRouter();
  const params = useSearchParams();
  const jobFilter = params.get("job") ?? "";
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  // selected clips, keyed "<jobId>:<clipIndex>"
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [captioning, setCaptioning] = useState(false);

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

  // the video being filtered on lost all its clips (e.g. they were just deleted): go back to everything
  useEffect(() => {
    if (loaded && jobFilter && !doneJobs.some((j) => j.id === jobFilter)) router.replace("/studio/library", { scroll: false });
  }, [loaded, jobFilter, doneJobs, router]);

  const total = doneJobs.reduce((n, j) => n + j.clips.length, 0);
  const selected = doneJobs.find((j) => j.id === jobFilter);

  const keyOf = (jobId: string, index: number) => `${jobId}:${index}`;
  // only count selections that are still on screen (a filter change shouldn't delete hidden clips)
  const visibleKeys = useMemo(() => clips.map(({ clip, job }) => keyOf(job.id, clip.index)), [clips]);
  const chosen = useMemo(() => clips.filter(({ clip, job }) => picked.has(keyOf(job.id, clip.index))), [clips, picked]);
  const allPicked = clips.length > 0 && chosen.length === clips.length;

  function toggle(key: string) {
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }
  const selectAll = () => setPicked(new Set(visibleKeys));
  const clearPicked = () => setPicked(new Set());

  async function deleteChosen(what: "selected" | "all") {
    const targets = what === "all" ? clips : chosen;
    if (!targets.length) return;
    const n = targets.length;
    const msg =
      what === "all"
        ? `Delete all ${n} ${n === 1 ? "clip" : "clips"} shown? This permanently removes the clip files.`
        : `Delete ${n} selected ${n === 1 ? "clip" : "clips"}? This permanently removes the clip files.`;
    if (!window.confirm(msg)) return;
    setDeleting(true);
    try {
      const byJob = new Map<string, number[]>();
      for (const { clip, job } of targets) byJob.set(job.id, [...(byJob.get(job.id) ?? []), clip.index]);
      let failed = 0;
      for (const [jobId, indexes] of byJob) {
        const res = await fetch(`/api/jobs/${jobId}/clips`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ indexes }),
        });
        if (!res.ok) failed += indexes.length;
      }
      clearPicked();
      await refresh();
      if (failed) toast("Some clips weren't deleted", `${failed} could not be removed.`);
      else toast(n === 1 ? "Clip deleted" : `${n} clips deleted`);
    } finally {
      setDeleting(false);
    }
  }

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
            <Select
              value={jobFilter}
              onChange={setJob}
              ariaLabel="Filter by video"
              className="sm:w-56"
              menuWidth={400}
              options={[{ value: "", label: "All videos" }, ...doneJobs.map((j) => ({ value: j.id, label: jobTitle(j) }))]}
            />
            <Select
              value={sort}
              onChange={setSort}
              ariaLabel="Sort clips"
              className="sm:w-40"
              options={[
                { value: "newest", label: "Newest" },
                { value: "score", label: "Top score" },
                { value: "longest", label: "Longest" },
                { value: "shortest", label: "Shortest" },
              ]}
            />
          </div>

          {selected && (
            <div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-ember/40 bg-ember/10 py-1.5 pl-4 pr-2 text-xs text-ember-soft">
              <span className="truncate">Showing clips from {jobTitle(selected)}</span>
              <button onClick={() => setJob("")} aria-label="Show all videos" className="rounded-full p-1 transition hover:bg-white/10">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {clips.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-ink-2/60 px-3 py-2.5">
              <button
                type="button"
                role="checkbox"
                aria-checked={allPicked}
                onClick={() => (allPicked ? clearPicked() : selectAll())}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-paper transition hover:bg-white/5"
              >
                <span className={`flex h-4 w-4 items-center justify-center rounded border ${allPicked ? "border-ember bg-ember" : chosen.length ? "border-ember" : "border-paper-dim"}`}>
                  {allPicked ? <span className="text-[10px] leading-none text-ink">✓</span> : chosen.length ? <span className="h-0.5 w-2 bg-ember" /> : null}
                </span>
                {allPicked ? "Deselect all" : "Select all"}
              </button>
              <span className="text-xs text-paper-dim">{chosen.length ? `${chosen.length} selected` : `${clips.length} shown`}</span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {chosen.length > 0 && (
                  <>
                    <button
                      onClick={() => setCaptioning(true)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:bg-ember"
                    >
                      <Captions className="h-3.5 w-3.5" /> Add captions
                    </button>
                    <button
                      onClick={() => deleteChosen("selected")}
                      disabled={deleting}
                      className="inline-flex items-center gap-1.5 rounded-full border border-red-400/50 px-3.5 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-400/10 disabled:opacity-50"
                    >
                      {deleting ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete
                    </button>
                    <button onClick={clearPicked} className="text-xs text-paper-dim transition hover:text-paper">
                      Clear
                    </button>
                  </>
                )}
                <button
                  onClick={() => deleteChosen("all")}
                  disabled={deleting}
                  className="text-xs text-paper-dim transition hover:text-red-300 disabled:opacity-50"
                >
                  Delete all
                </button>
              </div>
            </div>
          )}

          {clips.length === 0 ? (
            <p className="py-16 text-center text-sm text-paper-dim">No clips match that search.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">
              <AnimatePresence initial={false}>
                {clips.map(({ clip, job }, i) => (
                  <ClipCard
                    key={clip.id}
                    clip={clip}
                    index={i}
                    jobId={job.id}
                    videoTitle={jobTitle(job)}
                    section={job.request?.range ? `${fmtTimestamp(job.request.range.start)}–${fmtTimestamp(job.request.range.end)}` : undefined}
                    selected={picked.has(keyOf(job.id, clip.index))}
                    onToggle={() => toggle(keyOf(job.id, clip.index))}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      {captioning && (
        <BulkCaptionsDialog
          items={chosen.map(({ clip, job }) => ({ jobId: job.id, clip, label: clip.title }))}
          onClose={() => setCaptioning(false)}
          onDone={() => void refresh()}
        />
      )}
    </>
  );
}
