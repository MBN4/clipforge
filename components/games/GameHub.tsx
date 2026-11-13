"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Crown, Dices, Gamepad2, Layers, Maximize, Minimize, TrendingUp, Trophy, Worm, type LucideIcon } from "lucide-react";
import { useGameStats, type GameKey, type GameStats } from "@/lib/games/scores";

// Games load on demand, so the studio page only pays for the one being played.
const Loading = () => (
  <div className="flex h-64 items-center justify-center">
    <div className="h-7 w-7 animate-spin rounded-full border-2 border-line-strong border-t-ember" />
  </div>
);
const ChessGame = dynamic(() => import("./chess/ChessGame").then((m) => m.ChessGame), { ssr: false, loading: Loading });
const SnakeGame = dynamic(() => import("./snake/SnakeGame").then((m) => m.SnakeGame), { ssr: false, loading: Loading });
const LudoGame = dynamic(() => import("./ludo/LudoGame").then((m) => m.LudoGame), { ssr: false, loading: Loading });
const UnoGame = dynamic(() => import("./uno/UnoGame").then((m) => m.UnoGame), { ssr: false, loading: Loading });
const SnakesLaddersGame = dynamic(() => import("./snakesladders/SnakesLaddersGame").then((m) => m.SnakesLaddersGame), { ssr: false, loading: Loading });

interface GameDef {
  key: GameKey;
  title: string;
  tagline: string;
  icon: LucideIcon;
  /** tailwind gradient for the card glow */
  glow: string;
  Component: ComponentType;
  /** one line of stats for the lobby card */
  summary: (s: GameStats) => string;
}

const wl = (s: GameStats) => (s.played ? `${s.wins}W · ${s.losses}L${s.draws ? ` · ${s.draws}D` : ""}` : "No games yet");

const GAMES: GameDef[] = [
  {
    key: "chess",
    title: "Chess",
    tagline: "Bots, puzzles, variants & clocks",
    icon: Crown,
    glow: "from-emerald-500/25",
    Component: ChessGame,
    summary: (s) => {
      const rush = s.best.puzzleRush;
      return [wl(s), rush ? `Puzzle Rush ${rush}` : ""].filter(Boolean).join(" · ");
    },
  },
  {
    key: "snake",
    title: "Snake",
    tagline: "Four modes, speeds up as you grow",
    icon: Worm,
    glow: "from-lime-400/25",
    Component: SnakeGame,
    summary: (s) => {
      const top = Math.max(0, ...Object.entries(s.best).filter(([k]) => k.startsWith("score_")).map(([, v]) => v));
      return top ? `High score ${top}` : "No score yet";
    },
  },
  {
    key: "ludo",
    title: "Ludo",
    tagline: "Race your tokens home",
    icon: Dices,
    glow: "from-rose-500/25",
    Component: LudoGame,
    summary: (s) => (s.played ? `${wl(s)}${s.best.fewestTurns ? ` · Best ${s.best.fewestTurns} turns` : ""}` : "No games yet"),
  },
  {
    key: "uno",
    title: "UNO",
    tagline: "Match, skip, stack, shout UNO",
    icon: Layers,
    glow: "from-amber-400/25",
    Component: UnoGame,
    summary: (s) => (s.played ? `${wl(s)}${s.best.bestMatch ? ` · Best match ${s.best.bestMatch}` : ""}` : "No games yet"),
  },
  {
    key: "snakesladders",
    title: "Snakes & Ladders",
    tagline: "Climb, slide, race to 100",
    icon: TrendingUp,
    glow: "from-sky-400/25",
    Component: SnakesLaddersGame,
    summary: (s) => (s.played ? `${wl(s)}${s.best.fewestTurns ? ` · Best ${s.best.fewestTurns} turns` : ""}` : "No games yet"),
  },
];

function LobbyCard({ game, onPlay }: { game: GameDef; onPlay: () => void }) {
  const stats = useGameStats(game.key);
  const Icon = game.icon;
  return (
    <motion.button
      type="button"
      onClick={onPlay}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      className="group relative overflow-hidden rounded-2xl border border-line-strong bg-ink p-4 text-left transition-colors hover:border-white/30 @lg:p-5"
    >
      <div className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br ${game.glow} to-transparent blur-2xl transition-opacity group-hover:opacity-100`} aria-hidden />
      <Icon className="pointer-events-none absolute -bottom-3 -right-3 h-24 w-24 text-white/[0.04] transition-all duration-500 group-hover:rotate-6 group-hover:scale-110 group-hover:text-white/[0.08]" strokeWidth={1.25} aria-hidden />
      <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-line-strong bg-ink-3 text-paper">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <h3 className="relative mt-4 font-display text-lg font-semibold tracking-tight text-paper">{game.title}</h3>
      <p className="relative mt-1 text-xs leading-relaxed text-paper-dim">{game.tagline}</p>
      <p className="relative mt-4 truncate font-mono text-[10px] uppercase tracking-wider text-paper-dim/80">{game.summary(stats)}</p>
    </motion.button>
  );
}

export function GameHub() {
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<GameKey | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const active = GAMES.find((g) => g.key === activeKey) ?? null;

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // leaving the page while fullscreen shouldn't strand the user there
  useEffect(
    () => () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    },
    []
  );

  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    else await panelRef.current?.requestFullscreen().catch(() => {});
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <button
        onClick={() => setOpen((o) => !o)}
        className="mx-auto flex items-center gap-2 rounded-full border border-line-strong bg-ink-2 px-5 py-2.5 text-sm font-medium text-paper-dim transition hover:text-paper"
      >
        <Gamepad2 className="h-4 w-4 text-moss" />
        {open ? "Hide arcade" : "Bored? Play something while you wait"}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28 }}
            className="overflow-hidden"
          >
            <div
              ref={panelRef}
              className={`@container relative mt-5 border border-line-strong bg-ink-2 p-4 @lg:p-6 ${
                fullscreen ? "flex h-screen w-screen flex-col overflow-auto rounded-none" : "rounded-3xl"
              }`}
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {active ? (
                    <button
                      onClick={() => setActiveKey(null)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-xs font-semibold text-paper-dim transition hover:text-paper"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Arcade
                    </button>
                  ) : (
                    <Gamepad2 className="h-5 w-5 shrink-0 text-moss" />
                  )}
                  <h2 className="truncate font-display text-lg font-semibold tracking-tight text-paper">{active ? active.title : "Arcade"}</h2>
                  {!active && (
                    <span className="hidden items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-paper-dim @md:flex">
                      <Trophy className="h-3 w-3 text-ember" /> Scores are saved on this device
                    </span>
                  )}
                </div>
                <button
                  onClick={toggleFullscreen}
                  title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
                  aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line-strong text-paper-dim transition hover:text-paper"
                >
                  {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </button>
              </div>

              <div className={fullscreen ? "flex flex-1 items-center justify-center" : ""}>
                <AnimatePresence mode="wait">
                  {active ? (
                    <motion.div
                      key={active.key}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                      className="w-full"
                    >
                      <active.Component />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="lobby"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="grid w-full grid-cols-1 gap-3 @md:grid-cols-2 @3xl:grid-cols-3"
                    >
                      {GAMES.map((g) => (
                        <LobbyCard key={g.key} game={g} onPlay={() => setActiveKey(g.key)} />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
