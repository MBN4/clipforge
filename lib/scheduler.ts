// Global work scheduler shared by every job in this process.
//
// Why it exists: before, every video started the moment it was submitted. One
// video ran flat-out, but several at once fought over the same CPU cores —
// whisper (all threads) + three ffmpeg encodes per job, times N jobs — so every
// video got slower the more you queued. Now each stage borrows "slots" from a
// shared pool; a job on its own gets exactly the resources it always had, and
// extra jobs wait their turn (earliest job first) instead of thrashing. Network
// downloads run on their own lane, so one video can download while another is
// busy on the CPU.
import os from "node:os";
import { AsyncLocalStorage } from "node:async_hooks";
import type { ChildProcess } from "node:child_process";

export interface RunContext {
  jobId: string;
  cancelled: boolean;
  children: Set<ChildProcess>;
  aborters: Set<() => void>;
  /** requests currently blocked waiting for a slot */
  waiting: number;
  /** slots currently held (work actually running) */
  holding: number;
  /** wall-clock time this job had work waiting but nothing running — i.e. truly stuck in line */
  waitedMs: number;
  blockedSince: number | null;
  onWait?: (ctx: RunContext, waiting: number, ahead: number, pool: PoolName) => void;
}

function touchBlocked(ctx: RunContext) {
  const blocked = ctx.waiting > 0 && ctx.holding === 0;
  const now = Date.now();
  if (blocked && ctx.blockedSince == null) ctx.blockedSince = now;
  else if (!blocked && ctx.blockedSince != null) {
    ctx.waitedMs += now - ctx.blockedSince;
    ctx.blockedSince = null;
  }
}

/** Time spent stuck in line so far, including a wait that's still in progress. */
export function blockedMs(ctx: RunContext): number {
  return ctx.waitedMs + (ctx.blockedSince != null ? Date.now() - ctx.blockedSince : 0);
}

export type PoolName = "download" | "cpu";

class Cancelled extends Error {
  constructor() {
    super("Cancelled");
    this.name = "Cancelled";
  }
}
export const isCancelled = (e: unknown) => e instanceof Cancelled || (e as { name?: string })?.name === "Cancelled";

interface Waiter {
  weight: number;
  priority: number;
  since: number;
  grant: () => void;
  reject: (e: Error) => void;
}

// If the request at the head of the line has been blocked this long, stop
// letting lighter requests jump ahead of it, so big jobs can't be starved.
const BACKFILL_WINDOW_MS = 20_000;

class Pool {
  used = 0;
  queue: Waiter[] = [];
  constructor(public name: PoolName, public capacity: number) {}

  acquire(weight: number, priority: number, ctx?: RunContext): Promise<() => void> {
    const w = Math.max(1, Math.min(weight, this.capacity));
    if (ctx?.cancelled) return Promise.reject(new Cancelled());
    return new Promise((resolve, reject) => {
      let released = false;
      let counted = false; // whether this request was counted as "waiting" on its job
      const release = () => {
        if (released) return;
        released = true;
        this.used -= w;
        if (ctx) {
          ctx.holding = Math.max(0, ctx.holding - 1);
          touchBlocked(ctx);
        }
        this.pump();
      };
      const waiter: Waiter = {
        weight: w,
        priority,
        since: Date.now(),
        grant: () => {
          this.used += w;
          if (ctx) {
            if (counted) ctx.waiting = Math.max(0, ctx.waiting - 1);
            ctx.holding += 1;
            touchBlocked(ctx);
            ctx.aborters.delete(abort);
          }
          resolve(release);
        },
        reject,
      };
      const abort = () => {
        const i = this.queue.indexOf(waiter);
        if (i >= 0) this.queue.splice(i, 1);
        if (ctx) {
          if (counted) ctx.waiting = Math.max(0, ctx.waiting - 1);
          ctx.aborters.delete(abort);
          touchBlocked(ctx);
        }
        reject(new Cancelled());
      };
      this.queue.push(waiter);
      if (ctx) {
        ctx.aborters.add(abort);
        // only a real wait if it can't start right away
        if (this.used + w > this.capacity || this.queue.length > 1) {
          counted = true;
          ctx.waiting += 1;
          touchBlocked(ctx);
          ctx.onWait?.(ctx, ctx.waiting, this.queue.filter((q) => q.priority < priority).length, this.name);
        }
      }
      this.pump();
    });
  }

  pump() {
    if (!this.queue.length) return;
    this.queue.sort((a, b) => a.priority - b.priority || a.since - b.since);
    const now = Date.now();
    let blockedHead: Waiter | null = null;
    for (const w of [...this.queue]) {
      const fits = this.used + w.weight <= this.capacity;
      if (fits && (!blockedHead || now - blockedHead.since < BACKFILL_WINDOW_MS)) {
        this.queue.splice(this.queue.indexOf(w), 1);
        w.grant();
      } else if (!blockedHead) {
        blockedHead = w;
      }
    }
  }
}

