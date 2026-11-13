"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Clapperboard, Clock, FileVideo, Link2, Loader, Scissors, Upload, X } from "lucide-react";
import { clipCountRange } from "@/lib/clipCount";
import { fmtBytes, readFileDuration } from "@/lib/clientMedia";
import { fmtDur } from "@/lib/dashboard";
import { RangePicker } from "./RangePicker";
import { useDashboard, type NewJobInput } from "./DashboardProvider";
import { Card, Label } from "./ui";

type Status = "probing" | "ready" | "error" | "submitting";

interface Item {
  key: string;
  kind: "url" | "file";
  url?: string;
  file?: File;
  title: string;
  platform?: string;
  thumbnail?: string;
  duration?: number;
  status: Status;
  error?: string;
  upload?: number;
  clipCount: number;
  useRange: boolean;
  rangeStart: number;
  rangeEnd: number;
}

const RANGE_THRESHOLD = 150; // below this, trimming to a section isn't worth the UI
const MAX_ITEMS = 25;

// at most `n` tasks in flight at once
function limiter(n: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    if (active >= n || !queue.length) return;
    active++;
    queue.shift()!();
  };
  return <T,>(fn: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      queue.push(() =>
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          })
      );
      next();
    });
}
const probeLimit = limiter(2);
const uploadLimit = limiter(2);

