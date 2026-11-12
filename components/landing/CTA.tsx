"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { MagneticLink, RevealWords } from "./primitives";
import { WebCanvas, WebToggle, useWebSlinger } from "./WebSlinger";

export function CTA() {
  const ref = useRef<HTMLElement>(null);
  const btnRef = useRef<HTMLDivElement>(null);
  const web = useWebSlinger(ref, btnRef);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const ringTilt = useTransform(scrollYProgress, [0, 1], [82, 66]);
  const ringScale = useTransform(scrollYProgress, [0, 1], [0.6, 1]);
  const glow = useTransform(scrollYProgress, [0.3, 1], [0, 1]);

  return (
    <section id="pricing" ref={ref} className="relative overflow-hidden px-5 pt-28 pb-36 sm:px-6 md:pt-40 md:pb-48">
      {/* portal */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[620px] justify-center [perspective:1100px]" aria-hidden>
        <motion.div
          style={{ rotateX: ringTilt, scale: ringScale, transformStyle: "preserve-3d" }}
          className="relative mt-[260px] h-[760px] w-[760px] shrink-0"
        >
          <div className="portal-ring absolute inset-0 rounded-full" />
          <div className="portal-ring portal-ring-2 absolute inset-[12%] rounded-full" />
          <div className="portal-ring portal-ring-3 absolute inset-[26%] rounded-full" />
          <div className="absolute inset-[38%] rounded-full bg-ember/40 blur-3xl" />
        </motion.div>
        <motion.div
          style={{ opacity: glow }}
          className="absolute bottom-0 left-1/2 h-[520px] w-[180px] -translate-x-1/2 bg-gradient-to-t from-ember/40 via-ember/10 to-transparent blur-2xl"
        />
      </div>

      <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
        <span className="font-mono text-xs uppercase tracking-[0.3em] text-moss">$0 / month, forever</span>
        <h2 className="mt-6 text-balance font-display text-5xl font-semibold leading-[0.98] tracking-[-0.04em] md:text-8xl">
          <RevealWords text="Your next clip is" inView />{" "}
          <span className="hero-gradient-text italic">
            <RevealWords text="two minutes away." inView delay={0.25} />
          </span>
        </h2>
        <p className="mt-7 max-w-md text-paper-dim">
          No account walls, no card on file. Paste a link and watch it turn into something worth posting.
        </p>
        <div ref={btnRef} className="mt-10">
          <MagneticLink href="/studio" className="cta-primary cta-xl group">
            <span className="relative z-10 inline-flex items-center gap-2.5">
              Open the studio
              <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
            </span>
          </MagneticLink>
        </div>
        {web.supported && <WebToggle on={web.on} setOn={web.setOn} />}
      </div>
      <WebCanvas canvasRef={web.canvasRef} />
    </section>
  );
}
