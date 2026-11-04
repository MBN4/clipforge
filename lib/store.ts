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
const db: DB = loadFromDisk();

let writeQueue: Promise<unknown> = Promise.resolve();

function loadFromDisk(): DB {
  if (!fs.existsSync(JOBS_DB)) return {};
  try {
    return JSON.parse(fs.readFileSync(JOBS_DB, "utf-8"));
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

export function listJobs(): Job[] {
  return Object.values(db).sort((a, b) => b.createdAt - a.createdAt);
}