interface State {
  pools: Map<PoolName, Pool>;
  als: AsyncLocalStorage<RunContext>;
  runs: Map<string, RunContext>;
}

// globalThis so dev hot-reloads and separately bundled route handlers share one scheduler
const g = globalThis as unknown as { __clipforgeSched?: State };
const state: State = (g.__clipforgeSched ??= { pools: new Map(), als: new AsyncLocalStorage(), runs: new Map() });

const CPUS = Math.max(1, os.cpus().length);
const RENDER_SLOTS = Math.max(1, Number(process.env.CLIPFORGE_RENDER_SLOTS) || 3);
/** "CPU units": a whole-machine task (whisper) takes all of them, a render takes capacity / RENDER_SLOTS. */
export const CPU_CAPACITY = CPUS * RENDER_SLOTS;
export const TRANSCRIBE_WEIGHT = CPU_CAPACITY;
export const RENDER_WEIGHT = CPUS;
const DOWNLOAD_SLOTS = Math.max(1, Number(process.env.CLIPFORGE_DOWNLOAD_SLOTS) || 3);

function pool(name: PoolName): Pool {
  let p = state.pools.get(name);
  if (!p) {
    p = new Pool(name, name === "download" ? DOWNLOAD_SLOTS : CPU_CAPACITY);
    state.pools.set(name, p);
  }
  return p;
}

export function currentContext(): RunContext | undefined {
  return state.als.getStore();
}

export function runInContext<T>(jobId: string, onWait: RunContext["onWait"], fn: (ctx: RunContext) => Promise<T>): Promise<T> {
  const ctx: RunContext = { jobId, cancelled: false, children: new Set(), aborters: new Set(), waiting: 0, holding: 0, waitedMs: 0, blockedSince: null, onWait };
  state.runs.set(jobId, ctx);
  return state.als.run(ctx, () => fn(ctx)).finally(() => state.runs.delete(jobId));
}

/** Borrow `weight` units of a pool (earliest job first) for the duration of `fn`. */
export async function withSlot<T>(name: PoolName, weight: number, priority: number, fn: () => Promise<T>): Promise<T> {
  const ctx = currentContext();
  const release = await pool(name).acquire(weight, priority, ctx);
  try {
    if (ctx?.cancelled) throw new Cancelled();
    return await fn();
  } finally {
    release();
  }
}

/** True once the current job has been cancelled — a killed child process then looks like an ordinary failure. */
export function cancelRequested(): boolean {
  return !!currentContext()?.cancelled;
}

export function throwIfCancelled() {
  if (currentContext()?.cancelled) throw new Cancelled();
}

function killTree(child: ChildProcess) {
  try {
    // children are spawned detached (their own process group) so yt-dlp's ffmpeg dies with it
    if (child.pid) process.kill(-child.pid, "SIGKILL");
    else child.kill("SIGKILL");
  } catch {
    try {
      child.kill("SIGKILL");
    } catch {}
  }
}

/** Register a spawned process with the current job so cancelling the job kills it. */
export function trackChild(child: ChildProcess) {
  const ctx = currentContext();
  if (!ctx) return;
  ctx.children.add(child);
  child.once("close", () => ctx.children.delete(child));
  if (ctx.cancelled) killTree(child);
}

/** Cancel a running/queued job: stop waiting, kill its processes. */
export function cancelRun(jobId: string): boolean {
  const ctx = state.runs.get(jobId);
  if (!ctx) return false;
  ctx.cancelled = true;
  [...ctx.aborters].forEach((a) => a());
  ctx.children.forEach(killTree);
  return true;
}

/** Live stuck-in-line time for a running job (the stored value only refreshes when a stage changes). */
export function liveWaitedMs(jobId: string): number | undefined {
  const ctx = state.runs.get(jobId);
  return ctx ? blockedMs(ctx) : undefined;
}

export function isRunning(jobId: string) {
  return state.runs.has(jobId);
}

export interface SystemSnapshot {
  cpus: number;
  downloads: { active: number; limit: number; waiting: number };
  compute: { used: number; capacity: number; waiting: number; renderSlots: number };
  runningJobs: number;
}

export function systemSnapshot(): SystemSnapshot {
  const d = pool("download");
  const c = pool("cpu");
  return {
    cpus: CPUS,
    downloads: { active: d.used, limit: d.capacity, waiting: d.queue.length },
    compute: { used: c.used, capacity: c.capacity, waiting: c.queue.length, renderSlots: RENDER_SLOTS },
    runningJobs: state.runs.size,
  };
}
