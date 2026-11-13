"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { RotateCcw, Shield, Settings2 } from "lucide-react";
import { GameButton, ResultOverlay } from "@/components/games/shared/ResultOverlay";
import { unlockAudio } from "@/lib/games/audio";
import { useGameStats } from "@/lib/games/scores";
import { buildLayout, type BoardMode } from "@/lib/games/snakesladders/layouts";
import { BoardArt } from "./BoardArt";
import { Confetti } from "./Confetti";
import { Dice } from "./Dice";
import { Tokens } from "./Tokens";
import { PLAYER_COLORS, POWER_INFO } from "./theme";
import { useSnakesLadders, type GameConfig } from "./useSnakesLadders";

export function GameView({ mode, config, onNewGame }: { mode: BoardMode; config: GameConfig; onNewGame: () => void }) {
  const [round, setRound] = useState(0);
  // classic keeps one layout; other modes get a fresh board for every rematch
  const layout = useMemo(() => buildLayout(mode, config.settings.powerups), [mode, config.settings.powerups, round]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Round key={round} layout={layout} config={config} onRematch={() => setRound((r) => r + 1)} onNewGame={onNewGame} />;
}

function Round({ layout, config, onRematch, onNewGame }: { layout: ReturnType<typeof buildLayout>; config: GameConfig; onRematch: () => void; onNewGame: () => void }) {
  const reduce = useReducedMotion() ?? false;
  const g = useSnakesLadders(layout, config, reduce);
  const stats = useGameStats("snakesladders");
  const { game } = g;
  const colors = config.players.map((p) => p.color);
  const names = config.players.map((p) => p.name);
  const cur = game.current;
  const curHuman = config.players[cur].human;
  const canRoll = g.phase === "idle" && curHuman && game.winner === null;
  const last = layout.size * layout.size;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.code !== "Enter") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "BUTTON" || t.tagName === "INPUT" || t.tagName === "A")) return;
      if (canRoll) {
        e.preventDefault();
        unlockAudio();
        g.roll();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canRoll, g]);

  const res = g.result;
  const humans = config.players.filter((p) => p.human).length;
  let title = "";
  let reason = "";
  if (res) {
    if (res.soloHuman) {
      title = res.outcome === "win" ? `You won in ${res.turns} turns!` : "You lose";
      reason = res.outcome === "win" ? `You reached ${last} first.` : `${names[res.winner]} reached ${last} first - you lose.`;
    } else {
      title = `${names[res.winner]} wins!`;
      reason = `${names[res.winner]} reached ${last} first in ${res.turns} turns.`;
    }
  }

  const panel = (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      {/* roll area */}
      <div className="flex items-center gap-4 rounded-2xl border border-line-strong bg-ink-2/80 p-3">
        <div className="grid h-[88px] w-[88px] shrink-0 place-items-center">
          <Dice value={g.die.value} spin={g.die.spin} rolling={g.die.rolling} size={56} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.2em] text-paper-dim" data-testid="snl-turn">
            {game.winner !== null ? "Game over" : names[cur] === "You" ? "Your turn" : `${names[cur]}'s turn`}
          </p>
          <AnimatePresence mode="wait">
            {g.phase === "gift" && g.giftInfo ? (
              <motion.div key="gift" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-1 flex flex-col gap-1.5">
                <p className="text-xs text-paper">
                  Gift square! Swap with {names[g.giftInfo.leader]} ({game.players[cur].pos} / {game.players[g.giftInfo.leader].pos})?
                </p>
                <div className="flex gap-2">
                  <GameButton variant="primary" className="!px-3 !py-1.5 !text-xs" onClick={() => g.gift(true)}>Swap</GameButton>
                  <GameButton className="!px-3 !py-1.5 !text-xs" onClick={() => g.gift(false)}>Keep spot</GameButton>
                </div>
              </motion.div>
            ) : (
              <motion.div key="roll" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <GameButton
                  variant="primary"
                  disabled={!canRoll}
                  onClick={() => {
                    unlockAudio();
                    g.roll();
                  }}
                  className="mt-1 w-full !py-3 text-base"
                >
                  {canRoll ? "Roll the dice" : g.phase === "over" ? "Finished" : curHuman ? "Moving..." : `${names[cur]} is rolling...`}
                </GameButton>
              </motion.div>
            )}
          </AnimatePresence>
          <p className="mt-1 hidden text-[10px] text-paper-dim @2xl:block">Press Space or Enter to roll</p>
        </div>
      </div>

      {/* players */}
      <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-1">
        {config.players.map((p, i) => {
          const col = PLAYER_COLORS[p.color];
          const ps = game.players[i];
          const active = i === cur && game.winner === null;
          return (
            <div key={i} data-player={i} data-pos={ps.pos} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 transition ${active ? "bg-white/[0.06]" : "border-line-strong bg-ink-2/60"}`} style={active ? { borderColor: col.main, boxShadow: `0 0 18px -4px ${col.main}` } : undefined}>
              <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, ${col.light}, ${col.main} 55%, ${col.dark})` }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-paper">
                  {p.name}
                  {!p.human && <span className="ml-1 font-mono text-[9px] uppercase tracking-widest text-paper-dim">bot</span>}
                </p>
                <p className="font-mono text-[10px] text-paper-dim">{ps.rolls} rolls</p>
              </div>
              {ps.shield && <Shield className="h-4 w-4" style={{ color: POWER_INFO.shield.color }} aria-label="shielded" />}
              <span className="font-display text-xl font-semibold tabular-nums text-paper" data-testid="snl-pos">{ps.pos}</span>
            </div>
          );
        })}
      </div>

      {/* history */}
      <div className="rounded-2xl border border-line-strong bg-ink-2/60 p-3">
        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-dim">Roll history</p>
        <ul className="max-h-28 space-y-0.5 overflow-hidden text-xs text-paper-dim" data-testid="snl-history">
          {g.history.length === 0 && <li>No rolls yet.</li>}
          {g.history.slice(0, 5).map((h, i) => (
            <li key={g.history.length - i} className={i === 0 ? "text-paper" : ""}>
              <span style={{ color: PLAYER_COLORS[colors[h.player]].main }} className="font-semibold">{names[h.player]}</span> {h.text}
            </li>
          ))}
        </ul>
      </div>

      {/* legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-paper-dim">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-[#d9a35b]" /> ladder up</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-[#22c55e]" /> snake down</span>
        {layout.powers.length > 0 && (Object.keys(POWER_INFO) as (keyof typeof POWER_INFO)[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: POWER_INFO[k].color }} /> {POWER_INFO[k].label.toLowerCase()}</span>
        ))}
      </div>

      <div className="flex gap-2">
        <GameButton onClick={onRematch} className="!px-3 !py-1.5 !text-xs"><RotateCcw className="h-3 w-3" /> Restart</GameButton>
        <GameButton onClick={onNewGame} variant="ghost" className="!px-3 !py-1.5 !text-xs"><Settings2 className="h-3 w-3" /> Settings</GameButton>
      </div>
    </div>
  );

  return (
    <div className="relative flex w-full flex-col gap-4 @2xl:flex-row @2xl:items-start @2xl:justify-center" data-testid="snl-root" data-phase={g.phase} data-turn={g.turnNo}>
      <div className="mx-auto w-full @2xl:mx-0 @2xl:min-w-0 @2xl:flex-1" style={{ maxWidth: "72vh" }}>
        <div key={g.wobble} className={`relative aspect-square w-full overflow-hidden rounded-2xl border border-line-strong shadow-[0_20px_60px_-25px_rgba(0,0,0,0.9)] ${g.wobble ? "snl-wobble" : ""}`} data-testid="snl-board">
          <BoardArt layout={layout} />
          <Tokens store={g.poseStore} colors={colors} size={layout.size} active={game.winner === null ? cur : -1} names={names} />
          <AnimatePresence>
            {g.banner && (
              <motion.div
                key={g.banner.id}
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -8], scale: 1 }}
                transition={{ duration: 1.9, times: [0, 0.12, 0.8, 1] }}
                className={`pointer-events-none absolute inset-x-0 top-3 z-10 mx-auto w-fit max-w-[90%] rounded-full px-4 py-1.5 text-center text-xs font-bold shadow-lg @lg:text-sm ${g.banner.tone === "good" ? "bg-moss text-ink" : g.banner.tone === "bad" ? "bg-red-500 text-white" : "bg-paper text-ink"}`}
                data-testid="snl-banner"
              >
                {g.banner.text}
              </motion.div>
            )}
          </AnimatePresence>
          {!reduce && <Confetti id={g.burst} />}
        </div>
      </div>
      <div className="w-full @2xl:w-64 @2xl:flex-none">{panel}</div>
      <ResultOverlay
        open={res !== null}
        outcome={res ? res.outcome : "win"}
        title={title}
        reason={reason}
        newBest={res?.newBest && res.soloHuman}
        stats={res ? [{ label: "Turns", value: res.turns }, { label: "Snakes bitten", value: res.bitten }, { label: "Ladders climbed", value: res.climbed }, { label: humans === 1 ? "Record" : "Players", value: humans === 1 ? `${stats.wins}W / ${stats.losses}L` : config.players.length }] : undefined}
      >
        <GameButton variant="primary" onClick={onRematch}>Rematch</GameButton>
        <GameButton onClick={onNewGame}>New game</GameButton>
      </ResultOverlay>
    </div>
  );
}
