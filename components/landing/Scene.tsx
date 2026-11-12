import { useId } from "react";

// Pure-CSS/SVG stand-ins for video frames — a lit studio backdrop, bokeh,
// light shafts and a rim-lit presenter portrait. Used inside the landing page's
// mock clips so the page ships no video/image assets.

export const SCENES = [
  { sky: "linear-gradient(180deg,#ff8a4c 0%,#ff4e1f 45%,#5b1408 100%)", glow: "#ffd9a8", body: "#1a0905", accent: "#ffb37a" },
  { sky: "linear-gradient(180deg,#2a1b5e 0%,#6a2bd6 55%,#12082b 100%)", glow: "#ff6ad5", body: "#0c0620", accent: "#ff2bd6" },
  { sky: "linear-gradient(180deg,#0b2a4a 0%,#1d6fa3 55%,#06121f 100%)", glow: "#7fe3ff", body: "#04101c", accent: "#25e2ff" },
  { sky: "linear-gradient(180deg,#22340c 0%,#6a9a1c 50%,#0d1505 100%)", glow: "#e7ff9a", body: "#0b1204", accent: "#cdfb5e" },
  { sky: "linear-gradient(180deg,#3a0d1d 0%,#c2185b 50%,#1a0510 100%)", glow: "#ffc1d9", body: "#16040b", accent: "#ff6a8a" },
  { sky: "linear-gradient(180deg,#3b2a12 0%,#d49a2a 50%,#1c1206 100%)", glow: "#fff1b8", body: "#160e04", accent: "#ffd21f" },
] as const;

type SceneTheme = (typeof SCENES)[number];

// deterministic bokeh layout (x%, y%, size%, opacity) — no randomness, so SSR and client match
const BOKEH = [
  [10, 22, 9, 0.5], [22, 12, 5, 0.4], [82, 18, 11, 0.45], [92, 36, 6, 0.35],
  [70, 8, 4, 0.5], [6, 48, 7, 0.3], [88, 56, 8, 0.28], [30, 30, 3, 0.45],
] as const;

// head / hair / gear per variant — silhouettes read as people, not stick figures
function Hair({ v, fill }: { v: number; fill: string }) {
  switch (v) {
    case 1: // long hair, falls behind the shoulders
      return (
        <>
          <path d="M32 38C29 14 42 8 50 8s21 6 18 30c1 16 4 28 9 38H23c5-10 8-22 9-38Z" fill={fill} />
        </>
      );
    case 2: // beanie
      return (
        <>
          <path d="M35.5 29C35 14 42 8 50 8s15 6 14.5 21Z" fill={fill} />
          <rect x="34" y="27" width="32" height="6" rx="3" fill={fill} />
        </>
      );
    case 4: // curls
      return (
        <>
          {[[37, 24, 7], [44, 15, 8], [54, 14, 8], [62, 22, 8], [35, 33, 5], [65, 33, 5]].map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill={fill} />
          ))}
        </>
      );
    case 5: // hood
      return <path d="M30 70C26 40 32 14 50 12s24 28 20 58c-6-8-12-12-20-12s-14 4-20 12Z" fill={fill} />;
    default: // short crop
      return <path d="M36 31C35 16 43 11 50 11s15 5 14 20c-4-7-9-9-14-9s-10 2-14 9Z" fill={fill} />;
  }
}

