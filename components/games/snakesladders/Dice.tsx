"use client";

const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [1, 0], [2, 0], [0, 2], [1, 2], [2, 2]],
};
// rotation that brings face v to the front
const TARGET: Record<number, [number, number]> = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
const FACE_T: Record<number, string> = {
  1: "rotateY(0deg)",
  6: "rotateY(180deg)",
  2: "rotateY(90deg)",
  5: "rotateY(-90deg)",
  3: "rotateX(90deg)",
  4: "rotateX(-90deg)",
};

function Face({ v, size }: { v: number; size: number }) {
  return (
    <div
      className="absolute inset-0 grid grid-cols-3 grid-rows-3 place-items-center rounded-[18%] border border-black/10 p-[12%]"
      style={{ transform: `${FACE_T[v]} translateZ(${size / 2}px)`, background: "linear-gradient(145deg,#ffffff,#d9d4c8)", backfaceVisibility: "hidden" }}
    >
      {Array.from({ length: 9 }, (_, i) => {
        const r = Math.floor(i / 3);
        const c = i % 3;
        const on = PIPS[v].some(([pr, pc]) => pr === r && pc === c);
        return <span key={i} className="rounded-full" style={{ width: size * 0.17, height: size * 0.17, background: on ? (v === 1 ? "#ff4e1f" : "#15120f") : "transparent", boxShadow: on ? "inset 0 -2px 3px rgba(255,255,255,.2)" : "none" }} />;
      })}
    </div>
  );
}

/** A CSS-3D die. `spin` increases every roll so it keeps tumbling forward before settling on `value`. */
export function Dice({ value, spin, rolling, size = 64 }: { value: number; spin: number; rolling: boolean; size?: number }) {
  const [tx, ty] = TARGET[value] ?? [0, 0];
  // `spin` is cumulative, so each roll tumbles forward before settling
  const rx = tx - 15 + 720 * spin;
  const ry = ty + 15 + 1080 * spin;
  return (
    <div style={{ width: size, height: size, perspective: size * 6 }} aria-label={`Die showing ${value}`} data-die={value}>
      <div
        className="relative h-full w-full"
        style={{
          transformStyle: "preserve-3d",
          transform: `translateY(${rolling ? -size * 0.35 : 0}px) rotateX(${rx}deg) rotateY(${ry}deg)`,
          transition: rolling ? "transform 0.85s cubic-bezier(.2,.7,.25,1)" : "transform 0.3s ease-out",
        }}
      >
        {[1, 2, 3, 4, 5, 6].map((v) => (
          <Face key={v} v={v} size={size} />
        ))}
      </div>
    </div>
  );
}
