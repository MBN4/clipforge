"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Chessboard } from "./Chessboard";
import { Snake } from "./Snake";
import { Game2048 } from "./Game2048";

const GAMES = [
  { key: "chess", label: "Chess" },
  { key: "snake", label: "Snake" },
  { key: "2048", label: "2048" },
] as const;

type GameKey = (typeof GAMES)[number]["key"];

function FullscreenIcon({ active }: { active: boolean }) {
  return active ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 8V5a2 2 0 0 1 2-2h3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3" />
    </svg>
  );
}

export function GameHub() {
  const [active, setActive] = useState<GameKey>("chess");
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onChange() {
      setFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleFullscreen() {
    if (!panelRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await panelRef.current.requestFullscreen().catch(() => {});
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <button
        onClick={() => setOpen((o) => !o)}
        className="mx-auto flex items-center gap-2 rounded-full border border-line-strong bg-ink-2 px-5 py-2.5 text-sm font-medium text-paper-dim transition hover:text-paper"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-moss" />
        {open ? "Hide games" : "Bored? Play something while you wait"}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div
              ref={panelRef}
              className={`mt-5 rounded-3xl border border-line-strong bg-ink-2 p-5 ${
                fullscreen ? "flex h-screen w-screen flex-col items-center justify-center" : ""
              }`}
            >
              <div className="mb-5 flex items-center gap-2">
                <div className="inline-flex rounded-full border border-line-strong bg-ink-3 p-1 text-sm">
                  {GAMES.map((g) => (
                    <button
                      key={g.key}
                      onClick={() => setActive(g.key)}
                      className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                        active === g.key ? "bg-paper text-ink" : "text-paper-dim hover:text-paper"
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={toggleFullscreen}
                  title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-line-strong text-paper-dim transition hover:text-paper"
                >
                  <FullscreenIcon active={fullscreen} />
                </button>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="flex justify-center"
                  style={fullscreen ? { transform: "scale(1.5)" } : undefined}
                >
                  {active === "chess" && <Chessboard />}
                  {active === "snake" && <Snake />}
                  {active === "2048" && <Game2048 />}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
