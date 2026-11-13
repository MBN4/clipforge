"use client";

// Chess for the Clipforge arcade: start screen → game (vs bot, pass & play, 960, King of the Hill,
// Three-Check, bot ladder) or Puzzle Rush. Self-contained, no props.
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { unlockAudio } from "@/lib/games/audio";
import { BOTS } from "@/lib/games/chess/bots";
import { tcById, type MatchConfig } from "@/lib/games/chess/match";
import type { Color } from "@/lib/games/chess/position";
import { chessSfx } from "@/lib/games/chess/sounds";
import { PlayView } from "./PlayView";
import { PuzzleRush } from "./PuzzleRush";
import { usePrefs, writePrefs } from "./settings";
import { StartScreen } from "./StartScreen";

const CSS = `
.chess-piece { transition: transform 190ms cubic-bezier(.25,.75,.3,1); }
.chess-ghost { animation: chess-fade 200ms ease-out forwards; }
@keyframes chess-fade { to { opacity: 0; transform-origin: center; } }
[data-chess-result] > [role=dialog] { background: rgba(11,10,9,0.38); backdrop-filter: none; -webkit-backdrop-filter: none; }
@media (prefers-reduced-motion: reduce) { .chess-piece { transition-duration: 0ms; } .chess-ghost { animation-duration: 1ms; } }
`;

type Screen = { kind: "start" } | { kind: "play"; cfg: MatchConfig; id: number; ladderRung?: number } | { kind: "puzzles"; id: number };

let gameSeq = 1;

export function ChessGame() {
  const [prefs] = usePrefs();
  const [screen, setScreen] = useState<Screen>({ kind: "start" });

  const pickColor = (side: "w" | "b" | "r"): Color => (side === "w" ? 0 : side === "b" ? 1 : Math.random() < 0.5 ? 0 : 1);

  const startLadder = (rung: number, color?: Color) => {
    const r = rung >= BOTS.length ? 0 : rung;
    if (rung >= BOTS.length) writePrefs({ ladderRung: 0 });
    const cfg: MatchConfig = {
      mode: "ladder",
      botId: BOTS[r].id,
      humanColor: color ?? (r % 2 === 0 ? 0 : 1),
      tc: tcById(prefs.last.tcId),
    };
    setScreen({ kind: "play", cfg, id: gameSeq++, ladderRung: r });
  };

  const start = () => {
    unlockAudio();
    chessSfx.gameStart();
    const l = prefs.last;
    if ((l.mode as string) === "puzzles") {
      setScreen({ kind: "puzzles", id: gameSeq++ });
      return;
    }
    if (l.mode === "ladder") {
      startLadder(prefs.ladderRung);
      return;
    }
    const cfg: MatchConfig = {
      mode: l.mode,
      botId: l.botId,
      humanColor: l.mode === "pass" ? 0 : pickColor(l.side),
      tc: tcById(l.tcId),
      pos960: l.mode === "960" ? Math.floor(Math.random() * 960) : undefined,
    };
    setScreen({ kind: "play", cfg, id: gameSeq++ });
  };

  const rematch = (cfg: MatchConfig) => {
    unlockAudio();
    chessSfx.gameStart();
    const next: MatchConfig = {
      ...cfg,
      humanColor: cfg.mode === "pass" ? 0 : ((cfg.humanColor ^ 1) as Color),
      pos960: cfg.mode === "960" ? Math.floor(Math.random() * 960) : undefined,
    };
    setScreen({ kind: "play", cfg: next, id: gameSeq++ });
  };

  return (
    <div className="relative w-full text-paper" data-chess-root>
      <style>{CSS}</style>
      {screen.kind !== "start" && (
        <button
          type="button"
          onClick={() => setScreen({ kind: "start" })}
          className="mb-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-paper-dim transition hover:bg-white/[0.06] hover:text-paper"
        >
          <ArrowLeft size={14} /> Menu
        </button>
      )}
      {screen.kind === "start" && (
        <StartScreen prefs={prefs} setLast={(l) => writePrefs((p) => ({ last: { ...p.last, ...l } }))} onStart={start} />
      )}
      {screen.kind === "play" && (
        <PlayView
          key={screen.id}
          cfg={screen.cfg}
          onExit={() => setScreen({ kind: "start" })}
          onNewGame={() => {
            // ladder "next rung"
            unlockAudio();
            chessSfx.gameStart();
            if (screen.cfg.mode === "ladder") startLadder((screen.ladderRung ?? 0) + 1);
            else setScreen({ kind: "start" });
          }}
          onRematch={() => {
            if (screen.cfg.mode === "ladder") {
              unlockAudio();
              chessSfx.gameStart();
              // draw → same rung again with colours swapped; loss → fresh run from the bottom
              const r = prefs.ladderRung;
              startLadder(r, r === screen.ladderRung ? ((screen.cfg.humanColor ^ 1) as Color) : undefined);
            } else rematch(screen.cfg);
          }}
          ladder={
            screen.cfg.mode === "ladder"
              ? {
                  rung: screen.ladderRung ?? 0,
                  onWin: () => writePrefs({ ladderRung: (screen.ladderRung ?? 0) + 1 }),
                  onLose: () => writePrefs({ ladderRung: 0 }),
                }
              : undefined
          }
        />
      )}
      {screen.kind === "puzzles" && <PuzzleRush key={screen.id} onExit={() => setScreen({ kind: "start" })} onRestart={() => setScreen({ kind: "puzzles", id: gameSeq++ })} />}
    </div>
  );
}
