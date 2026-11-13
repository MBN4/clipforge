"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { makeRng } from "@/lib/games/snakesladders/layouts";

const COLORS = [
  "#ff4e1f",
  "#cdfb5e",
  "#3db8ff",
  "#ffc233",
  "#ff7ac8",
  "#ffffff",
];

/** One celebratory burst; remount (change `id`) to fire again. */
export function Confetti({ id }: { id: number }) {
  const bits = useMemo(() => {
    const rnd = makeRng(id * 7919 + 13);
    return Array.from({ length: 56 }, (_, i) => {
      const a = rnd() * Math.PI * 2;
      const v = 120 + rnd() * 260;
      return {
        i,
        dx: Math.cos(a) * v,
        dy: Math.sin(a) * v - 120,
        r: rnd() * 720 - 360,
        c: COLORS[i % COLORS.length],
        w: 5 + rnd() * 6,
        d: 1.3 + rnd() * 0.9,
      };
    });
  }, [id]);
  if (!id) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
      aria-hidden
    >
      {bits.map((b) => (
        <motion.span
          key={`${id}-${b.i}`}
          className="absolute left-1/2 top-1/2 block rounded-[2px]"
          style={{ width: b.w, height: b.w * 0.6, background: b.c }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{
            x: b.dx,
            y: [0, b.dy, b.dy + 320],
            opacity: [1, 1, 0],
            rotate: b.r,
          }}
          transition={{ duration: b.d, ease: "easeOut", times: [0, 0.45, 1] }}
        />
      ))}
    </div>
  );
}
