import fs from "node:fs";
import path from "node:path";
import { ffmpeg, run, trimSource } from "./ffmpeg";
import { cancelRequested } from "./scheduler";

// Downloads ONLY a time window of a long YouTube video.
//
// Why this exists: for a 10-hour stream recording, ffmpeg's `-ss` (what yt-dlp's --download-sections
// uses) crawls at ~1 frame/second — it hits YouTube with one long un-chunked request, which YouTube
// throttles, and it has to scan a huge index first. Instead we read the stream's segment index
// (the MP4 `sidx` box), work out which bytes cover the window, and fetch just those in 8 MiB
// chunks (the size YouTube doesn't throttle), the same trick yt-dlp's own downloader uses.

export class NotSliceable extends Error {}

const CHUNK = 8 * 1024 * 1024;
const PARALLEL = 4;
const HEAD = 2 * 1024 * 1024; // enough for ftyp + moov + sidx of even a 10-hour video
const FORMAT = "bv*[height<=1080][ext=mp4]+ba[ext=m4a]";

interface Stream {
  url: string;
  headers: Record<string, string>;
  ext: string;
}

interface SidxEntry {
  offset: number; // absolute byte offset of this segment in the file
  size: number;
  start: number; // seconds
  end: number;
}

interface Plan {
  initEnd: number; // bytes [0, initEnd) are the init segment (ftyp + moov)
  first: SidxEntry;
  last: SidxEntry;
}

async function streamsFor(url: string): Promise<{ video: Stream; audio: Stream }> {
  const { stdout } = await run("yt-dlp", ["--no-playlist", "--no-warnings", "--dump-single-json", "-f", FORMAT, url]);
  const info = JSON.parse(stdout);
  const fm = info.requested_formats as { url: string; http_headers?: Record<string, string>; ext?: string; protocol?: string; vcodec?: string; acodec?: string }[] | undefined;
  if (!fm || fm.length !== 2) throw new NotSliceable("not a separate video + audio download");
  const pick = (f: (typeof fm)[number]): Stream => {
    if (f.protocol && !/^https?$/.test(f.protocol)) throw new NotSliceable(`protocol ${f.protocol}`);
    return { url: f.url, headers: f.http_headers ?? {}, ext: f.ext ?? "mp4" };
  };
  const video = fm.find((f) => f.vcodec && f.vcodec !== "none");
  const audio = fm.find((f) => f.acodec && f.acodec !== "none");
  if (!video || !audio) throw new NotSliceable("no video/audio pair");
  return { video: pick(video), audio: pick(audio) };
}

