"use client";

import { motion } from "framer-motion";
import { Crop, Gamepad2, Gauge, Scissors, Sparkles, BadgeCheck } from "lucide-react";
import { Scene } from "./Scene";
import { Eyebrow, RevealWords, TiltCard } from "./primitives";

function CardShell({
  icon: Icon,
  title,
  body,
  children,
  className = "",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <TiltCard max={6} className={`h-full rounded-[1.75rem] ${className}`}>
      <div className="bento-card relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.01] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] md:p-7">
        <div className="relative z-10 [transform:translateZ(40px)]">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-ink/60 text-ember-soft">
            <Icon className="h-5 w-5" />
          </span>
          <h3 className="mt-5 font-display text-xl font-semibold tracking-tight">{title}</h3>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-paper-dim">{body}</p>
        </div>
        {children && <div className="relative mt-6 flex-1 [transform:translateZ(20px)]">{children}</div>}
      </div>
    </TiltCard>
  );
}

function ReframeViz() {
  return (
    <div className="relative flex h-full min-h-[230px] items-center justify-center">
      <div className="reframe-box relative overflow-hidden rounded-xl border border-white/20 shadow-[0_20px_60px_-20px_rgba(255,78,31,0.7)]">
        <Scene variant={2} blur />
        <div className="absolute inset-x-0 top-1/2 aspect-video -translate-y-1/2">
          <Scene variant={2} />
        </div>
      </div>
      <span className="absolute bottom-0 left-0 hidden font-mono sm:inline text-[10px] uppercase tracking-widest text-paper-dim">16:9 → 9:16</span>
      <span className="absolute bottom-0 right-0 font-mono text-[10px] uppercase tracking-widest text-moss">blurred backdrop</span>
    </div>
  );
}

function ScoreViz() {
  const rows = [
    { t: "“Nobody tells you this…”", s: 9.6 },
    { t: "“The biggest mistake was…”", s: 8.9 },
    { t: "“So anyway, um…”", s: 3.1 },
  ];
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i}>
          <div className="mb-1.5 flex justify-between font-mono text-[11px] text-paper-dim">
            <span className="truncate">{r.t}</span>
            <span className={r.s > 5 ? "text-moss" : ""}>{r.s.toFixed(1)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${r.s * 10}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, delay: 0.2 + i * 0.15, ease: [0.16, 1, 0.3, 1] }}
              className={`h-full rounded-full ${r.s > 5 ? "bg-gradient-to-r from-ember to-ember-soft" : "bg-white/25"}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function EditorViz() {
  return (
    <div className="rounded-xl border border-white/10 bg-ink/70 p-3">
      <div className="mb-3 flex gap-1.5">
        {["Trim", "Captions", "Reframe", "Text", "Stickers", "Filters", "Music"].map((t, i) => (
          <span
            key={t}
            className={`rounded-md px-2 py-1 font-mono text-[9px] uppercase tracking-wider ${
              i === 1 ? "bg-ember text-ink" : "bg-white/5 text-paper-dim"
            }`}
          >
            {t}
          </span>
        ))}
      </div>
      <div className="relative h-10 overflow-hidden rounded-lg bg-white/5">
        <div className="absolute inset-y-0 left-0 flex w-full gap-px">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="relative flex-1 overflow-hidden opacity-70">
              <Scene variant={i % 3} />
            </div>
          ))}
        </div>
        <div className="trim-window absolute inset-y-0 rounded-md border-2 border-moss shadow-[0_0_0_9999px_rgba(11,10,9,0.6)]" />
        <div className="playhead-slow absolute inset-y-0 w-0.5 bg-white" />
      </div>
    </div>
  );
}

function ZeroViz() {
  return (
    <div className="flex h-full items-end justify-between gap-4">
      <div>
        <div className="font-mono text-xs text-paper-dim line-through decoration-ember decoration-2">$40 / month</div>
        <div className="mt-1 bg-gradient-to-br from-paper to-paper-dim bg-clip-text font-display text-7xl font-semibold leading-none tracking-tighter text-transparent md:text-8xl">
          $0
        </div>
      </div>
      <div className="mb-2 space-y-1.5 text-right font-mono text-[10px] uppercase tracking-widest text-moss">
        <div>✓ no watermark</div>
        <div>✓ no account</div>
        <div>✓ no credits</div>
      </div>
    </div>
  );
}

function ArcadeViz() {
  return (
    <div className="grid grid-cols-8 overflow-hidden rounded-lg border border-white/10">
      {Array.from({ length: 16 }).map((_, i) => {
        const dark = (Math.floor(i / 8) + i) % 2 === 1;
        const piece = { 2: "♞", 5: "♛", 11: "♜", 12: "♚" }[i];
        return (
          <div
            key={i}
            className={`flex aspect-square items-center justify-center text-lg ${dark ? "bg-ember/25" : "bg-white/[0.06]"}`}
          >
            {piece && <span className={i === 2 ? "knight-hop text-paper" : "text-paper/80"}>{piece}</span>}
          </div>
        );
      })}
    </div>
  );
}

export function Features() {
  return (
    <section id="features" className="relative px-5 py-28 sm:px-6 md:py-36">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 flex flex-col gap-6 md:mb-20 md:flex-row md:items-end md:justify-between">
          <div>
            <Eyebrow>Everything included</Eyebrow>
            <h2 className="mt-6 max-w-2xl font-display text-4xl font-semibold leading-[1.02] tracking-[-0.03em] md:text-6xl">
              <RevealWords text="Everything a $40/mo tool does." inView />{" "}
              <span className="text-paper-dim">
                <RevealWords text="For zero." inView delay={0.3} />
              </span>
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-paper-dim">
            Built for people who have better things to do than scrub through an hour of footage looking for the
            fifteen good seconds.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="md:col-span-4 md:row-span-2"
          >
            <CardShell
              icon={Crop}
              title="Smart reframing"
              body="A blurred backdrop keeps the full shot in view instead of butchering a face with a blind crop. Drag to pan and zoom in the editor."
            >
              <ReframeViz />
            </CardShell>
          </motion.div>

          {[
            {
              span: "md:col-span-2",
              icon: Gauge,
              title: "Highlight scoring",
              body: "Every pick comes with a reason it was chosen.",
              viz: <ScoreViz />,
            },
            {
              span: "md:col-span-2",
              icon: Sparkles,
              title: "Claude, if you want it",
              body: "Set an Anthropic key and Claude re-ranks your clips and writes punchy titles. Otherwise the built-in scorer handles it.",
              viz: null,
            },
            {
              span: "md:col-span-3",
              icon: Scissors,
              title: "A real editor, in your browser",
              body: "Trim, reframe, style captions, add text, stickers, colour filters and music — then export in a single ffmpeg pass.",
              viz: <EditorViz />,
            },
            {
              span: "md:col-span-3",
              icon: BadgeCheck,
              title: "Zero cost, zero watermark",
              body: "No subscription, no credits ticking down, nothing stamped in the corner.",
              viz: <ZeroViz />,
            },
            {
              span: "md:col-span-6 lg:col-span-6",
              icon: Gamepad2,
              title: "Play while it renders",
              body: "Chess with four modes, Snake and 2048 live on the processing screen — and you get a ping the moment your clips are ready.",
              viz: (
                <div className="max-w-xs">
                  <ArcadeViz />
                </div>
              ),
            },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.8, delay: 0.08 * (i + 1), ease: [0.16, 1, 0.3, 1] }}
              className={f.span}
            >
              <CardShell icon={f.icon} title={f.title} body={f.body}>
                {f.viz}
              </CardShell>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
