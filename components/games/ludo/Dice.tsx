"use client";

import type { CSSProperties } from "react";

// CSS 3D die: a cube that tumbles to the face of the rolled value.
const BASE: Record<number, [number, number]> = {
  1: [0, 0],
  6: [0, 180],
  2: [0, -90],
  5: [0, 90],
  3: [-90, 0],
  4: [90, 0],
};
const FACE_T: Record<number, string> = {
  1: "rotateY(0deg)",
  6: "rotateY(180deg)",
  2: "rotateY(90deg)",
  5: "rotateY(-90deg)",
  3: "rotateX(90deg)",
  4: "rotateX(-90deg)",
};
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export interface Orientation {
  rx: number;
  ry: number;
}

/** Next cube angles that land on `value` after a few forward spins. */
export function nextOrientation(prev: Orientation, value: number): Orientation {
  const [bx, by] = BASE[value];
  const spin = (cur: number, base: number, turns: number) => Math.ceil((cur - base) / 360) * 360 + base + turns * 360;
  return { rx: spin(prev.rx, bx, 2 + Math.floor(Math.random() * 2)), ry: spin(prev.ry, by, 2 + Math.floor(Math.random() * 2)) };
}

function Face({ n, size }: { n: number; size: number }) {
  const half = size / 2;
  return (
    <div
      className="absolute inset-0 grid grid-cols-3 grid-rows-3 place-items-center"
      style={{
        transform: `${FACE_T[n]} translateZ(${half}px)`,
        backfaceVisibility: "hidden",
        borderRadius: size * 0.2,
        padding: size * 0.14,
        background: "linear-gradient(145deg,#fffdf8 0%,#ece5d6 55%,#d8cfbc 100%)",
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12), inset 0 -4px 8px rgba(0,0,0,0.12), inset 0 3px 6px rgba(255,255,255,0.9)",
      }}
    >
      {Array.from({ length: 9 }, (_, i) =>
        PIPS[n].includes(i) ? (
          <span
            key={i}
            style={{
              width: size * 0.17,
              height: size * 0.17,
              borderRadius: "50%",
              background: n === 1 ? "radial-gradient(circle at 35% 30%,#ff7a59,#c2200b)" : "radial-gradient(circle at 35% 30%,#4a4640,#0e0d0c)",
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5)",
            }}
          />
        ) : (
          <span key={i} />
        )
      )}
    </div>
  );
}

export function Die({ orient, rolling, size = 64, dim }: { orient: Orientation; rolling: boolean; size?: number; dim?: boolean }) {
  const style: CSSProperties = {
    width: size,
    height: size,
    transformStyle: "preserve-3d",
    transform: `rotateX(${orient.rx}deg) rotateY(${orient.ry}deg)`,
    transition: rolling ? "transform 0.78s cubic-bezier(0.18,0.72,0.2,1)" : "none",
  };
  return (
    <div
      className="relative"
      style={{ width: size, height: size, perspective: size * 7, opacity: dim ? 0.55 : 1, transition: "opacity .2s" }}
      aria-hidden
    >
      <div className={rolling ? "ludo-die-hop" : ""} style={{ width: size, height: size, transformStyle: "preserve-3d" }}>
        <div style={{ width: size, height: size, transformStyle: "preserve-3d", transform: "rotateX(-18deg) rotateY(-22deg)" }}>
          <div className="absolute left-0 top-0" style={style}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <Face key={n} n={n} size={size} />
            ))}
          </div>
        </div>
      </div>
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full bg-black/50 blur-md"
        style={{ bottom: -size * 0.16, width: size * 0.8, height: size * 0.16, transform: `translateX(-50%) scale(${rolling ? 0.7 : 1})`, transition: "transform .3s" }}
      />
    </div>
  );
}
