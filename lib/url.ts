import path from "node:path";
import { STORAGE_ROOT } from "./paths";

export function toFileUrl(storagePath: string): string {
  // storagePath is relative to cwd, e.g. "storage/jobs/<id>/clips/clip-0.mp4"
  const abs = path.isAbsolute(storagePath) ? storagePath : path.join(process.cwd(), storagePath);
  const rel = path.relative(STORAGE_ROOT, abs).split(path.sep).join("/");
  return `/api/files/${rel}`;
}
