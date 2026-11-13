"use client";

import { Crown, Flame, Mountain, Shuffle, Swords, Target, Trophy, Users, Zap } from "lucide-react";
import { GameButton, Segmented } from "@/components/games/shared/ResultOverlay";
import { useGameStats } from "@/lib/games/scores";
import { BOTS } from "@/lib/games/chess/bots";
import { TIME_CONTROLS, type ModeId } from "@/lib/games/chess/match";
import { PieceSvg } from "./pieces";
import type { ChessPrefs } from "./settings";

export type StartMode = ModeId | "puzzles";

const MODES: { id: StartMode; label: string; blurb: string; icon: React.ReactNode }[] = [
  { id: "bot", label: "Classic", blurb: "Play a bot", icon: <Swords size={16} /> },
  { id: "pass", label: "Pass & Play", blurb: "Two players, one screen", icon: <Users size={16} /> },
  { id: "960", label: "Chess960", blurb: "Shuffled back rank", icon: <Shuffle size={16} /> },
  { id: "koth", label: "King of the Hill", blurb: "Reach the centre to win", icon: <Mountain size={16} /> },
  { id: "threecheck", label: "Three-Check", blurb: "Check three times to win", icon: <Zap size={16} /> },
  { id: "puzzles", label: "Puzzle Rush", blurb: "3 minutes · 3 strikes", icon: <Flame size={16} /> },
  { id: "ladder", label: "Bot Ladder", blurb: "Beat every bot in a row", icon: <Trophy size={16} /> },
];

export function StartScreen({ prefs, setLast, onStart }: { prefs: ChessPrefs; setLast: (l: Partial<ChessPrefs["last"]>) => void; onStart: () => void }) {
  const stats = useGameStats("chess");
  const { mode, botId, side, tcId } = prefs.last;
  const m = mode as StartMode;
  const usesBot = m === "bot" || m === "960" || m === "koth" || m === "threecheck";
  const usesClock = m !== "puzzles";
  const counts = prefs.modeCounts[m];
  return (
    <div className="mx-auto w-full max-w-2xl" data-chess-start>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex -space-x-2">
          <PieceSvg type={2} color={0} className="h-10 w-10" />
          <PieceSvg type={6} color={1} className="h-10 w-10" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-paper">Chess</h2>
          <p className="text-xs text-paper-dim">
            {stats.wins}W · {stats.losses}L · {stats.draws}D vs bots
            {stats.best.puzzleRush !== undefined && ` · Puzzle Rush best ${stats.best.puzzleRush}`}
            {stats.best.ladder !== undefined && ` · Ladder rung ${stats.best.ladder}/${BOTS.length}`}
          </p>
        </div>
      </div>

      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">Mode</p>
      <div className="grid grid-cols-2 gap-2 @md:grid-cols-3 @xl:grid-cols-4">
        {MODES.map((md) => (
          <button
            key={md.id}
            type="button"
            data-mode={md.id}
            onClick={() => setLast({ mode: md.id as ModeId })}
            className={`rounded-xl border px-3 py-2.5 text-left transition ${
              m === md.id ? "border-moss/60 bg-moss/10" : "border-line-strong bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.06]"
            }`}
          >
            <span className={`flex items-center gap-1.5 text-sm font-semibold ${m === md.id ? "text-moss" : "text-paper"}`}>
              {md.icon}
              {md.label}
            </span>
            <span className="mt-0.5 block text-[11px] leading-tight text-paper-dim">{md.blurb}</span>
          </button>
        ))}
      </div>

      {usesBot && (
        <>
          <p className="mb-2 mt-5 font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">Opponent</p>
          <div className="grid grid-cols-2 gap-2 @md:grid-cols-3">
            {BOTS.map((b) => (
              <button
                key={b.id}
                type="button"
                data-bot={b.id}
                onClick={() => setLast({ botId: b.id })}
                className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition ${
                  botId === b.id ? "border-ember/70 bg-ember/10" : "border-line-strong bg-white/[0.03] hover:border-white/30"
                }`}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.07] text-xl">{b.emoji}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-paper">
                    {b.name} <span className="font-normal text-paper-dim">{b.rating}</span>
                  </span>
                  <span className="block truncate text-[11px] text-paper-dim">{b.blurb}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {m === "ladder" && (
        <div className="mt-5 rounded-xl border border-line-strong bg-white/[0.03] p-3">
          <p className="text-sm text-paper">
            Climb from {BOTS[0].name} ({BOTS[0].rating}) to {BOTS[BOTS.length - 1].name} ({BOTS[BOTS.length - 1].rating}). A loss ends the run; a draw lets you retry the rung.
          </p>
          <div className="mt-2 flex items-center gap-1">
            {BOTS.map((b, i) => (
              <span
                key={b.id}
                title={`${b.name} ${b.rating}`}
                className={`grid h-8 flex-1 place-items-center rounded-md text-base ${i < prefs.ladderRung ? "bg-moss/25" : i === prefs.ladderRung ? "bg-ember/25 ring-1 ring-ember" : "bg-white/[0.05]"}`}
              >
                {i < prefs.ladderRung ? <Crown size={14} className="text-moss" /> : b.emoji}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-paper-dim">
            {prefs.ladderRung >= BOTS.length ? "You conquered the ladder! Starting a new run." : `Next: ${BOTS[prefs.ladderRung].name}`} · best {stats.best.ladder ?? 0}/{BOTS.length}
          </p>
        </div>
      )}

      {m === "puzzles" && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-line-strong bg-white/[0.03] p-3">
          <Target className="mt-0.5 shrink-0 text-ember" size={18} />
          <p className="text-sm text-paper">
            Solve as many puzzles as you can in 3 minutes. Three wrong moves and you&apos;re out. Puzzles get harder as you go.
            <span className="mt-1 block text-xs text-paper-dim">Best score: {stats.best.puzzleRush ?? 0}</span>
          </p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3">
        {m !== "puzzles" && m !== "pass" && (
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">Play as</p>
            <Segmented
              value={side}
              onChange={(v) => setLast({ side: v })}
              options={[
                { value: "w", label: "White" },
                { value: "r", label: "Random" },
                { value: "b", label: "Black" },
              ]}
            />
          </div>
        )}
        {usesClock && (
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">Time control</p>
            <Segmented size="sm" value={tcId} onChange={(v) => setLast({ tcId: v })} options={TIME_CONTROLS.map((t) => ({ value: t.id, label: t.id === "none" ? "∞" : t.label, hint: t.group }))} />
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <GameButton variant="primary" onClick={onStart} className="px-8">
          {m === "puzzles" ? "Start rush" : m === "ladder" ? "Climb" : "Play"}
        </GameButton>
        {counts && (
          <span className="text-xs text-paper-dim">
            This mode: {counts.w}W · {counts.l}L · {counts.d}D
          </span>
        )}
      </div>
    </div>
  );
}
