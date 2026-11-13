import fs from "node:fs";
import { ensureStorage, JOBS_DB } from "./paths";
import type { Job } from "./types";

ensureStorage();

type DB = Record<string, Job>;

// The in-memory object below is the single source of truth for reads and
// writes within this process. Disk is persisted to asynchronously, but never
// read back from during normal operation — re-reading from disk on every
// call raced with the async write queue (a read could land between two
// writes and see stale data), which showed up as concurrent clip renders
// occasionally clobbering each other's progress/stage updates.
//
// It lives on globalThis so dev hot-reloads (and separately bundled route
// handlers) share one copy instead of each re-reading a stale snapshot.
const ACTIVE = new Set(["queued", "downloading", "transcribing", "analyzing", "rendering"]);
const g = globalThis as unknown as { __clipforgeDb?: DB };
const db: DB = (g.__clipforgeDb ??= loadFromDisk(true));

let writeQueue: Promise<unknown> = Promise.resolve();

function loadFromDisk(sweep = false): DB {
  if (!fs.existsSync(JOBS_DB)) return {};
  try {
    const parsed: DB = JSON.parse(fs.readFileSync(JOBS_DB, "utf-8"));
    if (sweep) {
      // nothing can still be running after a fresh process start
      for (const job of Object.values(parsed)) {
        if (ACTIVE.has(job.stage)) {
          job.stage = "error";
          job.waiting = false;
          job.message = "Interrupted";
          job.error = "The server restarted while this video was processing. Hit Retry to run it again.";
          job.finishedAt = Date.now();
        }
      }
    }
    return parsed;
  } catch {
    return {};
  }
}

function persist() {
  const snapshot = JSON.stringify(db, null, 2);
  writeQueue = writeQueue.then(() => fs.promises.writeFile(JOBS_DB, snapshot));
  return writeQueue;
}

export function createJob(job: Job) {
  db[job.id] = job;
  persist();
}

export function getJob(id: string): Job | undefined {
  return db[id];
}

export function updateJob(id: string, patch: Partial<Job>) {
  const existing = db[id];
  if (!existing) return;
  db[id] = { ...existing, ...patch, updatedAt: Date.now() };
  persist();
  return db[id];
}

export function deleteJob(id: string) {
  delete db[id];
  persist();
}

export function listJobs(): Job[] {
  return Object.values(db).sort((a, b) => b.createdAt - a.createdAt);
}
