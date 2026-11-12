"use client";

import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";
import { useReducedMotion } from "framer-motion";

// A spider-web "slinger" for the pricing CTA. While the pointer is inside the
// section, a web reaches out from the button and trails the cursor — but it
// always stops short and recoils if you get close, so it never catches it.
// The user can switch the whole thing off.

const KEY = "clipforge-web-slinger";
const EVT = "clipforge-web-slinger-change";

type Mode = "idle" | "follow" | "retract";
type P = { x: number; y: number };

function readPref(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
function subPref(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVT, cb);
  };
}
function subFine(cb: () => void) {
  const mq = window.matchMedia("(pointer: fine)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function useWebSlinger(sectionRef: RefObject<HTMLElement | null>, anchorRef: RefObject<HTMLElement | null>) {
  const reduce = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const supported = useSyncExternalStore(subFine, () => window.matchMedia("(pointer: fine)").matches, () => false);
  const pref = useSyncExternalStore(subPref, readPref, () => "");
  const on = pref === "" ? !reduce : pref === "1";

  function setOn(next: boolean) {
    try {
      localStorage.setItem(KEY, next ? "1" : "0");
    } catch {}
    window.dispatchEvent(new Event(EVT));
  }

  useEffect(() => {
    if (!supported || !on) return;
    const section = sectionRef.current;
    const anchorEl = anchorRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!section || !anchorEl || !canvas || !ctx) return;
    const anchor: HTMLElement = anchorEl;

    let w = 0;
    let h = 0;
    const resize = () => {
      const r = section.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(section);
    resize();

    const GAP = 56; // the tip never gets closer to the cursor than this
    const ptr = { x: 0, y: 0, in: false, has: false };
    let mode: Mode = "idle";
    let tip: P = { x: 0, y: 0 };
    let enteredAt = 0;
    let amp = 0;
    let raf = 0;
    let last = 0;

    const info = () => {
      const s = section.getBoundingClientRect();
      const r = anchor.getBoundingClientRect();
      return { cx: r.left - s.left + r.width / 2, cy: r.top - s.top + r.height / 2, hw: r.width / 2, hh: r.height / 2 };
    };
    type Info = ReturnType<typeof info>;
    // where a strand leaves the button: its edge, in the direction of the target
    const edge = (to: P, a: Info): P => {
      const dx = to.x - a.cx;
      const dy = to.y - a.cy;
      const t = Math.min(1, a.hw / Math.max(Math.abs(dx), 1e-6), a.hh / Math.max(Math.abs(dy), 1e-6));
      return { x: a.cx + dx * t, y: a.cy + dy * t };
    };
    const nearButton = (pad: number) => {
      const a = info();
      return Math.abs(ptr.x - a.cx) < a.hw + pad && Math.abs(ptr.y - a.cy) < a.hh + pad;
    };
    const kick = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };

    function drawWeb(x: number, y: number, R: number, rot: number, alpha: number) {
      ctx!.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx!.lineWidth = 0.9;
      ctx!.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = rot + (k * Math.PI) / 4;
        ctx!.moveTo(x, y);
        ctx!.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R);
      }
      for (const f of [0.38, 0.68, 1]) {
        const r = R * f;
        for (let k = 0; k < 8; k++) {
          const a0 = rot + (k * Math.PI) / 4;
          const a1 = a0 + Math.PI / 4;
          const am = (a0 + a1) / 2;
          if (k === 0) ctx!.moveTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r);
          ctx!.quadraticCurveTo(x + Math.cos(am) * r * 0.8, y + Math.sin(am) * r * 0.8, x + Math.cos(a1) * r, y + Math.sin(a1) * r);
        }
      }
      ctx!.stroke();
    }

    function draw(ts: number) {
      ctx!.clearRect(0, 0, w, h);
      if (mode === "idle") return;
      const a = info();
      const T = ts / 1000;
      const from = edge(tip, a);
      const dx = tip.x - from.x;
      const dy = tip.y - from.y;
      const len = Math.hypot(dx, dy);
      if (len <= 6) return;
      ctx!.lineCap = "round";
      ctx!.lineJoin = "round";
      const nx = -dy / len;
      const ny = dx / len;
      const sag = mode === "retract" ? 0.1 : 0.05;
      const N = 28;
      const pts: P[] = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const env = Math.sin(Math.PI * t);
        const wob = env * amp * Math.sin(t * 12 - T * 30);
        pts.push({ x: from.x + dx * t + nx * wob, y: from.y + dy * t + ny * wob + env * sag * len });
      }
      const path = (ox: number, oy: number) => {
        ctx!.beginPath();
        pts.forEach((p, i) => (i ? ctx!.lineTo(p.x + ox, p.y + oy) : ctx!.moveTo(p.x + ox, p.y + oy)));
        ctx!.stroke();
      };
      ctx!.strokeStyle = "rgba(255,255,255,0.16)";
      ctx!.lineWidth = 5;
      path(0, 0);
      ctx!.strokeStyle = "rgba(255,255,255,0.95)";
      ctx!.lineWidth = 1.6;
      path(0, 0);
      ctx!.strokeStyle = "rgba(255,255,255,0.45)";
      ctx!.lineWidth = 0.8;
      path(nx * 2.2, ny * 2.2);
      drawWeb(tip.x, tip.y, mode === "retract" ? 10 : 20, Math.atan2(dy, dx) + T * 0.4, 0.85);
    }

    function loop(ts: number) {
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      amp *= Math.exp(-3 * dt);

      if (mode === "idle") {
        if (ptr.in && ptr.has && ts - enteredAt > 500 && !nearButton(70)) {
          mode = "follow";
          tip = edge(ptr, info());
          amp = 5;
        }
      } else if (mode === "follow") {
        if (!ptr.in || nearButton(50)) {
          mode = "retract";
        } else {
          // aim at a point on the button→cursor line, GAP short of the cursor:
          // the web trails the cursor and backs off whenever it gets close
          const a = info();
          const dx = ptr.x - a.cx;
          const dy = ptr.y - a.cy;
          const d = Math.hypot(dx, dy) || 1;
          const target = { x: ptr.x - (dx / d) * GAP, y: ptr.y - (dy / d) * GAP };
          const k = 1 - Math.exp(-9 * dt);
          const px = tip.x;
          const py = tip.y;
          tip = { x: tip.x + (target.x - tip.x) * k, y: tip.y + (target.y - tip.y) * k };
          const speed = Math.hypot(tip.x - px, tip.y - py) / Math.max(dt, 1e-3);
          amp = Math.max(amp, Math.min(9, speed * 0.012));
          // flinch when the cursor comes near the tip
          if (Math.hypot(ptr.x - tip.x, ptr.y - tip.y) < GAP + 14) amp = Math.max(amp, 7);
        }
      } else {
        const to = edge(tip, info());
        const dx = to.x - tip.x;
        const dy = to.y - tip.y;
        const d = Math.hypot(dx, dy);
        if (d < 10) {
          mode = "idle";
        } else {
          const step = Math.min(2200 * dt, d);
          tip = { x: tip.x + (dx / d) * step, y: tip.y + (dy / d) * step };
        }
      }

      draw(ts);
      if (mode === "idle" && !ptr.in) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(loop);
    }

    const toLocal = (e: PointerEvent) => {
      const r = section.getBoundingClientRect();
      ptr.x = e.clientX - r.left;
      ptr.y = e.clientY - r.top;
    };
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      toLocal(e);
      ptr.in = true;
      ptr.has = true;
      enteredAt = performance.now();
      kick();
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      toLocal(e);
      ptr.has = true;
      if (!ptr.in) {
        ptr.in = true;
        enteredAt = performance.now();
      }
      kick();
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      ptr.in = false;
      if (mode === "follow") mode = "retract";
      kick();
    };

    section.addEventListener("pointerenter", onEnter);
    section.addEventListener("pointermove", onMove);
    section.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      section.removeEventListener("pointerenter", onEnter);
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", onLeave);
      ctx.clearRect(0, 0, w, h);
    };
  }, [supported, on, sectionRef, anchorRef]);

  return { canvasRef, supported, on, setOn };
}

export function WebCanvas({ canvasRef }: { canvasRef: RefObject<HTMLCanvasElement | null> }) {
  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-20 h-full w-full" aria-hidden />;
}

function WebIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden>
      <path d="M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9L4.9 19.1" />
      <path d="M12 6l4 2 2 4-2 4-4 2-4-2-2-4 2-4z" />
      <path d="M12 9.5l2 1 1 1.5-1 1.5-2 1-2-1-1-1.5 1-1.5z" />
    </svg>
  );
}

export function WebToggle({ on, setOn }: { on: boolean; setOn: (v: boolean) => void }) {
  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn(!on)}
        className="group inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.04] py-2 pl-4 pr-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-paper-dim backdrop-blur transition hover:border-white/35 hover:text-paper"
      >
        <WebIcon />
        Web slinger
        <span className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-ember" : "bg-white/15"}`}>
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? "left-[1.1rem]" : "left-0.5"}`} />
        </span>
        <span className="w-6 text-left text-paper">{on ? "On" : "Off"}</span>
      </button>
      <p className="h-4 text-[11px] text-paper-dim/70">{on ? "Move your cursor around — the web follows, but it can\u2019t catch you." : ""}</p>
    </div>
  );
}
