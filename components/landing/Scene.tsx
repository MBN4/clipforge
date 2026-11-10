// Abstract, pure-CSS stand-ins for video frames — a lit backdrop, a glow and a
// speaker silhouette. Used inside the landing page's mock clips so the page
// ships no video/image assets.

export const SCENES = [
  { sky: "linear-gradient(180deg,#ff8a4c 0%,#ff4e1f 45%,#5b1408 100%)", glow: "#ffd9a8", body: "#1a0905", accent: "#ffb37a" },
  { sky: "linear-gradient(180deg,#2a1b5e 0%,#6a2bd6 55%,#12082b 100%)", glow: "#ff6ad5", body: "#0c0620", accent: "#ff2bd6" },
  { sky: "linear-gradient(180deg,#0b2a4a 0%,#1d6fa3 55%,#06121f 100%)", glow: "#7fe3ff", body: "#04101c", accent: "#25e2ff" },
  { sky: "linear-gradient(180deg,#22340c 0%,#6a9a1c 50%,#0d1505 100%)", glow: "#e7ff9a", body: "#0b1204", accent: "#cdfb5e" },
  { sky: "linear-gradient(180deg,#3a0d1d 0%,#c2185b 50%,#1a0510 100%)", glow: "#ffc1d9", body: "#16040b", accent: "#ff6a8a" },
  { sky: "linear-gradient(180deg,#3b2a12 0%,#d49a2a 50%,#1c1206 100%)", glow: "#fff1b8", body: "#160e04", accent: "#ffd21f" },
] as const;

export function Scene({ variant = 0, className = "", blur = false }: { variant?: number; className?: string; blur?: boolean }) {
  const s = SCENES[((variant % SCENES.length) + SCENES.length) % SCENES.length];
  return (
    <div className={`absolute inset-0 overflow-hidden ${blur ? "scale-125 blur-xl brightness-75" : ""} ${className}`} style={{ background: s.sky }}>
      <div
        className="absolute left-1/2 top-[30%] h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-2xl"
        style={{ background: s.glow }}
      />
      {/* horizon lines */}
      <div className="absolute inset-x-0 bottom-0 h-[38%]" style={{ background: `linear-gradient(180deg, transparent, ${s.body})` }} />
      {/* speaker silhouette */}
      <div className="absolute bottom-0 left-1/2 h-[62%] w-[46%] -translate-x-1/2">
        <div
          className="absolute left-1/2 top-0 aspect-square w-[42%] -translate-x-1/2 rounded-full"
          style={{ background: s.body, boxShadow: `0 0 0 2px ${s.accent}22` }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-[62%] rounded-t-[48%]"
          style={{ background: s.body, boxShadow: `0 -2px 0 0 ${s.accent}33` }}
        />
      </div>
    </div>
  );
}
