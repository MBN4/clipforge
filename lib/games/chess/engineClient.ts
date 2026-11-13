// Talks to the engine Web Worker. One request runs at a time; a newer request replaces any queued one,
// cancel() terminates the worker (stopping a long think instantly) and the next request spins up a fresh one.
// If workers are unavailable the request runs on the main thread in a timeout with a reduced time budget.
import { runEngineRequest, type EngineRequest, type EngineResponse } from "./engineProtocol";

type Req = EngineRequest extends infer R ? (R extends EngineRequest ? Omit<R, "id"> : never) : never;

interface Pending {
  req: EngineRequest;
  resolve: (r: EngineResponse | null) => void;
}

let nextId = 1;

export class EngineClient {
  private worker: Worker | null = null;
  private broken = false;
  private running: Pending | null = null;
  private queued: Pending | null = null;
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  /** Resolves with the engine's answer, or null if cancelled / superseded. */
  request(r: Req): Promise<EngineResponse | null> {
    return new Promise((resolve) => {
      if (this.disposed) return resolve(null);
      const p: Pending = { req: { ...r, id: nextId++ } as EngineRequest, resolve };
      if (this.queued) this.queued.resolve(null);
      this.queued = p;
      this.pump();
    });
  }

  get usingWorker() {
    return !this.broken;
  }

  private ensureWorker(): Worker | null {
    if (this.broken || typeof Worker === "undefined") {
      this.broken = true;
      return null;
    }
    if (this.worker) return this.worker;
    try {
      const w = new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (e: MessageEvent<EngineResponse>) => this.onResult(e.data);
      w.onerror = (e) => {
        e.preventDefault?.();
        // the worker failed to load or crashed → switch to the main-thread fallback and retry
        this.broken = true;
        this.worker?.terminate();
        this.worker = null;
        const r = this.running;
        this.running = null;
        if (r) {
          this.queued = this.queued ?? r;
          if (this.queued !== r) r.resolve(null);
        }
        this.pump();
      };
      this.worker = w;
      return w;
    } catch {
      this.broken = true;
      return null;
    }
  }

  private pump() {
    if (this.running || !this.queued || this.disposed) return;
    const p = this.queued;
    this.queued = null;
    this.running = p;
    const w = this.ensureWorker();
    if (w) {
      w.postMessage(p.req);
      return;
    }
    // fallback: main thread, short budget, yielding to the event loop first
    this.fallbackTimer = setTimeout(() => {
      this.fallbackTimer = null;
      const req = p.req.kind === "analyze" ? { ...p.req, timeMs: Math.min(p.req.timeMs, 120) } : { ...p.req, maxTimeMs: Math.min(p.req.maxTimeMs ?? 300, 300) };
      this.onResult(runEngineRequest(req));
    }, 16);
  }

  private onResult(res: EngineResponse) {
    const r = this.running;
    if (!r || r.req.id !== res.id) return;
    this.running = null;
    r.resolve(res);
    this.pump();
  }

  /** Abort everything in flight (terminates the worker). */
  cancel() {
    this.queued?.resolve(null);
    this.queued = null;
    if (this.running) {
      this.running.resolve(null);
      this.running = null;
      this.worker?.terminate();
      this.worker = null;
    }
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  dispose() {
    this.cancel();
    this.worker?.terminate();
    this.worker = null;
    this.disposed = true;
  }
}
