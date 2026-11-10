"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { CAPTION_PRESETS, DEFAULT_CAPTION_STYLE, type CaptionStyle } from "@/lib/captions";
import { captionFontCss, getCaptionFont } from "@/lib/captionFonts";
import { Scene } from "./Scene";
import { Eyebrow, RevealWords, TiltCard } from "./primitives";

// The real presets from the editor, played back with a simplified renderer —
// enough to show each look and its word effect at a glance.

const SCRIPT = "this is how you make people stop scrolling and actually watch to the end".split(" ");
const PER_CHUNK = 3;
const WORD_MS = 420;
const PHONE_W = 300;
const BOOST = 1.45; // captions read a bit small at phone-mockup size

const PRESETS = CAPTION_PRESETS.map((p) => ({
  id: p.id,
  name: p.name,
  style: { ...DEFAULT_CAPTION_STYLE, ...p.style } as CaptionStyle,
}));

const ENTRANCE: Record<CaptionStyle["animation"], { initial: Record<string, number>; animate: Record<string, number> }> = {
  none: { initial: { opacity: 1 }, animate: { opacity: 1 } },
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 } },
  pop: { initial: { opacity: 0, scale: 0.6 }, animate: { opacity: 1, scale: 1 } },
  bounce: { initial: { opacity: 0, y: -40 }, animate: { opacity: 1, y: 0 } },
  slide: { initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 } },
  zoom: { initial: { opacity: 0, scale: 1.7 }, animate: { opacity: 1, scale: 1 } },
  swing: { initial: { opacity: 0, rotate: -14 }, animate: { opacity: 1, rotate: 0 } },
};

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function Caption({ style, chunk, active }: { style: CaptionStyle; chunk: string[]; active: number }) {
  const font = getCaptionFont(style.fontFamily);
  const k = (PHONE_W / 1080) * BOOST;
  const fontSize = style.fontSize * font.cssScale * k;
  const stroke = style.outlineWidth * k;
  const shadow =
    style.shadowDepth > 0
      ? `${style.shadowDepth * k}px ${style.shadowDepth * k}px 0 ${hexA(style.shadowColor, style.shadowOpacity)}`
      : "none";

  const base: CSSProperties = {
    fontFamily: captionFontCss(style.fontFamily),
    fontWeight: font.cssWeight,
    fontSize,
    letterSpacing: style.letterSpacing * k,
    lineHeight: 1.15,
    color: style.textColor,
    WebkitTextStroke: stroke ? `${stroke}px ${style.outlineColor}` : undefined,
    paintOrder: "stroke fill",
    textShadow: shadow,
  };

  const ent = ENTRANCE[style.animation];
  const eff = style.wordEffect;

  return (
    <motion.div
      initial={ent.initial}
      animate={ent.animate}
      exit={{ opacity: 0, transition: { duration: 0.09 } }}
      transition={style.animation === "bounce" ? { type: "spring", stiffness: 420, damping: 14 } : { duration: 0.28, ease: [0.2, 0.9, 0.3, 1.2] }}
      className="inline-block max-w-[88%] text-center"
      style={
        style.background
          ? { background: hexA(style.backgroundColor, style.backgroundOpacity), padding: "6px 12px", borderRadius: 8 }
          : undefined
      }
    >
      {chunk.map((w, i) => {
        const on = i === active;
        const past = i < active;
        const word = style.uppercase ? w.toUpperCase() : w;
        const s: CSSProperties = { ...base, display: "inline-block", padding: "0 0.12em", transition: "all 140ms ease-out" };
        if ((eff === "highlight" || eff === "glow") && on) s.color = style.highlightColor;
        if (eff === "glow" && on) s.textShadow = `0 0 12px ${style.highlightColor}, 0 0 28px ${style.highlightColor}`;
        if (eff === "pop" && on) {
          s.color = style.highlightColor;
          s.transform = "scale(1.22)";
        }
        if (eff === "karaoke" && (past || on)) {
          s.color = style.highlightColor;
          if (on) s.transition = `color ${WORD_MS}ms linear`;
        }
        if (eff === "box" && on) {
          s.background = style.highlightColor;
          s.borderRadius = 8;
        }
        if (eff === "reveal" && i > active) s.opacity = 0;
        return (
          <span key={i} style={s}>
            {word}
          </span>
        );
      })}
    </motion.div>
  );
}

