"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Trophy } from "lucide-react";
import { GameButton, ResultOverlay, Segmented } from "@/components/games/shared/ResultOverlay";
import { unlockAudio } from "@/lib/games/audio";
import { getGameStats, recordBest, useGameStats } from "@/lib/games/scores";
import {
  MODES,
  dirDelta,
  newGame,
  queueTurn,
  step,
  tickMs,
  type Cell,
  type Dir,
  type SnakeMode,
  type SnakeState,
} from "@/lib/games/snake/engine";
import { snakeSfx } from "@/lib/games/snake/sounds";

type Phase = "idle" | "playing" | "paused" | "over";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

const KEY_DIR: Record<string, Dir> = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right",
};

const CAUSE_TEXT: Record<string, string> = {
  wall: "You hit the wall",
  self: "You bit your own tail",
  rock: "You hit a boulder",
  perfect: "Perfect — you filled the whole board!",
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (c1: [number, number, number], c2: [number, number, number], t: number) =>
  `rgb(${Math.round(lerp(c1[0], c2[0], t))},${Math.round(lerp(c1[1], c2[1], t))},${Math.round(lerp(c1[2], c2[2], t))})`;
const HEAD_C: [number, number, number] = [214, 255, 106];
const TAIL_C: [number, number, number] = [34, 150, 70];

export function SnakeGame() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [mode, setMode] = useState<SnakeMode>("classic");
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<{ score: number; length: number; apples: number; cause: string; newBest: boolean; best: number } | null>(null);
  const stats = useGameStats("snake");
  const bestKey = `score_${mode}`;
  const best = stats.best[bestKey] ?? 0;

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>("idle");
  const stateRef = useRef<SnakeState>(newGame("classic"));
  const prevRef = useRef<Cell[]>([]);
  const accRef = useRef(0);
  const particles = useRef<Particle[]>([]);
  const deathAt = useRef(0);
  const comboRef = useRef(0);
  const endTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reduceMotion = useRef(false);
  const modeRef = useRef<SnakeMode>("classic");

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const start = useCallback(() => {
    unlockAudio();
    clearTimeout(endTimer.current);
    const s = newGame(modeRef.current);
    stateRef.current = s;
    prevRef.current = s.body.map((c) => ({ ...c }));
    accRef.current = 0;
    particles.current = [];
    comboRef.current = 0;
    deathAt.current = 0;
    setScore(0);
    setResult(null);
    setPhaseBoth("playing");
    snakeSfx.start();
  }, [setPhaseBoth]);

  const finish = useCallback(() => {
    const s = stateRef.current;
    const m = modeRef.current;
    const key = `score_${m}`;
    const prevBest = getGameStats("snake").best[key] ?? 0;
    const newBest = s.score > 0 && recordBest("snake", key, s.score);
    recordBest("snake", "games", (getGameStats("snake").best.games ?? 0) + 1);
    if (newBest) snakeSfx.record();
    setResult({ score: s.score, length: s.body.length, apples: s.foodEaten, cause: s.cause ?? "wall", newBest, best: Math.max(prevBest, s.score) });
    setPhaseBoth("over");
  }, [setPhaseBoth]);

  const turn = useCallback((d: Dir) => {
    if (phaseRef.current !== "playing") return;
    const s = stateRef.current;
    const before = s.queue.length;
    queueTurn(s, d);
    if (s.queue.length > before) snakeSfx.turn();
  }, []);

  const togglePause = useCallback(() => {
    if (phaseRef.current === "playing") setPhaseBoth("paused");
    else if (phaseRef.current === "paused") setPhaseBoth("playing");
  }, [setPhaseBoth]);

  // keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const d = KEY_DIR[e.key];
      const p = phaseRef.current;
      if (d && (p === "playing" || p === "paused")) {
        e.preventDefault();
        if (p === "paused") setPhaseBoth("playing");
        turn(d);
      } else if (e.key === " " || e.key === "p" || e.key === "P" || e.key === "Escape") {
        if (p === "playing" || p === "paused") {
          e.preventDefault();
          togglePause();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn, togglePause, setPhaseBoth]);

  // pause when the tab/window loses focus
  useEffect(() => {
    const pause = () => {
      if (phaseRef.current === "playing") setPhaseBoth("paused");
    };
    const onVis = () => document.visibilityState === "hidden" && pause();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", pause);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", pause);
    };
  }, [setPhaseBoth]);

  // touch swipes
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const o = swipe.current;
    if (!o || e.pointerType === "mouse") return;
    const dx = e.clientX - o.x;
    const dy = e.clientY - o.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
    swipe.current = { x: e.clientX, y: e.clientY };
  };

  // render + game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const css = wrap.clientWidth;
      canvas.width = Math.round(css * dpr);
      canvas.height = Math.round(css * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    function burst(c: Cell, color: string, n: number, cs: number) {
      if (reduceMotion.current) return;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = (0.6 + Math.random() * 2.2) * cs * 0.05;
        particles.current.push({ x: (c.x + 0.5) * cs, y: (c.y + 0.5) * cs, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 380 + Math.random() * 380, color, size: cs * (0.06 + Math.random() * 0.08) });
      }
    }

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(100, now - last);
      last = now;
      const s = stateRef.current;
      const cs = canvas!.width / s.size;
      const interval = tickMs(s);

      if (phaseRef.current === "playing" && s.alive) {
        accRef.current += dt;
        let guard = 0;
        while (accRef.current >= interval && s.alive && guard++ < 4) {
          prevRef.current = s.body.map((c) => ({ ...c }));
          const r = step(s);
          accRef.current -= interval;
          if (r.ate) {
            comboRef.current++;
            snakeSfx.eat(comboRef.current);
            burst(s.body[0], "#ff6a4a", 14, cs);
            setScore(s.score);
          } else if (r.ateBonus) {
            snakeSfx.bonus();
            burst(s.body[0], "#ffd21f", 26, cs);
            setScore(s.score);
          }
          if (r.levelUp) snakeSfx.levelUp();
          if (r.died) {
            deathAt.current = now;
            snakeSfx.die();
            burst(s.body[0], "#ff4e1f", 30, cs);
            endTimer.current = setTimeout(finish, 750);
          }
        }
      }
      const t = phaseRef.current === "playing" && s.alive ? Math.min(1, accRef.current / interval) : 1;
      draw(ctx!, canvas!.width, s, prevRef.current, t, now, dt);
    }

    function draw(g: CanvasRenderingContext2D, W: number, s: SnakeState, prev: Cell[], t: number, now: number, dt: number) {
      const cs = W / s.size;
      g.save();
      g.clearRect(0, 0, W, W);

      // shake on death
      const since = deathAt.current ? now - deathAt.current : 9999;
      if (since < 420 && !reduceMotion.current) {
        const k = (1 - since / 420) * cs * 0.28;
        g.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
      }

      // field
      const bg = g.createLinearGradient(0, 0, W, W);
      bg.addColorStop(0, "#10140f");
      bg.addColorStop(1, "#0a0d09");
      g.fillStyle = bg;
      g.fillRect(0, 0, W, W);
      for (let y = 0; y < s.size; y++)
        for (let x = 0; x < s.size; x++)
          if ((x + y) % 2 === 0) {
            g.fillStyle = "rgba(205,251,94,0.028)";
            g.fillRect(x * cs, y * cs, cs, cs);
          }
      // border: deadly walls glow ember, portals glow cyan
      g.lineWidth = cs * 0.14;
      g.strokeStyle = s.mode === "wrap" ? "rgba(90,220,255,0.55)" : "rgba(255,78,31,0.5)";
      if (s.mode === "wrap") g.setLineDash([cs * 0.4, cs * 0.3]);
      g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, W - g.lineWidth, W - g.lineWidth);
      g.setLineDash([]);

      // rocks
      for (const r of s.rocks) {
        const cx = (r.x + 0.5) * cs;
        const cy = (r.y + 0.5) * cs;
        const grad = g.createRadialGradient(cx - cs * 0.15, cy - cs * 0.18, cs * 0.05, cx, cy, cs * 0.5);
        grad.addColorStop(0, "#9aa0a6");
        grad.addColorStop(1, "#3a3f45");
        g.fillStyle = grad;
        g.beginPath();
        g.roundRect(cx - cs * 0.42, cy - cs * 0.38, cs * 0.84, cs * 0.76, cs * 0.28);
        g.fill();
        g.fillStyle = "rgba(0,0,0,0.25)";
        g.beginPath();
        g.ellipse(cx, cy + cs * 0.36, cs * 0.36, cs * 0.08, 0, 0, Math.PI * 2);
        g.fill();
      }

      // apple
      {
        const cx = (s.food.x + 0.5) * cs;
        const cy = (s.food.y + 0.5) * cs;
        const pulse = 1 + Math.sin(now / 220) * 0.05;
        const rad = cs * 0.36 * pulse;
        g.shadowColor = "rgba(255,70,50,0.7)";
        g.shadowBlur = cs * 0.5;
        const grad = g.createRadialGradient(cx - rad * 0.35, cy - rad * 0.4, rad * 0.1, cx, cy, rad * 1.05);
        grad.addColorStop(0, "#ff9a86");
        grad.addColorStop(0.45, "#ff3b2f");
        grad.addColorStop(1, "#a30f1b");
        g.fillStyle = grad;
        g.beginPath();
        g.arc(cx, cy + rad * 0.08, rad, 0, Math.PI * 2);
        g.fill();
        g.shadowBlur = 0;
        g.fillStyle = "#3aa64a";
        g.beginPath();
        g.ellipse(cx + rad * 0.35, cy - rad * 0.85, rad * 0.38, rad * 0.2, -0.6, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = "#5b3a1e";
        g.lineWidth = cs * 0.07;
        g.beginPath();
        g.moveTo(cx, cy - rad * 0.7);
        g.lineTo(cx + rad * 0.08, cy - rad * 1.0);
        g.stroke();
      }

      // bonus star with a shrinking timer ring
      if (s.bonus) {
        const cx = (s.bonus.cell.x + 0.5) * cs;
        const cy = (s.bonus.cell.y + 0.5) * cs;
        const pulse = 1 + Math.sin(now / 130) * 0.1;
        const urgent = s.bonus.ttl < 10 && Math.floor(now / 140) % 2 === 0;
        g.globalAlpha = urgent ? 0.45 : 1;
        g.shadowColor = "rgba(255,210,31,0.9)";
        g.shadowBlur = cs * 0.7;
        g.fillStyle = "#ffd21f";
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const rr = (i % 2 === 0 ? cs * 0.46 : cs * 0.2) * pulse;
          const a = -Math.PI / 2 + (i * Math.PI) / 5 + now / 1400;
          g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        }
        g.closePath();
        g.fill();
        g.shadowBlur = 0;
        g.strokeStyle = "rgba(255,210,31,0.6)";
        g.lineWidth = cs * 0.07;
        g.beginPath();
        g.arc(cx, cy, cs * 0.56, -Math.PI / 2, -Math.PI / 2 + (s.bonus.ttl / 36) * Math.PI * 2);
        g.stroke();
        g.globalAlpha = 1;
      }

      // snake — interpolated between the previous and current tick
      const n = s.body.length;
      const pts = s.body.map((c, i) => {
        const p = prev[i] ?? c;
        const jump = Math.abs(p.x - c.x) > 1.5 || Math.abs(p.y - c.y) > 1.5; // wrapped across an edge: don't smear
        const k = jump ? 1 : t;
        return { x: (lerp(p.x, c.x, k) + 0.5) * cs, y: (lerp(p.y, c.y, k) + 0.5) * cs };
      });
      const dead = !s.alive;
      const flash = dead && Math.floor(since / 110) % 2 === 0;
      // body thickness, tapering over the last few segments
      const width = (i: number) => cs * 0.8 * (i > n - 4 ? 0.62 + 0.38 * ((n - 1 - i) / 3) : 1);
      const seg = (i: number, w: number, color: string, ox = 0, oy = 0) => {
        const a = pts[i];
        const b = pts[i - 1];
        if (!b || Math.hypot(a.x - b.x, a.y - b.y) > cs * 1.6) return;
        g.strokeStyle = color;
        g.lineWidth = w;
        g.beginPath();
        g.moveTo(a.x + ox, a.y + oy);
        g.lineTo(b.x + ox, b.y + oy);
        g.stroke();
      };
      g.lineCap = "round";
      g.lineJoin = "round";
      for (let i = n - 1; i >= 1; i--) seg(i, width(i) * 1.14, "rgba(0,0,0,0.38)", cs * 0.04, cs * 0.06);
      for (let i = n - 1; i >= 1; i--) seg(i, width(i), flash ? "#ff5a3c" : mix(HEAD_C, TAIL_C, i / Math.max(1, n - 1)));
      for (let i = n - 1; i >= 1; i--) seg(i, width(i) * 0.28, "rgba(255,255,255,0.22)", -cs * 0.1, -cs * 0.12);
      // belly stripes
      for (let i = 2; i < n; i += 2) {
        const p = pts[i];
        g.fillStyle = "rgba(0,0,0,0.12)";
        g.beginPath();
        g.arc(p.x, p.y, width(i) * 0.2, 0, Math.PI * 2);
        g.fill();
      }

      // head
      {
        const h = pts[0];
        const d = dirDelta(s.dir);
        const nx = -d.y;
        const ny = d.x;
        g.fillStyle = "rgba(0,0,0,0.38)";
        g.beginPath();
        g.arc(h.x + cs * 0.04, h.y + cs * 0.06, cs * 0.5, 0, Math.PI * 2);
        g.fill();
        const hg = g.createRadialGradient(h.x - cs * 0.15, h.y - cs * 0.15, cs * 0.05, h.x, h.y, cs * 0.5);
        hg.addColorStop(0, flash ? "#ff9a86" : "#f1ffb3");
        hg.addColorStop(1, flash ? "#ff4e1f" : "#b6e84d");
        g.fillStyle = hg;
        g.beginPath();
        g.arc(h.x, h.y, cs * 0.48, 0, Math.PI * 2);
        g.fill();
        // tongue
        if (!dead && Math.sin(now / 260) > 0.55) {
          g.strokeStyle = "#ff3b3b";
          g.lineWidth = cs * 0.06;
          const bx = h.x + d.x * cs * 0.46;
          const by = h.y + d.y * cs * 0.46;
          const tx = bx + d.x * cs * 0.34;
          const ty = by + d.y * cs * 0.34;
          g.beginPath();
          g.moveTo(bx, by);
          g.lineTo(tx, ty);
          g.moveTo(tx, ty);
          g.lineTo(tx + d.x * cs * 0.1 + nx * cs * 0.1, ty + d.y * cs * 0.1 + ny * cs * 0.1);
          g.moveTo(tx, ty);
          g.lineTo(tx + d.x * cs * 0.1 - nx * cs * 0.1, ty + d.y * cs * 0.1 - ny * cs * 0.1);
          g.stroke();
        }
        // eyes
        for (const sgn of [-1, 1]) {
          const ex = h.x + d.x * cs * 0.12 + nx * sgn * cs * 0.22;
          const ey = h.y + d.y * cs * 0.12 + ny * sgn * cs * 0.22;
          g.fillStyle = "#fff";
          g.beginPath();
          g.arc(ex, ey, cs * 0.14, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = dead ? "#ff3b3b" : "#101510";
          g.beginPath();
          g.arc(ex + d.x * cs * 0.05, ey + d.y * cs * 0.05, cs * 0.075, 0, Math.PI * 2);
          g.fill();
        }
      }

      // particles
      const ps = particles.current;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.life += dt;
        if (p.life >= p.max) {
          ps.splice(i, 1);
          continue;
        }
        p.x += p.vx * (dt / 16);
        p.y += p.vy * (dt / 16);
        p.vy += 0.02 * (dt / 16) * cs * 0.05;
        g.globalAlpha = 1 - p.life / p.max;
        g.fillStyle = p.color;
        g.beginPath();
        g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      g.restore();
    }

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      clearTimeout(endTimer.current);
    };
  }, [finish]);

  const bestFor = (m: SnakeMode) => stats.best[`score_${m}`] ?? 0;
  const modeInfo = MODES.find((m) => m.key === mode)!;
  const dpad: { d: Dir; label: string; cls: string }[] = [
    { d: "up", label: "↑", cls: "col-start-2" },
    { d: "left", label: "←", cls: "col-start-1 row-start-2" },
    { d: "right", label: "→", cls: "col-start-3 row-start-2" },
    { d: "down", label: "↓", cls: "col-start-2 row-start-3" },
  ];

  return (
    <div className="mx-auto w-full select-none" style={{ maxWidth: "min(100%, 76vh)" }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-paper-dim">Score</p>
            <p className="font-display text-3xl font-semibold tabular-nums leading-none text-paper">{score}</p>
          </div>
          <div>
            <p className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-paper-dim">
              <Trophy className="h-3 w-3 text-ember" /> Best · {modeInfo.label}
            </p>
            <p className="font-display text-3xl font-semibold tabular-nums leading-none text-ember">{Math.max(best, phase === "playing" ? score : 0)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(phase === "playing" || phase === "paused") && (
            <>
              <button onClick={start} aria-label="Restart" className="flex h-9 w-9 items-center justify-center rounded-full border border-line-strong text-paper-dim transition hover:text-paper">
                <RotateCcw className="h-4 w-4" />
              </button>
              <button onClick={togglePause} aria-label={phase === "paused" ? "Resume" : "Pause"} className="flex h-9 w-9 items-center justify-center rounded-full border border-line-strong text-paper-dim transition hover:text-paper">
                {phase === "paused" ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </button>
            </>
          )}
        </div>
      </div>

      <div
        ref={wrapRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (swipe.current = null)}
        className="relative aspect-square w-full touch-none overflow-hidden rounded-2xl border border-line-strong bg-ink shadow-[0_30px_80px_-30px_rgba(205,251,94,0.18)]"
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="Snake game board" />

        {phase === "idle" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-ink/75 p-4 text-center backdrop-blur-sm">
            <div>
              <h3 className="font-display text-3xl font-semibold tracking-tight text-paper">Snake</h3>
              <p className="mt-1 text-xs text-paper-dim">Arrow keys / WASD · swipe on touch · Space to pause</p>
            </div>
            <Segmented value={mode} onChange={setMode} options={MODES.map((m) => ({ value: m.key, label: m.label, hint: m.blurb }))} />
            <p className="max-w-xs text-xs text-paper-dim">{modeInfo.blurb}</p>
            <GameButton variant="primary" onClick={start}>
              <Play className="h-4 w-4 fill-current" /> Play
            </GameButton>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-paper-dim">
              {MODES.map((m) => (
                <span key={m.key} className={m.key === mode ? "text-paper" : ""}>
                  {m.label} <span className="tabular-nums text-ember">{bestFor(m.key)}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {phase === "paused" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-ink/70 backdrop-blur-sm">
            <p className="font-display text-2xl font-semibold text-paper">Paused</p>
            <GameButton variant="primary" onClick={togglePause}>
              <Play className="h-4 w-4 fill-current" /> Resume
            </GameButton>
            <GameButton variant="ghost" onClick={start}>
              Restart
            </GameButton>
          </div>
        )}

        <ResultOverlay
          open={phase === "over" && !!result}
          outcome={result?.newBest ? "win" : "draw"}
          kicker={result?.cause === "perfect" ? "Flawless" : "Game over"}
          title={`${result?.score ?? 0} points`}
          reason={result ? CAUSE_TEXT[result.cause] : undefined}
          newBest={result?.newBest}
          stats={result ? [
            { label: "Best", value: result.best },
            { label: "Length", value: result.length },
            { label: "Apples", value: result.apples },
            { label: "Mode", value: modeInfo.label },
          ] : undefined}
        >
          <GameButton variant="primary" onClick={start}>
            <RotateCcw className="h-4 w-4" /> Play again
          </GameButton>
          <GameButton variant="ghost" onClick={() => setPhaseBoth("idle")}>
            Change mode
          </GameButton>
        </ResultOverlay>
      </div>

      {/* touch D-pad — only on coarse pointers */}
      <div className="mt-4 hidden justify-center [@media(pointer:coarse)]:flex">
        <div className="grid grid-cols-3 grid-rows-3 gap-1.5">
          {dpad.map((b) => (
            <button
              key={b.d}
              aria-label={b.d}
              onPointerDown={(e) => {
                e.preventDefault();
                turn(b.d);
              }}
              className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-line-strong bg-ink-2 text-xl text-paper active:bg-white/10 ${b.cls}`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
