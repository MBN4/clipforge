import path from "node:path";
import fs from "node:fs";

export const STORAGE_ROOT = path.join(process.cwd(), "storage");
export const JOBS_DB = path.join(STORAGE_ROOT, "db.json");
/** Fonts bundled for captions — served to the browser from /fonts and handed
 * to libass via the ass filter's fontsdir, so preview and export match. */
export const CAPTION_FONTS_DIR = path.join(process.cwd(), "public", "fonts");

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
