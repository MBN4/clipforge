#!/usr/bin/env node
// `npm run doctor`  — check this machine has everything Clipforge needs and say how to fix what's missing.
// `npm run setup`   — same, and also download the official yt-dlp into ./bin if it's missing.
import { BIN_DIR, installYtDlp, runChecks } from "../lib/systemChecks.mjs";

const FIX = process.argv.includes("--fix");
const C = process.stdout.isTTY ? { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", d: "\x1b[2m", b: "\x1b[1m", x: "\x1b[0m" } : { g: "", r: "", y: "", d: "", b: "", x: "" };
const osKey = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "mac" : "linux";

async function install() {
  console.log(`${C.b}Downloading yt-dlp${C.x} ${C.d}(official release, checksum-verified)${C.x}`);
  const v = await installYtDlp();
  console.log(`${C.g}✓${C.x} installed yt-dlp ${v} into ${BIN_DIR}\n`);
}

function print(report) {
  console.log(`\n${C.b}Clipforge doctor${C.x}  ${C.d}(${report.platform}, node ${process.versions.node})${C.x}\n`);
  for (const c of report.checks) {
    const mark = c.ok ? `${C.g}✓${C.x}` : c.level === "required" ? `${C.r}✗${C.x}` : `${C.y}!${C.x}`;
    console.log(`${mark} ${c.label}  ${C.d}${c.detail}${C.x}`);
    if (!c.ok) {
      const fix = c.fix?.[osKey] ?? c.fix?.any;
      if (fix) console.log(`    ${C.y}fix:${C.x} ${fix}`);
    }
  }
}

let report = runChecks();
if (FIX && !report.checks.find((c) => c.id === "yt-dlp")?.ok) {
  try {
    await install();
    report = runChecks();
  } catch (e) {
    console.log(`${C.r}✗${C.x} couldn't download yt-dlp automatically: ${e.message}\n`);
  }
}
print(report);

console.log("");
if (!report.ready) {
  console.log(`${C.r}${C.b}Not ready.${C.x} Install the ${C.r}✗${C.x} items above, then run ${C.b}npm run doctor${C.x} again.`);
  process.exit(1);
}
const notes = [];
if (!report.canDownloadLinks) notes.push("pasted links won't work until yt-dlp is installed (uploads work)");
if (!report.canCaption) {
  const miss = ["whisper", "libass"].filter((id) => !report.checks.find((c) => c.id === id)?.ok).map((id) => (id === "whisper" ? "Python + faster-whisper" : "an ffmpeg build with libass"));
  notes.push(`captions are skipped until ${miss.join(" and ")} ${miss.length > 1 ? "are" : "is"} available`);
}
console.log(notes.length ? `${C.g}${C.b}Ready${C.x} — with limits: ${notes.join("; ")}.` : `${C.g}${C.b}All set.${C.x} Start it with ${C.b}npm run dev${C.x}.`);
