"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, useMotionValueEvent, useScroll, useSpring } from "framer-motion";
import { Logo } from "./Logo";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#captions", label: "Captions" },
  { href: "/#features", label: "Features" },
  { href: "/#pricing", label: "Pricing" },
];

export function Nav() {
  const { scrollY, scrollYProgress } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 24));
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30 });

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:pt-4">
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className={`relative flex w-full items-center justify-between overflow-hidden rounded-full border transition-all duration-500 ${
          scrolled
            ? "max-w-3xl border-white/12 bg-ink/70 py-2 pl-5 pr-2 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl"
            : "max-w-6xl border-transparent bg-transparent py-3 pl-3 pr-3"
        }`}
      >
        <Link href="/" aria-label="Clipforge home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 text-sm text-paper-dim md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full px-3.5 py-1.5 transition hover:bg-white/[0.06] hover:text-paper">
              {l.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/studio"
          className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-full bg-paper px-4 py-2 text-sm font-semibold text-ink transition"
        >
          <span className="absolute inset-0 translate-y-full bg-ember transition-transform duration-300 ease-out group-hover:translate-y-0" />
          <span className="relative">Open Studio</span>
        </Link>
        {scrolled && (
          <motion.span
            style={{ scaleX: progress }}
            className="absolute inset-x-6 bottom-0 h-px origin-left bg-gradient-to-r from-ember via-ember-soft to-moss"
          />
        )}
      </motion.div>
    </header>
  );
}
