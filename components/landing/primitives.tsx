"use client";

import Link from "next/link";
import { useRef, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "framer-motion";

/** A link that leans toward the cursor and springs back. */
export function MagneticLink({
  href,
  children,
  className = "",
  strength = 0.35,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const reduce = useReducedMotion();
  const x = useSpring(0, { stiffness: 220, damping: 18, mass: 0.4 });
  const y = useSpring(0, { stiffness: 220, damping: 18, mass: 0.4 });

  function onMove(e: ReactPointerEvent) {
    if (reduce || !ref.current || e.pointerType !== "mouse") return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  }
  function onLeave() {
    x.set(0);
    y.set(0);
  }

  const isHash = href.startsWith("#");
  const inner = (
    <motion.span style={{ x, y }} className="inline-flex">
      {children}
    </motion.span>
  );

  return isHash ? (
    <a ref={ref} href={href} onPointerMove={onMove} onPointerLeave={onLeave} className={className}>
      {inner}
    </a>
  ) : (
    <Link ref={ref} href={href} onPointerMove={onMove} onPointerLeave={onLeave} className={className}>
      {inner}
    </Link>
  );
}

/** Card that tilts in 3D toward the cursor with a moving specular glare. */
export function TiltCard({
  children,
  className = "",
  max = 10,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, { stiffness: 160, damping: 20 });
  const sy = useSpring(py, { stiffness: 160, damping: 20 });
  const rotateY = useTransform(sx, [0, 1], [-max, max]);
  const rotateX = useTransform(sy, [0, 1], [max, -max]);
  const glareX = useTransform(sx, (v) => `${v * 100}%`);
  const glareY = useTransform(sy, (v) => `${v * 100}%`);

  function onMove(e: ReactPointerEvent) {
    if (reduce || !ref.current || e.pointerType !== "mouse") return;
    const r = ref.current.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  }
  function onLeave() {
    px.set(0.5);
    py.set(0.5);
  }

  return (
    <div className="[perspective:1200px]">
      <motion.div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d", ["--gx" as string]: glareX, ["--gy" as string]: glareY }}
        className={`tilt-card group relative ${className}`}
      >
        {children}
        <div className="tilt-glare pointer-events-none absolute inset-0 rounded-[inherit]" />
      </motion.div>
    </div>
  );
}

/** Splits text into words that rise out of a mask, staggered. */
export function RevealWords({
  text,
  className = "",
  delay = 0,
  stagger = 0.06,
  inView = false,
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
  inView?: boolean;
}) {
  const words = text.split(" ");
  const anim = inView
    ? { whileInView: { y: "0%", rotate: 0 }, viewport: { once: true, margin: "-60px" } }
    : { animate: { y: "0%", rotate: 0 } };
  return (
    <span className={className}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.12em] align-bottom">
          <motion.span
            className="inline-block"
            initial={{ y: "110%", rotate: 6 }}
            {...anim}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: delay + i * stagger }}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/** Small mono eyebrow label used above section titles. */
export function Eyebrow({ children, tone = "ember" }: { children: ReactNode; tone?: "ember" | "moss" }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-line-strong bg-ink/60 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] backdrop-blur ${
        tone === "ember" ? "text-ember-soft" : "text-moss"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone === "ember" ? "bg-ember" : "bg-moss"} pulse-dot`} />
      {children}
    </span>
  );
}
