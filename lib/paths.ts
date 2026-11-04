import path from "node:path";
import fs from "node:fs";

export const STORAGE_ROOT = path.join(process.cwd(), "storage");
export const JOBS_DB = path.join(STORAGE_ROOT, "db.json");

export function jobDir(id: string) {
  return path.join(STORAGE_ROOT, "jobs", id);
}

export function clipsDir(id: string) {
  return path.join(jobDir(id), "clips");
}

export function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

export function ensureStorage() {
  ensureDir(STORAGE_ROOT);
  ensureDir(path.join(STORAGE_ROOT, "jobs"));
}
