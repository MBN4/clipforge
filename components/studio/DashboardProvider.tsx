"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { nanoid } from "nanoid";
import { ToastStack, type ToastData } from "@/components/Toast";
import { sfx } from "@/lib/sound";
import { requestNotificationPermission, notifyJobDone } from "@/lib/notify";
import { isActive } from "@/lib/dashboard";
import type { ClientJob } from "@/lib/serialize";
import type { SystemSnapshot } from "@/lib/scheduler";

export type NewJobInput =
  | { kind: "url"; url: string; title?: string; thumbnail?: string; duration?: number; clipCount: number; range?: { start: number; end: number } }
  | { kind: "file"; file: File; title: string; duration?: number; clipCount: number; range?: { start: number; end: number } };

interface Dashboard {
  jobs: ClientJob[];
  system: SystemSnapshot | null;
  loaded: boolean;
  offline: boolean;
  refresh: () => Promise<void>;
  submitJob: (input: NewJobInput, onProgress?: (pct: number) => void) => Promise<string>;
  cancelJob: (id: string) => Promise<void>;
  retryJob: (id: string) => Promise<void>;
  removeJob: (id: string) => Promise<void>;
  toast: (title: string, body?: string) => void;
}

const Ctx = createContext<Dashboard | null>(null);

export function useDashboard(): Dashboard {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDashboard must be used inside the studio layout");
  return v;
}

const FAST_MS = 1200; // something is processing
const IDLE_MS = 5000;
const HIDDEN_MS = 10000;

function uploadWithProgress(form: FormData, onProgress?: (pct: number) => void): Promise<{ id: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/jobs");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onerror = () => reject(new Error("Upload failed — check your connection"));
    xhr.onload = () => {
      let data: { id?: string; error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && data.id) resolve({ id: data.id });
      else reject(new Error(data.error || "Failed to start"));
    };
    xhr.send(form);
  });
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<ClientJob[]>([]);
  const [system, setSystem] = useState<SystemSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [offline, setOffline] = useState(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const prevStages = useRef<Map<string, string> | null>(null);
  const jobsRef = useRef<ClientJob[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inflight = useRef<Promise<void> | null>(null);

  const toast = useCallback((title: string, body?: string) => {
    const id = nanoid(6);
    setToasts((t) => [...t.slice(-3), { id, title, body }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  const announce = useCallback(
    (next: ClientJob[]) => {
      const prev = prevStages.current;
      if (prev) {
        for (const j of next) {
          const was = prev.get(j.id);
          if (!was || was === j.stage) continue;
          const wasActive = ["queued", "downloading", "transcribing", "analyzing", "rendering"].includes(was);
          if (!wasActive) continue;
          const name = j.title || j.source.filename || "A video";
          if (j.stage === "done") {
            sfx.jobDone();
            const n = j.clips.length;
            toast(`${name} is ready`, `${n} ${n === 1 ? "clip" : "clips"} finished rendering`);
            notifyJobDone("Clipforge", `${name}: ${n} ${n === 1 ? "clip" : "clips"} ready to post`);
          } else if (j.stage === "error") {
            toast(`${name} didn't work`, j.error);
            notifyJobDone("Clipforge", `Something went wrong with ${name}`);
          }
        }
      }
      prevStages.current = new Map(next.map((j) => [j.id, j.stage]));
    },
    [toast]
  );

  const refresh = useCallback(async () => {
    if (inflight.current) return inflight.current;
    const p = (async () => {
      try {
        const res = await fetch("/api/jobs", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data: { jobs: ClientJob[]; system: SystemSnapshot } = await res.json();
        announce(data.jobs);
        jobsRef.current = data.jobs;
        setJobs(data.jobs);
        setSystem(data.system);
        setOffline(false);
        setLoaded(true);
      } catch {
        setOffline(true);
      } finally {
        inflight.current = null;
      }
    })();
    inflight.current = p;
    return p;
  }, [announce]);

  // adaptive polling: quick while anything is processing, lazy when idle or in a background tab
  useEffect(() => {
    let stop = false;
    const loop = async () => {
      await refresh();
      if (stop) return;
      const delay = document.visibilityState === "hidden" ? HIDDEN_MS : jobsRef.current.some(isActive) ? FAST_MS : IDLE_MS;
      timer.current = setTimeout(loop, delay);
    };
    loop();
    const onVis = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer.current);
        loop();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const submitJob = useCallback(
    async (input: NewJobInput, onProgress?: (pct: number) => void) => {
      let id: string;
      if (input.kind === "url") {
        const res = await fetch("/api/jobs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            url: input.url,
            title: input.title,
            thumbnail: input.thumbnail,
            duration: input.duration,
            clipCount: input.clipCount,
            rangeStart: input.range?.start,
            rangeEnd: input.range?.end,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to start");
        id = data.id;
      } else {
        const form = new FormData();
        form.append("file", input.file);
        form.append("title", input.title);
        form.append("clipCount", String(input.clipCount));
        if (input.duration) form.append("duration", String(input.duration));
        if (input.range) {
          form.append("rangeStart", String(input.range.start));
          form.append("rangeEnd", String(input.range.end));
        }
        id = (await uploadWithProgress(form, onProgress)).id;
      }
      void refresh();
      return id;
    },
    [refresh]
  );

  const act = useCallback(
    async (url: string, method: string, failure: string) => {
      const res = await fetch(url, { method });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast(failure, data.error);
      }
      await refresh();
    },
    [refresh, toast]
  );

  const cancelJob = useCallback((id: string) => act(`/api/jobs/${id}/cancel`, "POST", "Couldn't cancel that video"), [act]);
  const retryJob = useCallback((id: string) => act(`/api/jobs/${id}/retry`, "POST", "Couldn't retry that video"), [act]);
  const removeJob = useCallback(
    async (id: string) => {
      setJobs((j) => j.filter((x) => x.id !== id)); // optimistic
      await act(`/api/jobs/${id}`, "DELETE", "Couldn't delete that video");
    },
    [act]
  );

  const value = useMemo<Dashboard>(
    () => ({ jobs, system, loaded, offline, refresh, submitJob, cancelJob, retryJob, removeJob, toast }),
    [jobs, system, loaded, offline, refresh, submitJob, cancelJob, retryJob, removeJob, toast]
  );

  return (
    <Ctx.Provider value={value}>
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
      {children}
    </Ctx.Provider>
  );
}
