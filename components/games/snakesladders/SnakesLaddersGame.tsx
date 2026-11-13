"use client";

import { useState } from "react";
import type { BoardMode } from "@/lib/games/snakesladders/layouts";
import { DEFAULT_SETUP, SetupScreen, playersFromSetup, type SetupState } from "./SetupScreen";
import { GameView } from "./GameView";
import type { GameConfig } from "./useSnakesLadders";

/** Self-contained Snakes & Ladders: start screen, game, result card, rematch. No props. */
export function SnakesLaddersGame() {
  const [setup, setSetup] = useState<SetupState>(DEFAULT_SETUP);
  const [run, setRun] = useState<{ mode: BoardMode; config: GameConfig; id: number } | null>(null);

  return (
    <div className="w-full">
      <style>{`
        @keyframes snl-wobble { 0%,100% { transform: translate(0,0) rotate(0) } 15% { transform: translate(-5px,2px) rotate(-0.5deg) } 35% { transform: translate(5px,-2px) rotate(0.5deg) } 55% { transform: translate(-3px,1px) rotate(-0.3deg) } 75% { transform: translate(2px,0) rotate(0.2deg) } }
        .snl-wobble { animation: snl-wobble 0.55s ease-in-out; }
        @media (prefers-reduced-motion: reduce) { .snl-wobble { animation: none } }
      `}</style>
      {run ? (
        <GameView key={run.id} mode={run.mode} config={run.config} onNewGame={() => setRun(null)} />
      ) : (
        <SetupScreen
          initial={setup}
          onStart={(s) => {
            setSetup(s);
            setRun({ mode: s.mode, id: Date.now(), config: { players: playersFromSetup(s), settings: { overshoot: s.overshoot, extraTurnOnSix: s.extraTurnOnSix, powerups: s.powerups } } });
          }}
        />
      )}
    </div>
  );
}
