"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Copy, Download, Info, Loader, RefreshCw } from "lucide-react";
import type { SystemCheck, SystemReport } from "@/lib/system";

const DISMISS_KEY = "clipforge-system-note-dismissed";

function fixFor(c: SystemCheck, platform: string): string | undefined {
  const key = platform === "win32" ? "windows" : platform === "darwin" ? "mac" : "linux";
  return c.fix?.[key] ?? c.fix?.any;
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text.split("   ")[0].replace(/^.*?:\s/, "")).catch(() => {});
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      aria-label="Copy command"
      className="shrink-0 rounded-md p-1 text-paper-dim transition hover:bg-white/10 hover:text-paper"
    >
      {done ? <Check className="h-3.5 w-3.5 text-moss" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/**
 * Tells the user what's missing on THIS machine. On a fresh clone the usual failure is a missing
 * ffmpeg / yt-dlp, which would otherwise look like clipping silently doing nothing.
 */
export function SystemBanner() {
  const [report, setReport] = useState<SystemReport | null>(null);
  const [checking, setChecking] = useState(false);
  // read lazily: the banner renders nothing until the report arrives, so this can't cause a hydration mismatch
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  const installYtDlp = useCallback(async () => {
    setInstalling(true);
    setInstallError(null);
    try {
      const res = await fetch("/api/system/install", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Install failed");
      setReport(data.report);
    } catch (e) {
      setInstallError(e instanceof Error ? e.message : "Install failed");
    } finally {
      setInstalling(false);
    }
  }, []);

  const recheck = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/system?refresh=1", { cache: "no-store" });
      if (res.ok) setReport(await res.json());
    } catch {
      // offline / server restarting — keep whatever we had
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/system", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && j && setReport(j))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!report) return null;

  const blocking = report.checks.filter((c) => c.level === "required" && !c.ok);
  const linkMissing = report.ready && !report.canDownloadLinks;
  const captionsOff = report.ready && report.canDownloadLinks && !report.canCaption;

  if (!blocking.length && !linkMissing && !(captionsOff && !dismissed)) return null;

  const recommended = report.checks.filter((c) => c.level === "recommended" && !c.ok);
  const list = blocking.length ? blocking : linkMissing ? recommended.filter((c) => c.id === "yt-dlp") : recommended;
  const tone = blocking.length ? "border-red-400/40 bg-red-400/[0.07]" : linkMissing ? "border-amber-300/40 bg-amber-300/[0.06]" : "border-line-strong bg-white/[0.03]";
  const Icon = blocking.length || linkMissing ? AlertTriangle : Info;
  const title = blocking.length
    ? "Setup needed on this machine"
    : linkMissing
      ? "Pasted links need yt-dlp (uploaded files still work)"
      : "Captions are off on this machine";
  const sub = blocking.length
    ? "Clipforge can't clip videos until these are installed. Run `npm run doctor` in the project folder for the same checklist."
    : linkMissing
      ? "Install it and links from YouTube, TikTok, Instagram and Facebook will work."
      : "Without speech-to-text, clips are picked by pacing and no captions are burned in. Everything else works.";

  return (
    <div role="alert" className={`mb-8 rounded-2xl border p-4 sm:p-5 ${tone}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${blocking.length ? "text-red-300" : linkMissing ? "text-amber-300" : "text-paper-dim"}`} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-semibold text-paper">{title}</p>
          <p className="mt-1 text-sm text-paper-dim">{sub}</p>
          <ul className="mt-3 space-y-2.5">
            {list.map((c) => {
              const fix = fixFor(c, report.platform);
              return (
                <li key={c.id} className="rounded-xl border border-line-strong bg-ink/60 p-3">
                  <p className="text-sm font-medium text-paper">{c.label}</p>
                  <p className="mt-0.5 text-xs text-paper-dim">{c.detail}</p>
                  {c.id === "yt-dlp" && (
                    <div className="mt-2.5">
                      <button
                        type="button"
                        onClick={installYtDlp}
                        disabled={installing}
                        className="inline-flex items-center gap-2 rounded-full bg-ember px-4 py-2 text-xs font-semibold text-ink transition hover:brightness-110 disabled:opacity-60"
                      >
                        {installing ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        {installing ? "Installing…" : "Install yt-dlp"}
                      </button>
                      <p className="mt-1.5 text-[11px] text-paper-dim">Downloads the official release into this project&apos;s bin folder and verifies its checksum.</p>
                      {installError && <p className="mt-1.5 text-xs text-red-300">{installError}</p>}
                    </div>
                  )}
                  {fix && c.id !== "yt-dlp" && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-black/40 px-3 py-2 font-mono text-[11px] text-ember-soft">
                      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">{fix}</code>
                      <CopyButton text={fix} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={recheck}
              disabled={checking}
              className="inline-flex items-center gap-2 rounded-full border border-line-strong px-4 py-1.5 text-xs font-semibold text-paper transition hover:border-white/35 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} /> Re-check
            </button>
            {captionsOff && (
              <button
                type="button"
                onClick={() => {
                  setDismissed(true);
                  try {
                    sessionStorage.setItem(DISMISS_KEY, "1");
                  } catch {}
                }}
                className="text-xs text-paper-dim transition hover:text-paper"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