async function getRange(s: Stream, a: number, b: number): Promise<Buffer> {
  const u = new URL(s.url);
  u.searchParams.set("range", `${a}-${b}`); // YouTube's own chunking parameter
  let lastErr: unknown;
  // connections to YouTube's edge servers drop now and then; keep trying with a growing pause
  // before giving up on the fast path
  for (let attempt = 0; attempt < 7; attempt++) {
    if (cancelRequested()) throw new Error("Cancelled");
    try {
      const res = await fetch(u, { headers: s.headers, signal: AbortSignal.timeout(90_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, Math.min(8000, 700 * 2 ** attempt)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("range request failed");
}

/** Read the init segment length and the segment index from the start of an MP4. */
function parseHead(buf: Buffer): { initEnd: number; entries: SidxEntry[] } {
  let pos = 0;
  while (pos + 8 <= buf.length) {
    let size = buf.readUInt32BE(pos);
    const type = buf.toString("latin1", pos + 4, pos + 8);
    let header = 8;
    if (size === 1) {
      size = Number(buf.readBigUInt64BE(pos + 8));
      header = 16;
    }
    if (size < header) break;
    if (type === "sidx") {
      if (pos + size > buf.length) throw new NotSliceable("segment index larger than expected");
      let p = pos + header;
      const version = buf.readUInt8(p);
      p += 4; // version + flags
      p += 4; // reference_ID
      const timescale = buf.readUInt32BE(p);
      p += 4;
      let firstOffset: number;
      if (version === 0) {
        p += 4; // earliest_presentation_time
        firstOffset = buf.readUInt32BE(p);
        p += 4;
      } else {
        p += 8;
        firstOffset = Number(buf.readBigUInt64BE(p));
        p += 8;
      }
      p += 2; // reserved
      const count = buf.readUInt16BE(p);
      p += 2;
      let offset = pos + size + firstOffset;
      let t = 0;
      const entries: SidxEntry[] = [];
      for (let i = 0; i < count; i++) {
        const ref = buf.readUInt32BE(p);
        const dur = buf.readUInt32BE(p + 4);
        p += 12;
        if (ref & 0x80000000) throw new NotSliceable("hierarchical segment index");
        const bytes = ref & 0x7fffffff;
        entries.push({ offset, size: bytes, start: t / timescale, end: (t + dur) / timescale });
        offset += bytes;
        t += dur;
      }
      return { initEnd: pos, entries };
    }
    if (type === "mdat" || type === "moof") break; // media started with no index
    pos += size;
  }
  throw new NotSliceable("no segment index (sidx) found");
}

async function plan(s: Stream, from: number, to: number): Promise<Plan> {
  const head = await getRange(s, 0, HEAD - 1);
  const { initEnd, entries } = parseHead(head);
  if (!entries.length) throw new NotSliceable("empty segment index");
  const total = entries[entries.length - 1].end;
  if (from >= total) throw new NotSliceable("range is past the end of the video");
  const first = [...entries].reverse().find((e) => e.start <= from) ?? entries[0];
  const last = entries.find((e) => e.end >= to) ?? entries[entries.length - 1];
  return { initEnd, first, last };
}

/** Fetch [initEnd) + the segment bytes into `out`, in throttle-safe chunks, a few at a time. */
async function fetchPlan(s: Stream, p: Plan, out: string, onBytes: (n: number) => void) {
  const fd = fs.openSync(out, "w");
  try {
    const init = await getRange(s, 0, p.initEnd - 1);
    fs.writeSync(fd, init);
    const start = p.first.offset;
    const end = p.last.offset + p.last.size - 1;
    const jobs: [number, number][] = [];
    for (let a = start; a <= end; a += CHUNK) jobs.push([a, Math.min(end, a + CHUNK - 1)]);
    for (let i = 0; i < jobs.length; i += PARALLEL) {
      const bufs = await Promise.all(jobs.slice(i, i + PARALLEL).map(([a, b]) => getRange(s, a, b)));
      for (const b of bufs) {
        fs.writeSync(fd, b);
        onBytes(b.length);
      }
    }
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Download [range.start, range.end] of a YouTube video as destDir/trimmed.mp4. Throws NotSliceable
 * when the video isn't available in a form we can index (caller falls back to yt-dlp).
 */
export async function downloadSlice(
  url: string,
  destDir: string,
  range: { start: number; end: number },
  onProgress?: (pct: number, speed?: string) => void
): Promise<string> {
  const { video, audio } = await streamsFor(url);
  const [vp, ap] = await Promise.all([plan(video, range.start, range.end), plan(audio, range.start, range.end)]);

  const need = (p: Plan) => p.last.offset + p.last.size - p.first.offset;
  const totalBytes = need(vp) + need(ap);
  let done = 0;
  const t0 = Date.now();
  const tick = (n: number) => {
    done += n;
    const rate = done / Math.max(1, (Date.now() - t0) / 1000);
    onProgress?.(Math.min(99, (done / totalBytes) * 100), `${(rate / 1048576).toFixed(1)}MiB/s`);
  };

  const vFile = path.join(destDir, "slice-video.mp4");
  const aFile = path.join(destDir, "slice-audio.m4a");
  const merged = path.join(destDir, "slice-merged.mp4");
  const out = path.join(destDir, "trimmed.mp4");
  try {
    await Promise.all([fetchPlan(video, vp, vFile, tick), fetchPlan(audio, ap, aFile, tick)]);
    // glue the two fragment streams together; timestamps are absolute, so the two stay in sync
    await ffmpeg(["-i", vFile, "-i", aFile, "-map", "0:v:0", "-map", "1:a:0", "-c", "copy", "-avoid_negative_ts", "make_zero", "-movflags", "+faststart", merged]);
    // we fetched whole segments, so the file starts a little before the requested start
    const lead = Math.max(0, range.start - Math.min(vp.first.start, ap.first.start));
    await trimSource(merged, lead, lead + (range.end - range.start), out);
    return out;
  } finally {
    for (const f of [vFile, aFile, merged]) fs.rmSync(f, { force: true });
  }
}
