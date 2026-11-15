// Environment checks shared by the app (/api/system → the studio's setup banner) and the
// `npm run doctor` CLI. Plain Node ESM with no TypeScript so scripts/doctor.mjs can import it directly.
//
// Clipforge shells out to a few programs. A fresh machine often lacks one of them, and without
// these checks that shows up as a job that silently does nothing. Each program is looked up in
// this order: CLIPFORGE_<NAME> env var → ./bin/<name> (what `npm run setup` installs) → PATH.
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const IS_WIN = process.platform === "win32";

/** @typedef {{ id: string, label: string, level: "required" | "recommended", ok: boolean, detail: string, fix?: { linux?: string, mac?: string, windows?: string, any?: string } }} Check */
/** @typedef {{ platform: string, checks: Check[], ready: boolean, canDownloadLinks: boolean, canCaption: boolean, binDir: string }} SystemReport */

export const BIN_DIR = path.join(process.cwd(), "bin");

const ENV_NAMES = { ffmpeg: "CLIPFORGE_FFMPEG", ffprobe: "CLIPFORGE_FFPROBE", "yt-dlp": "CLIPFORGE_YTDLP", python3: "CLIPFORGE_PYTHON" };

/** Where to run `name` from: env override, then a copy in ./bin, then whatever is on PATH. */
export function resolveBin(name) {
  const envKey = ENV_NAMES[name];
  const fromEnv = envKey && process.env[envKey];
  if (fromEnv) return fromEnv;
  const local = path.join(BIN_DIR, IS_WIN ? `${name}.exe` : name);
  if (fs.existsSync(local)) return local;
  return name;
}

let pythonCache;
/** `python3`, falling back to `python` (what Windows and some distros call it). */
export function resolvePython() {
  if (pythonCache) return pythonCache;
  const override = process.env.CLIPFORGE_PYTHON;
  if (override) return (pythonCache = override);
  for (const cand of ["python3", "python"]) {
    const r = spawnSync(cand, ["--version"], { timeout: 6000, encoding: "utf8" });
    if (!r.error && r.status === 0) return (pythonCache = cand);
  }
  return (pythonCache = "python3");
}