function Portrait({ v, s, uid }: { v: number; s: SceneTheme; uid: string }) {
  const hairBehind = v === 1 || v === 5;
  return (
    <svg viewBox="0 0 100 120" preserveAspectRatio="xMidYMax meet" className="absolute bottom-0 left-1/2 h-[82%] w-auto -translate-x-1/2 overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={`${uid}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={s.accent} stopOpacity="0.28" />
          <stop offset="0.35" stopColor={s.body} />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <radialGradient id={`${uid}f`} cx="0.68" cy="0.35" r="0.8">
          <stop offset="0" stopColor={s.glow} stopOpacity="0.55" />
          <stop offset="0.6" stopColor={s.body} />
        </radialGradient>
        <linearGradient id={`${uid}r`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.55" stopColor={s.accent} stopOpacity="0" />
          <stop offset="1" stopColor={s.glow} stopOpacity="0.95" />
        </linearGradient>
      </defs>

      {hairBehind && <Hair v={v} fill={s.body} />}

      {/* shoulders + jacket */}
      <path d="M4 120C4 86 22 68 44 62h12c22 6 40 24 40 58Z" fill={`url(#${uid}b)`} />
      {/* rim light along the lit shoulder */}
      <path d="M56 62c22 6 40 24 40 58" fill="none" stroke={`url(#${uid}r)`} strokeWidth="1.4" strokeLinecap="round" />
      {/* lapels / collar */}
      <path d="M44 62l6 22 6-22" fill="none" stroke={s.accent} strokeOpacity="0.28" strokeWidth="1" strokeLinejoin="round" />
      {v === 5 && <path d="M46 84v16M54 84v16" stroke={s.glow} strokeOpacity="0.35" strokeWidth="0.8" strokeLinecap="round" />}
      {/* neck */}
      <path d="M43 48h14v15c-3 4-11 4-14 0Z" fill={s.body} />
      {/* head: soft jaw, lit from the right */}
      <path d="M37 32c0-10 6-17 13-17s13 7 13 17c0 8-3 15-8 18-3 2-7 2-10 0-5-3-8-10-8-18Z" fill={`url(#${uid}f)`} />
      <path d="M63 32c0 8-3 15-8 18" fill="none" stroke={`url(#${uid}r)`} strokeWidth="1.2" strokeLinecap="round" />
      {!hairBehind && <Hair v={v} fill={s.body} />}
      {v === 1 && <path d="M37 30c4-6 11-9 16-8 5 1 9 4 10 8-6-4-12-5-26 0Z" fill={s.body} />}
      {v === 5 && <path d="M38 31c4-7 20-7 24 0-6-4-18-4-24 0Z" fill={s.body} />}

      {/* gear: headphones / glasses / lav mic */}
      {v === 0 && (
        <>
          <path d="M35 34c-2-18 8-24 15-24s17 6 15 24" fill="none" stroke={s.accent} strokeOpacity="0.8" strokeWidth="1.6" strokeLinecap="round" />
          <rect x="32" y="30" width="5.5" height="11" rx="2.5" fill={s.accent} />
          <rect x="62.5" y="30" width="5.5" height="11" rx="2.5" fill={s.accent} />
        </>
      )}
      {v === 3 && (
        <g fill="none" stroke={s.glow} strokeOpacity="0.8" strokeWidth="0.9">
          <rect x="39.5" y="31" width="9" height="6.5" rx="2.5" />
          <rect x="51.5" y="31" width="9" height="6.5" rx="2.5" />
          <path d="M48.5 33.5h3" />
        </g>
      )}
      {(v === 0 || v === 3 || v === 4) && (
        <>
          {/* boom mic in front of the chin */}
          <path d="M92 120V92c0-14-10-22-24-22" fill="none" stroke={s.body} strokeWidth="2" strokeLinecap="round" />
          <rect x="60" y="60" width="9" height="15" rx="4.5" fill="#0a0a0c" stroke={s.glow} strokeOpacity="0.55" strokeWidth="0.8" transform="rotate(-18 64 67)" />
          <path d="M61 64l6 2M60.5 68l6.5 2" stroke={s.glow} strokeOpacity="0.4" strokeWidth="0.6" transform="rotate(-18 64 67)" />
        </>
      )}
      {v === 2 && <circle cx="50" cy="90" r="1.6" fill={s.accent} />}
    </svg>
  );
}

export function Scene({ variant = 0, className = "", blur = false }: { variant?: number; className?: string; blur?: boolean }) {
  const idx = ((variant % SCENES.length) + SCENES.length) % SCENES.length;
  const s = SCENES[idx];
  const uid = useId().replace(/:/g, "");
  return (
    <div className={`absolute inset-0 overflow-hidden ${blur ? "scale-125 blur-xl brightness-75" : ""} ${className}`} style={{ background: s.sky }}>
      {/* key-light bloom */}
      <div
        className="absolute left-[62%] top-[26%] h-[74%] w-[74%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-2xl"
        style={{ background: s.glow }}
      />
      {/* studio light shafts */}
      <div
        className="absolute inset-0 opacity-30 mix-blend-screen"
        style={{ background: `conic-gradient(from 200deg at 78% -8%, transparent 0deg, ${s.glow} 9deg, transparent 20deg, transparent 32deg, ${s.glow} 38deg, transparent 50deg)` }}
      />
      {/* bokeh */}
      {!blur &&
        BOKEH.map(([x, y, d, o], i) => (
          <span
            key={i}
            className="absolute aspect-square rounded-full"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: `${d}%`,
              opacity: o,
              background: `radial-gradient(circle, ${s.glow} 0%, ${s.glow}55 55%, transparent 70%)`,
              filter: "blur(1px)",
            }}
          />
        ))}
      {/* floor falloff */}
      <div className="absolute inset-x-0 bottom-0 h-[42%]" style={{ background: `linear-gradient(180deg, transparent, ${s.body})` }} />
      <Portrait v={idx} s={s} uid={uid} />
      {/* vignette + fine grain */}
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 60% 40%, transparent 45%, rgba(0,0,0,0.5) 100%)" }} />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{ backgroundImage: "repeating-radial-gradient(circle at 0 0, #fff 0 0.6px, transparent 0.6px 3px)" }}
      />
    </div>
  );
}
