"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";

const BOOT_MS = 1500; // first load / refresh
const NAV_MS = 650; // client-side page changes
const NAV_FALLBACK_MS = 5000; // never leave the curtain down if a navigation stalls
// moving between studio dashboard tabs is an in-app view switch, not a page load
const inStudio = (p: string) => /^\/studio(\/|$)/.test(p);

function Counter({ duration }: { duration: number }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => String(Math.round(v)).padStart(3, "0"));
  useEffect(() => {
    const c = animate(mv, 100, { duration, ease: [0.65, 0, 0.35, 1] });
    return () => c.stop();
  }, [mv, duration]);
  return <motion.span>{text}</motion.span>;
}

function Curtain({ boot, duration, reduce }: { boot: boolean; duration: number; reduce: boolean }) {
  const secs = duration / 1000;
  return (
    <motion.div
      // on first load the overlay is already in the server HTML, so it must not animate in
      initial={boot ? false : { y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "-100%", transition: { duration: reduce ? 0.2 : 0.8, ease: [0.76, 0, 0.24, 1] } }}
      transition={{ duration: 0.45, ease: [0.76, 0, 0.24, 1] }}
      className="loader-root fixed inset-0 z-100 flex flex-col items-center justify-center overflow-hidden bg-ink"
      role="status"
      aria-label="Loading"
    >
      <div className="loader-glow pointer-events-none absolute inset-0" aria-hidden />
      <div className="loader-strip loader-strip-top" aria-hidden />
      <div className="loader-strip loader-strip-bottom" aria-hidden />

      <div className="relative flex flex-col items-center">
        {/* mark + orbiting ring */}
        <div className="relative flex h-28 w-28 items-center justify-center">
          <div className="loader-ring absolute inset-0 rounded-full" aria-hidden />
          <div className="loader-ring-2 absolute inset-3 rounded-full" aria-hidden />
          <svg width="52" height="52" viewBox="0 0 22 22" fill="none" aria-hidden>
            <motion.rect
              x="1" y="1" width="20" height="20" rx="5"
              stroke="var(--paper)" strokeOpacity="0.55" strokeWidth="0.9"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />
            <motion.path
              d="M7 6L7 16M7 11H16M16 11L12.5 7.5M16 11L12.5 14.5"
              stroke="var(--ember)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
              transition={{ duration: 0.7, delay: 0.35, ease: "easeInOut" }}
              style={{ filter: "drop-shadow(0 0 4px var(--ember))" }}
            />
          </svg>
        </div>

        {/* wordmark */}
        <div className="mt-6 flex overflow-hidden font-display text-3xl font-semibold tracking-tight text-paper">
          {"Clipforge".split("").map((ch, i) => (
            <motion.span
              key={i}
              initial={{ y: "110%" }}
              animate={{ y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 + i * 0.045, ease: [0.16, 1, 0.3, 1] }}
              className="inline-block"
            >
              {ch}
            </motion.span>
          ))}
        </div>

        {/* progress */}
        <div className="mt-8 w-56">
          <div className="h-0.75 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="loader-bar h-full origin-left rounded-full"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: secs, ease: [0.65, 0, 0.35, 1] }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
            <span>{boot ? "Forging clips" : "Loading"}</span>
            <span className="tabular-nums text-paper">
              <Counter duration={secs} />
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function PageLoader() {
  const pathname = usePathname();
  const reduce = !!useReducedMotion();
  const [visible, setVisible] = useState(true); // true on the server → no flash of the page before the loader
  const [boot, setBoot] = useState(true);
  const [run, setRun] = useState(0);
  const first = useRef(true);
  const prevPath = useRef(pathname);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const stallTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // first load / refresh
  useEffect(() => {
    const min = reduce ? 300 : BOOT_MS;
    const started = performance.now();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      const wait = Math.max(0, min - (performance.now() - started));
      hideTimer.current = setTimeout(() => setVisible(false), wait);
    };
    const ready = Promise.all([
      document.fonts?.ready ?? Promise.resolve(),
      document.readyState === "complete"
        ? Promise.resolve()
        : new Promise<void>((r) => window.addEventListener("load", () => r(), { once: true })),
    ]);
    ready.then(finish, finish);
    const cap = setTimeout(finish, 4000);
    return () => {
      clearTimeout(cap);
      clearTimeout(hideTimer.current);
    };
  }, [reduce]);

  // internal link click → drop the curtain right away, before the route has loaded
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      if (inStudio(url.pathname) && inStudio(location.pathname)) return;
      clearTimeout(hideTimer.current);
      setBoot(false);
      setRun((n) => n + 1);
      setVisible(true);
      clearTimeout(stallTimer.current);
      stallTimer.current = setTimeout(() => setVisible(false), NAV_FALLBACK_MS);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // the route actually changed (also covers back/forward) → hold briefly, then lift
  useEffect(() => {
    const from = prevPath.current;
    prevPath.current = pathname;
    if (first.current) {
      first.current = false;
      return;
    }
    if (inStudio(from) && inStudio(pathname)) return;
    clearTimeout(stallTimer.current);
    clearTimeout(hideTimer.current);
    setBoot(false);
    setRun((n) => n + 1);
    setVisible(true);
    hideTimer.current = setTimeout(() => setVisible(false), reduce ? 200 : NAV_MS);
    return () => clearTimeout(hideTimer.current);
  }, [pathname, reduce]);

  // no scrolling behind the curtain
  useEffect(() => {
    const el = document.documentElement;
    if (visible) el.style.overflow = "hidden";
    else el.style.removeProperty("overflow");
    return () => {
      el.style.removeProperty("overflow");
    };
  }, [visible]);

  const duration = boot ? (reduce ? 300 : BOOT_MS) : reduce ? 200 : NAV_MS + 250;

  return (
    <AnimatePresence>
      {visible && <Curtain key={run} boot={boot && run === 0} duration={duration} reduce={reduce} />}
    </AnimatePresence>
  );
}
