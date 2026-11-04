"use client";

import { useState } from "react";
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

export function GameHub() {
  const [active, setActive] = useState<GameKey>("chess");
  const [open, setOpen] = useState(false);

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
            <div className="mt-5 rounded-3xl border border-line-strong bg-ink-2 p-5">
              <div className="mb-5 inline-flex rounded-full border border-line-strong bg-ink-3 p-1 text-sm">
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

              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="flex justify-center"
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