export function CaptionShowcase() {
  const [presetIdx, setPresetIdx] = useState(0);
  const [tick, setTick] = useState(0);
  const userPicked = useRef(false);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => setTick((t) => t + 1), reduce ? WORD_MS * 3 : WORD_MS);
    return () => clearInterval(id);
  }, [inView, reduce]);

  // auto-cycle looks until someone picks one
  useEffect(() => {
    if (!inView || userPicked.current) return;
    const id = setInterval(() => {
      if (!userPicked.current) setPresetIdx((i) => (i + 1) % PRESETS.length);
    }, 5200);
    return () => clearInterval(id);
  }, [inView]);

  const chunks = Math.ceil(SCRIPT.length / PER_CHUNK);
  const pos = tick % (chunks * PER_CHUNK);
  const chunkIdx = Math.floor(pos / PER_CHUNK);
  const chunk = SCRIPT.slice(chunkIdx * PER_CHUNK, chunkIdx * PER_CHUNK + PER_CHUNK);
  const active = pos % PER_CHUNK;
  const preset = PRESETS[presetIdx];

  return (
    <section id="captions" className="relative overflow-hidden px-5 py-28 sm:px-6 md:py-40">
      <div className="pointer-events-none absolute left-[-10%] top-1/3 h-[480px] w-[480px] rounded-full bg-moss/10 blur-[140px]" />
      <div ref={ref} className="relative mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1fr_1fr]">
        <div className="order-2 flex justify-center lg:order-1">
          <TiltCard max={12} className="rounded-[2.6rem]">
            <div className="relative rounded-[2.6rem] border border-white/15 bg-gradient-to-b from-[#2a2622] to-[#0f0d0b] p-2.5 shadow-[0_60px_120px_-40px_rgba(255,78,31,0.55),inset_0_1px_0_rgba(255,255,255,0.15)]">
              <div
                className="relative overflow-hidden rounded-[2.1rem] bg-ink [transform:translateZ(30px)]"
                style={{ width: PHONE_W, height: (PHONE_W * 16) / 9 }}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={presetIdx % 6}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6 }}
                    className="absolute inset-0"
                  >
                    <Scene variant={presetIdx} blur />
                    <div className="absolute inset-x-0 top-1/2 aspect-video -translate-y-1/2">
                      <Scene variant={presetIdx} />
                    </div>
                  </motion.div>
                </AnimatePresence>
                <div className="absolute left-1/2 top-2 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />
                <div className="absolute inset-x-4 top-10 flex gap-1">
                  {Array.from({ length: chunks }).map((_, i) => (
                    <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
                      <div
                        className="h-full bg-white transition-all duration-300"
                        style={{ width: i < chunkIdx ? "100%" : i === chunkIdx ? `${((active + 1) / PER_CHUNK) * 100}%` : "0%" }}
                      />
                    </div>
                  ))}
                </div>
                <div
                  className="absolute inset-x-0 flex -translate-y-1/2 justify-center"
                  style={{ top: `${preset.style.positionY * 100}%` }}
                >
                  <AnimatePresence mode="wait">
                    <Caption key={`${presetIdx}-${chunkIdx}`} style={preset.style} chunk={chunk} active={active} />
                  </AnimatePresence>
                </div>
                <div className="absolute bottom-4 right-3 flex flex-col items-center gap-3 text-white/90">
                  {["♥", "💬", "↗"].map((g) => (
                    <span key={g} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-sm backdrop-blur">
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </TiltCard>
        </div>

        <div className="order-1 lg:order-2">
          <Eyebrow tone="moss">Animated captions</Eyebrow>
          <h2 className="mt-6 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.03em] md:text-6xl">
            <RevealWords text="Captions that" inView />
            <br />
            <span className="text-paper-dim">
              <RevealWords text="move like you talk." inView delay={0.15} />
            </span>
          </h2>
          <p className="mt-6 max-w-md text-paper-dim">
            Every word is timed to the transcript. Pick a look, then tweak the font, colours, outline, shadow,
            entrance and word effect — the preview matches the export frame for frame.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-2.5">
            {PRESETS.map((p, i) => {
              const on = i === presetIdx;
              const f = getCaptionFont(p.style.fontFamily);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    userPicked.current = true;
                    setPresetIdx(i);
                  }}
                  className={`group relative overflow-hidden rounded-2xl border px-3 py-3.5 text-left transition-all duration-300 ${
                    on
                      ? "border-ember/70 bg-ember/10 shadow-[0_0_30px_-8px_var(--ember)]"
                      : "border-line-strong bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.05]"
                  }`}
                >
                  <span
                    className="block truncate text-xl leading-none"
                    style={{
                      fontFamily: captionFontCss(p.style.fontFamily),
                      fontWeight: f.cssWeight,
                      color: on ? p.style.highlightColor : "var(--paper)",
                      textTransform: p.style.uppercase ? "uppercase" : "none",
                    }}
                  >
                    Aa
                  </span>
                  <span className="mt-2 block font-mono text-[10px] uppercase tracking-widest text-paper-dim">{p.name}</span>
                  {on && <motion.span layoutId="preset-dot" className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-ember" />}
                </button>
              );
            })}
          </div>

          <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-line pt-6 font-mono text-[11px] uppercase tracking-widest">
            <div>
              <dt className="text-paper-dim">Fonts</dt>
              <dd className="mt-1 font-display text-2xl normal-case tracking-tight text-paper">7 bundled</dd>
            </div>
            <div>
              <dt className="text-paper-dim">Entrances</dt>
              <dd className="mt-1 font-display text-2xl normal-case tracking-tight text-paper">6</dd>
            </div>
            <div>
              <dt className="text-paper-dim">Word effects</dt>
              <dd className="mt-1 font-display text-2xl normal-case tracking-tight text-paper">6</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