function probe(cmd, args, timeout = 12000) {
  const r = spawnSync(cmd, args, { timeout, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  return { ok: !r.error && r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}`, missing: r.error?.code === "ENOENT" };
}

const firstLine = (s) => s.split("\n").find((l) => l.trim())?.trim() ?? "";

/** @returns {SystemReport} */
export function runChecks() {
  /** @type {Check[]} */
  const checks = [];
  const add = (c) => checks.push(c);

  // Node
  const major = Number(process.versions.node.split(".")[0]);
  add({
    id: "node",
    label: "Node.js 20+",
    level: "required",
    ok: major >= 20,
    detail: `v${process.versions.node}`,
    fix: { any: "Install Node 20 or newer from https://nodejs.org (or `nvm install 22`)." },
  });

  // storage
  let storageOk = false;
  let storageDetail = "";
  try {
    const dir = path.join(process.cwd(), "storage");
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, ".write-test");
    fs.writeFileSync(f, "ok");
    fs.rmSync(f);
    storageOk = true;
    storageDetail = dir;
  } catch (e) {
    storageDetail = e instanceof Error ? e.message : "not writable";
  }
  add({ id: "storage", label: "Writable storage folder", level: "required", ok: storageOk, detail: storageDetail, fix: { any: "Make the project's ./storage folder writable by the user running Clipforge." } });

  // ffmpeg + capabilities
  const ffmpegFix = {
    linux: "sudo apt install ffmpeg   (Fedora: sudo dnf install ffmpeg · Arch: sudo pacman -S ffmpeg)",
    mac: "brew install ffmpeg",
    windows: "winget install Gyan.FFmpeg   (then reopen the terminal so it's on PATH)",
  };
  const ff = probe(resolveBin("ffmpeg"), ["-version"]);
  add({ id: "ffmpeg", label: "ffmpeg", level: "required", ok: ff.ok, detail: ff.ok ? firstLine(ff.out).replace(/^ffmpeg version /, "") : ff.missing ? "not found" : firstLine(ff.out) || "failed to run", fix: ffmpegFix });
  const fp = probe(resolveBin("ffprobe"), ["-version"]);
  add({ id: "ffprobe", label: "ffprobe", level: "required", ok: fp.ok, detail: fp.ok ? "found" : fp.missing ? "not found (it ships with ffmpeg)" : "failed to run", fix: ffmpegFix });
  if (ff.ok) {
    const enc = probe(resolveBin("ffmpeg"), ["-hide_banner", "-encoders"]);
    add({
      id: "libx264",
      label: "ffmpeg H.264 encoder (libx264)",
      level: "required",
      ok: /libx264/.test(enc.out),
      detail: /libx264/.test(enc.out) ? "available" : "this ffmpeg build can't encode H.264",
      fix: { any: "Install a full ffmpeg build (the distro/Homebrew/Gyan packages include libx264)." },
    });
    const fil = probe(resolveBin("ffmpeg"), ["-hide_banner", "-filters"]);
    const hasAss = /\bass\b/.test(fil.out);
    add({
      id: "libass",
      label: "ffmpeg caption renderer (libass)",
      level: "recommended",
      ok: hasAss,
      detail: hasAss ? "available" : "missing — burned-in captions won't render",
      fix: { any: "Use an ffmpeg build with libass (the standard Linux/Homebrew/Gyan 'full' builds have it)." },
    });
  }

  // yt-dlp
  const yt = probe(resolveBin("yt-dlp"), ["--version"]);
  add({
    id: "yt-dlp",
    label: "yt-dlp (needed for YouTube / TikTok / Instagram / Facebook links)",
    level: "recommended",
    ok: yt.ok,
    detail: yt.ok ? firstLine(yt.out) : yt.missing ? "not found — pasted links won't work (uploaded files still do)" : "failed to run",
    fix: { any: "npm run setup   (downloads the official yt-dlp into ./bin)  — or: pip install -U yt-dlp  /  brew install yt-dlp", windows: "winget install yt-dlp.yt-dlp   — or: npm run setup" },
  });

  // python + faster-whisper
  const py = resolvePython();
  const pyv = probe(py, ["--version"]);
  let whisperOk = false;
  let whisperDetail = pyv.missing || !pyv.ok ? "Python not found" : "faster-whisper not installed";
  if (pyv.ok) {
    const w = probe(py, ["-c", "import faster_whisper"], 20000);
    whisperOk = w.ok;
    if (w.ok) whisperDetail = `${firstLine(pyv.out)} + faster-whisper`;
  }
  add({
    id: "whisper",
    label: "Speech-to-text (Python + faster-whisper)",
    level: "recommended",
    ok: whisperOk,
    detail: whisperOk ? whisperDetail : `${whisperDetail} — clips are picked by pacing and captions are skipped`,
    fix: { any: "pip install faster-whisper   (needs Python 3.10+; first run downloads a ~150 MB model)" },
  });

  const ok = (id) => checks.find((c) => c.id === id)?.ok ?? false;
  const requiredOk = checks.filter((c) => c.level === "required").every((c) => c.ok);
  return {
    platform: process.platform,
    checks,
    ready: requiredOk,
    canDownloadLinks: requiredOk && ok("yt-dlp"),
    canCaption: requiredOk && ok("whisper") && ok("libass"),
    binDir: BIN_DIR,
  };
}

// ---- one-step yt-dlp install (used by `npm run setup` and the studio's "Install yt-dlp" button) ----

const YTDLP_BASE = "https://github.com/yt-dlp/yt-dlp/releases/latest/download";

/** The standalone yt-dlp build for this OS (no Python needed). */
export function ytDlpAsset() {
  if (process.platform === "win32") return "yt-dlp.exe";
  if (process.platform === "darwin") return "yt-dlp_macos";
  return process.arch === "arm64" ? "yt-dlp_linux_aarch64" : "yt-dlp_linux";
}

/**
 * Download the official yt-dlp release into ./bin, verify it against the published SHA-256 sums,
 * make it executable and confirm it runs. Throws with a readable message on any failure.
 * @returns {Promise<string>} the installed version
 */
export async function installYtDlp() {
  const asset = ytDlpAsset();
  const res = await fetch(`${YTDLP_BASE}/${asset}`, { redirect: "follow" });
  if (!res.ok) throw new Error(`Couldn't download yt-dlp (HTTP ${res.status}). Check your internet connection.`);
  const data = Buffer.from(await res.arrayBuffer());

  // verify integrity against the checksum file published next to the release
  const sums = await fetch(`${YTDLP_BASE}/SHA2-256SUMS`, { redirect: "follow" });
  if (!sums.ok) throw new Error("Couldn't fetch yt-dlp's checksum file, so the download wasn't trusted.");
  const line = (await sums.text()).split("\n").find((l) => l.trim().endsWith(` ${asset}`) || l.trim().endsWith(`*${asset}`));
  const expected = line?.trim().split(/\s+/)[0]?.toLowerCase();
  const actual = crypto.createHash("sha256").update(data).digest("hex");
  if (!expected || expected !== actual) throw new Error("The downloaded yt-dlp failed its checksum check, so it was discarded.");

  fs.mkdirSync(BIN_DIR, { recursive: true });
  const dest = path.join(BIN_DIR, IS_WIN ? "yt-dlp.exe" : "yt-dlp");
  fs.writeFileSync(dest, data);
  if (!IS_WIN) fs.chmodSync(dest, 0o755);

  const v = probe(dest, ["--version"], 30000);
  if (!v.ok) {
    fs.rmSync(dest, { force: true });
    throw new Error("The downloaded yt-dlp wouldn't run on this machine.");
  }
  return firstLine(v.out);
}