let seq = 0;
const newKey = () => `item-${Date.now().toString(36)}-${seq++}`;

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function ItemCard({
  item,
  onChange,
  onRemove,
}: {
  item: Item;
  onChange: (patch: Partial<Item>) => void;
  onRemove: () => void;
}) {
  const dur = item.duration ?? 0;
  const range = clipCountRange(item.useRange ? item.rangeEnd - item.rangeStart : dur);
  const busy = item.status === "submitting";

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.28 }}
    >
      <Card className="p-4">
        <div className="flex gap-4">
          <div className="relative hidden aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-ink-3 to-ink sm:block">
            {item.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.thumbnail} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-paper-dim/50">
                {item.kind === "file" ? <FileVideo className="h-6 w-6" strokeWidth={1.5} /> : <Link2 className="h-6 w-6" strokeWidth={1.5} />}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-paper" title={item.title}>
                  {item.title}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-paper-dim">
                  <span className="inline-flex items-center gap-1">
                    {item.kind === "file" ? <Upload className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
                    {item.kind === "file" ? (item.file ? fmtBytes(item.file.size) : "File") : (item.platform ?? hostOf(item.url ?? ""))}
                  </span>
                  {dur > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {fmtDur(dur)}
                    </span>
                  )}
                </p>
              </div>
              {!busy && (
                <button onClick={onRemove} aria-label="Remove from batch" className="rounded-lg p-1.5 text-paper-dim transition hover:bg-white/[0.06] hover:text-paper">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {item.status === "probing" && (
              <p className="mt-3 flex items-center gap-2 font-mono text-xs text-paper-dim">
                <Loader className="h-3.5 w-3.5 animate-spin" /> Reading video…
              </p>
            )}

            {item.status === "error" && (
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                <span className="flex items-center gap-1.5 text-red-300">
                  <AlertTriangle className="h-3.5 w-3.5" /> {item.error}
                </span>
                <button
                  onClick={() => onChange({ status: "ready", error: undefined, clipCount: clipCountRange(0).default })}
                  className="rounded-md border border-line-strong px-2 py-1 font-semibold text-paper-dim transition hover:text-paper"
                >
                  Keep anyway
                </button>
              </div>
            )}

            {item.status === "ready" && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-4">
                  <Label className="w-14 shrink-0">Clips</Label>
                  <input
                    type="range"
                    min={range.min}
                    max={range.max}
                    value={Math.min(item.clipCount, range.max)}
                    onChange={(e) => onChange({ clipCount: parseInt(e.target.value, 10) })}
                    aria-label={`Number of clips for ${item.title}`}
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-ink-3 accent-ember"
                  />
                  <span className="w-8 text-right font-display text-xl font-semibold tabular-nums text-ember">{Math.min(item.clipCount, range.max)}</span>
                </div>

                {dur > RANGE_THRESHOLD && (
                  <div>
                    <div className="inline-flex rounded-full border border-line-strong bg-ink-3 p-0.5 text-[11px]">
                      {[false, true].map((on) => (
                        <button
                          key={String(on)}
                          onClick={() => {
                            const end = item.rangeEnd || dur;
                            onChange({ useRange: on, rangeEnd: end, clipCount: clipCountRange(on ? end - item.rangeStart : dur).default });
                          }}
                          className={`rounded-full px-3 py-1 font-semibold transition ${item.useRange === on ? "bg-paper text-ink" : "text-paper-dim hover:text-paper"}`}
                        >
                          {on ? "Pick a section" : "Whole video"}
                        </button>
                      ))}
                    </div>
                    {item.useRange && (
                      <div className="mt-3 rounded-xl border border-line-strong bg-ink/50 p-3">
                        <RangePicker
                          duration={dur}
                          start={item.rangeStart}
                          end={item.rangeEnd}
                          onChange={(s, e) => onChange({ rangeStart: s, rangeEnd: e, clipCount: clipCountRange(e - s).default })}
                        />
                      </div>
                    )}
                  </div>
                )}
                {item.error && <p className="text-xs text-red-300">{item.error}</p>}
              </div>
            )}

            {busy && (
              <div className="mt-4">
                <div className="mb-1.5 flex justify-between font-mono text-[11px] text-paper-dim">
                  <span>{item.kind === "file" && (item.upload ?? 0) < 100 ? "Uploading…" : "Adding to the queue…"}</span>
                  {item.kind === "file" && <span className="tabular-nums text-paper">{item.upload ?? 0}%</span>}
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r from-ember to-ember-soft transition-all duration-300 ${item.kind === "url" ? "w-full animate-pulse" : ""}`}
                    style={item.kind === "file" ? { width: `${item.upload ?? 0}%` } : undefined}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.li>
  );
}

export function BatchComposer() {
  const router = useRouter();
  const { submitJob, toast } = useDashboard();
  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [starting, setStarting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const patch = useCallback((key: string, p: Partial<Item>) => setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...p } : i))), []);

  const probeUrl = useCallback(
    (key: string, url: string) =>
      probeLimit(async () => {
        try {
          const res = await fetch("/api/probe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Couldn't read that video");
          patch(key, {
            status: "ready",
            title: data.title || url,
            thumbnail: data.thumbnail,
            platform: data.platform,
            duration: data.duration,
            rangeEnd: data.duration,
            clipCount: clipCountRange(data.duration).default,
          });
        } catch (e) {
          patch(key, { status: "error", error: e instanceof Error ? e.message : "Couldn't read that video" });
        }
      }),
    [patch]
  );

  function addLinks(raw: string) {
    const tokens = raw.split(/[\s,]+/).filter(Boolean);
    const urls = [...new Set(tokens.filter((t) => /^https?:\/\//i.test(t)))];
    const skipped = tokens.length - tokens.filter((t) => /^https?:\/\//i.test(t)).length;
    const have = new Set(items.map((i) => i.url).filter(Boolean));
    const fresh = urls.filter((u) => !have.has(u)).slice(0, Math.max(0, MAX_ITEMS - items.length));
    if (!fresh.length) {
      setNote(urls.length ? "Those links are already in your batch." : "No links found — paste full URLs starting with http(s)://");
      return;
    }
    const added: Item[] = fresh.map((url) => ({
      key: newKey(),
      kind: "url",
      url,
      title: hostOf(url),
      status: "probing",
      clipCount: 3,
      useRange: false,
      rangeStart: 0,
      rangeEnd: 0,
    }));
    setItems((cur) => [...cur, ...added]);
    added.forEach((a) => void probeUrl(a.key, a.url!));
    setText("");
    setNote(skipped > 0 ? `Skipped ${skipped} ${skipped === 1 ? "entry" : "entries"} that weren't links.` : null);
  }

  function addFiles(list: FileList | File[]) {
    const all = Array.from(list);
    const videos = all.filter((f) => f.type.startsWith("video/") || /\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(f.name));
    const room = Math.max(0, MAX_ITEMS - items.length);
    const added: Item[] = videos.slice(0, room).map((file) => ({
      key: newKey(),
      kind: "file",
      file,
      title: file.name,
      status: "probing",
      clipCount: 3,
      useRange: false,
      rangeStart: 0,
      rangeEnd: 0,
    }));
    setNote(videos.length < all.length ? `Skipped ${all.length - videos.length} ${all.length - videos.length === 1 ? "file" : "files"} that aren't videos.` : null);
    if (!added.length) return;
    setItems((cur) => [...cur, ...added]);
    added.forEach(async (a) => {
      const duration = await readFileDuration(a.file!);
      patch(a.key, { status: "ready", duration, rangeEnd: duration, clipCount: clipCountRange(duration).default });
    });
  }

  async function start() {
    const ready = items.filter((i) => i.status === "ready");
    if (!ready.length || starting) return;
    setStarting(true);
    ready.forEach((i) => patch(i.key, { status: "submitting", upload: 0, error: undefined }));

    const results = await Promise.all(
      ready.map(async (i) => {
        const max = clipCountRange(i.useRange ? i.rangeEnd - i.rangeStart : (i.duration ?? 0)).max;
        const base = {
          clipCount: Math.min(i.clipCount, max),
          duration: i.duration || undefined,
          range: i.useRange ? { start: i.rangeStart, end: i.rangeEnd } : undefined,
        };
        const input: NewJobInput =
          i.kind === "url"
            ? { kind: "url", url: i.url!, title: i.title, thumbnail: i.thumbnail, ...base }
            : { kind: "file", file: i.file!, title: i.title, ...base };
        const run = () => submitJob(input, (pct) => patch(i.key, { upload: pct }));
        try {
          await (i.kind === "file" ? uploadLimit(run) : run());
          return { key: i.key, ok: true as const };
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Failed to start";
          patch(i.key, { status: "ready", error: msg, upload: undefined });
          return { key: i.key, ok: false as const };
        }
      })
    );

    const okKeys = new Set(results.filter((r) => r.ok).map((r) => r.key));
    setItems((cur) => cur.filter((i) => !okKeys.has(i.key)));
    setStarting(false);
    if (okKeys.size) {
      toast(`${okKeys.size} ${okKeys.size === 1 ? "video" : "videos"} queued`, "They're processing in parallel — track them in the Queue.");
      if (okKeys.size === results.length) router.push("/studio/queue");
    }
  }

  const ready = items.filter((i) => i.status === "ready");
  const probing = items.filter((i) => i.status === "probing").length;
  const totalClips = ready.reduce((n, i) => n + Math.min(i.clipCount, clipCountRange(i.useRange ? i.rangeEnd - i.rangeStart : (i.duration ?? 0)).max), 0);
  const footage = ready.reduce((n, i) => n + (i.useRange ? i.rangeEnd - i.rangeStart : (i.duration ?? 0)), 0);

  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-ember" />
            <h2 className="font-display text-base font-semibold text-paper">Paste links</h2>
          </div>
          <p className="mb-3 text-xs text-paper-dim">YouTube, Instagram, TikTok or Facebook — one per line, or paste a whole list.</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text");
              if (/https?:\/\//i.test(pasted)) {
                e.preventDefault();
                addLinks(pasted);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) addLinks(text);
            }}
            rows={5}
            placeholder={"https://youtube.com/watch?v=…\nhttps://www.tiktok.com/@…\nhttps://www.instagram.com/reel/…"}
            className="w-full resize-none rounded-xl border border-line-strong bg-ink/60 px-4 py-3 font-mono text-xs leading-relaxed text-paper outline-none transition placeholder:text-paper-dim/50 focus:border-ember"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-[11px] text-paper-dim/70">Ctrl/⌘ + Enter to add</span>
            <button
              onClick={() => addLinks(text)}
              disabled={!text.trim()}
              className="rounded-full bg-paper px-5 py-2 text-xs font-semibold text-ink transition hover:bg-ember disabled:opacity-40 disabled:hover:bg-paper"
            >
              Add links
            </button>
          </div>
        </Card>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
          role="button"
          tabIndex={0}
          className={`flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
            dragOver ? "border-ember bg-ember/[0.07]" : "border-line-strong bg-ink-2/50 hover:border-white/30"
          }`}
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-line-strong bg-ink-3 text-ember">
            <Upload className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <p className="font-display text-base font-semibold text-paper">Drop video files</p>
          <p className="mt-1 text-xs text-paper-dim">or click to browse — select as many as you like (mp4, mov, mkv…)</p>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {note && <p className="mt-3 text-xs text-paper-dim">{note}</p>}

      <div className="mb-3 mt-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-lg font-semibold text-paper">Your batch</h2>
          {items.length > 0 && <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[11px] tabular-nums text-paper-dim">{items.length}</span>}
        </div>
        {items.length > 0 && !starting && (
          <button onClick={() => setItems([])} className="text-xs text-paper-dim transition hover:text-paper">
            Clear all
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <Card className="flex flex-col items-center px-6 py-14 text-center">
          <Clapperboard className="h-7 w-7 text-paper-dim/60" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-paper-dim">Nothing here yet. Add a few videos above — you can clip them all at once.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {items.map((i) => (
              <ItemCard key={i.key} item={i} onChange={(p) => patch(i.key, p)} onRemove={() => setItems((cur) => cur.filter((x) => x.key !== i.key))} />
            ))}
          </AnimatePresence>
        </ul>
      )}

      {items.length > 0 && (
        <div className="sticky bottom-20 z-20 mt-6 lg:bottom-6">
          <div className="flex flex-col gap-3 rounded-2xl border border-white/15 bg-ink/85 p-4 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-[11px] text-paper-dim">
              <span>
                <span className="tabular-nums text-paper">{ready.length}</span> ready
              </span>
              {probing > 0 && (
                <span className="flex items-center gap-1.5">
                  <Loader className="h-3 w-3 animate-spin" /> {probing} reading
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Scissors className="h-3 w-3" />
                <span className="tabular-nums text-paper">{totalClips}</span> clips
              </span>
              {footage > 0 && <span className="tabular-nums">{fmtDur(footage)} of footage</span>}
            </div>
            <button
              onClick={start}
              disabled={!ready.length || starting}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-ember px-7 py-3 text-sm font-semibold text-ink shadow-[0_10px_40px_-10px_var(--ember)] transition hover:brightness-110 disabled:opacity-40"
            >
              {starting ? "Starting…" : `Clip ${ready.length} ${ready.length === 1 ? "video" : "videos"}`}
              {!starting && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
