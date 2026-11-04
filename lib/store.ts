import fs from "node:fs";
import { ensureStorage, JOBS_DB } from "./paths";
import type { Job } from "./types";

ensureStorage();

type DB = Record<string, Job>;

let writeQueue: Promise<unknown> = Promise.resolve();

function readDb(): DB {
  if (!fs.existsSync(JOBS_DB)) return {};
  try {
    return JSON.parse(fs.readFileSync(JOBS_DB, "utf-8"));
  } catch {
    return {};
  }
}

function writeDb(db: DB) {
  writeQueue = writeQueue.then(() =>
    fs.promises.writeFile(JOBS_DB, JSON.stringify(db, null, 2))
  );
  return writeQueue;
}

export function createJob(job: Job) {
  const db = readDb();
  db[job.id] = job;
  writeDb(db);
}

export function getJob(id: string): Job | undefined {
  const db = readDb();
  return db[id];
}

export function updateJob(id: string, patch: Partial<Job>) {
  const db = readDb();
  const existing = db[id];
  if (!existing) return;
  db[id] = { ...existing, ...patch, updatedAt: Date.now() };
  writeDb(db);
  return db[id];
}

export function listJobs(): Job[] {
  const db = readDb();
  return Object.values(db).sort((a, b) => b.createdAt - a.createdAt);
}
