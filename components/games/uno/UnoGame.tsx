"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Layers, Repeat, Shuffle, Swords, Zap, Hand, Trophy } from "lucide-react";
import { DEFAULT_SETTINGS, Difficulty, UnoSettings } from "@/lib/games/uno/engine";
import { useGameStats } from "@/lib/games/scores";
import { GameButton, ResultOverlay, Segmented } from "@/components/games/shared/ResultOverlay";
import { CardFace, UnoCard } from "./CardArt";
import { Table } from "./Table";
import { SEATS, useUno } from "./useUno";

const PRESETS: { id: string; label: string; blurb: string; patch: Partial<UnoSettings> }[] = [
  { id: "classic", label: "Classic", blurb: "The real rules, nothing extra.", patch: { stacking: false, sevenZero: false, jumpIn: false, drawUntil: false, challenge: false, startCards: 7 } },
  { id: "chaos", label: "Chaos", blurb: "Stacking + 7-0 swaps. Anything goes.", patch: { stacking: true, sevenZero: true, jumpIn: false, drawUntil: false, challenge: false, startCards: 7 } },
  { id: "quick", label: "Quick Round", blurb: "Start with only 4 cards.", patch: { stacking: false, sevenZero: false, jumpIn: false, drawUntil: false, challenge: false, startCards: 4 } },
];

const RULES: { key: "stacking" | "sevenZero" | "jumpIn" | "drawUntil" | "challenge"; label: string; blurb: string }[] = [
  { key: "stacking", label: "Stacking", blurb: "Answer a Draw Two with a Draw Two (Four with Four) — the penalty piles up." },
  { key: "sevenZero", label: "7-0", blurb: "Play a 7 to swap hands with anyone; a 0 passes every hand around the table." },
  { key: "jumpIn", label: "Jump-In", blurb: "Play an identical card (same colour and number) out of turn." },
  { key: "drawUntil", label: "Draw until playable", blurb: "Can't play? Keep drawing until you find a card that works." },
  { key: "challenge", label: "Challenge +4", blurb: "Wild Draw Four can be played any time — and challenged as a bluff." },
];

const sameRules = (a: UnoSettings, b: Partial<UnoSettings>) => (Object.keys(b) as (keyof UnoSettings)[]).every((k) => a[k] === b[k]);

export function UnoGame() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const cw = Math.round(Math.max(50, Math.min(112, width < 640 ? width * 0.17 : width * 0.115)));

  const [cfg, setCfg] = useState<UnoSettings>({ ...DEFAULT_SETTINGS });
  const ctrl = useUno(rootRef);
  const stats = useGameStats("uno");
  const { end } = ctrl;

  const names = (i: number) => SEATS[i].name;
  const iWon = end?.winner === 0;

  return (
    <div
      ref={rootRef}
      className="relative w-full overflow-hidden rounded-3xl border border-line-strong [container-type:inline-size]"
      style={{ minHeight: 560, background: "radial-gradient(120% 90% at 50% 40%, #14392c 0%, #0c241c 55%, #07130f 100%)" }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "22px 22px" }} aria-hidden />
      {ctrl.screen === "start" || !ctrl.settings ? (
        <StartScreen cfg={cfg} setCfg={setCfg} stats={stats} onStart={() => ctrl.startMatch(cfg)} />
      ) : (
        <Table ctrl={ctrl} settings={ctrl.settings} cw={cw} width={width} />
      )}

      {end && !end.matchOver && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm" role="dialog" aria-label="Round over">
          <motion.div initial={{ opacity: 0, y: 24, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 380, damping: 28 }} className="w-full max-w-xs rounded-3xl border border-line-strong bg-ink-2 p-6 text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]" data-uno-round-end>
            <p className={`font-mono text-[10px] uppercase tracking-[0.3em] ${iWon ? "text-moss" : "text-paper-dim"}`}>Round {ctrl.round} complete</p>
            <h3 className="mt-2 font-display text-3xl font-semibold tracking-tight text-paper">{iWon ? "You won the round!" : `${names(end.winner)} won the round`}</h3>
            <p className="mt-1 text-sm text-paper-dim">{end.stalled ? "Nobody could move — fewest cards wins." : `+${end.points} points`}</p>
            <ul className="mt-4 space-y-1.5 text-left">
              {end.scores.map((s, i) => (
                <li key={i} className={`flex items-center justify-between rounded-xl border px-3 py-2 ${i === end.winner ? "border-moss/40 bg-moss/10" : "border-line-strong bg-ink/60"}`}>
                  <span className="text-sm font-semibold text-paper">
                    {SEATS[i].emoji} {names(i)} <span className="font-mono text-[10px] text-paper-dim">· {end.cardsLeft[i]} left</span>
                  </span>
                  <span className="font-display text-lg font-semibold tabular-nums text-paper">{s}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-paper-dim">First to {ctrl.settings?.target}</p>
            <div className="mt-5 flex flex-col gap-2">
              <GameButton variant="primary" onClick={ctrl.nextRound}>
                Next round
              </GameButton>
              <GameButton onClick={ctrl.quit}>New game</GameButton>
            </div>
          </motion.div>
        </div>
      )}

      <ResultOverlay
        open={!!end && end.matchOver}
        outcome={iWon ? "win" : "loss"}
        title={end ? (iWon ? (ctrl.settings && ctrl.settings.target > 0 ? "You won the match!" : "You won the round!") : `${names(end.winner)} won — you lose`) : ""}
        reason={end ? (end.stalled ? "Nobody could move — fewest cards wins" : iWon ? `You went out first · +${end.points} points` : `${names(end.winner)} went out first · you were left with ${end.cardsLeft[0]} card${end.cardsLeft[0] === 1 ? "" : "s"}`) : undefined}
        newBest={!!end && (end.newBestRound || end.newBestMatch)}
        stats={
          end
            ? [
                ...end.scores.map((s, i) => ({ label: `${names(i)} · ${end.cardsLeft[i]} left`, value: ctrl.settings && ctrl.settings.target > 0 ? s : i === end.winner ? `+${end.points}` : "0" })),
                { label: "Your record", value: `${stats.wins}W · ${stats.played}P` },
              ]
            : undefined
        }
      >
        <GameButton variant="primary" onClick={ctrl.rematch}>
          Rematch
        </GameButton>
        <GameButton onClick={ctrl.quit}>New game</GameButton>
      </ResultOverlay>
    </div>
  );
}

function Toggle({ on, onClick, label, blurb, icon }: { on: boolean; onClick: () => void; label: string; blurb: string; icon: React.ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onClick} className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition ${on ? "border-moss/60 bg-moss/10" : "border-line-strong bg-black/20 hover:border-white/30"}`}>
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${on ? "bg-moss text-ink" : "bg-white/10 text-paper-dim"}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-paper">{label}</span>
          <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-moss" : "bg-white/15"}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-ink transition-all ${on ? "left-[18px]" : "left-0.5 !bg-paper"}`} />
          </span>
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug text-paper-dim">{blurb}</span>
      </span>
    </button>
  );
}

const RULE_ICONS = { stacking: <Layers className="h-4 w-4" />, sevenZero: <Repeat className="h-4 w-4" />, jumpIn: <Zap className="h-4 w-4" />, drawUntil: <Hand className="h-4 w-4" />, challenge: <Swords className="h-4 w-4" /> };

function StartScreen({ cfg, setCfg, stats, onStart }: { cfg: UnoSettings; setCfg: (f: (c: UnoSettings) => UnoSettings) => void; stats: ReturnType<typeof useGameStats>; onStart: () => void }) {
  const preset = PRESETS.find((p) => sameRules(cfg, p.patch));
  return (
    <div className="relative px-4 py-6 @lg:px-8">
      <div className="flex flex-col items-center gap-5 @2xl:flex-row @2xl:items-start @2xl:gap-8">
        <div className="flex flex-col items-center gap-4 @2xl:w-56 @2xl:shrink-0">
          <div className="relative h-36 w-44">
            {[
              { c: { id: 1, color: "red" as const, value: "7" as const }, r: -22, x: -4 },
              { c: { id: 2, color: "yellow" as const, value: "skip" as const }, r: -8, x: 28 },
              { c: { id: 3, color: null, value: "wild" as const }, r: 8, x: 62 },
              { c: { id: 4, color: "blue" as const, value: "draw2" as const }, r: 22, x: 92 },
            ].map(({ c, r, x }) => (
              <div key={c.id} className="absolute top-2" style={{ left: x, transform: `rotate(${r}deg)`, transformOrigin: "50% 120%" }}>
                <UnoCard card={c} w={62} />
              </div>
            ))}
          </div>
          <h2 className="font-display text-4xl font-black italic tracking-tight text-paper">UNO</h2>
          <p className="-mt-3 text-center text-xs text-paper-dim">Beat the bots. Shout UNO. Don&apos;t get caught.</p>
          <dl className="grid w-full max-w-xs grid-cols-2 gap-2 text-center">
            {[
              ["Wins", stats.wins],
              ["Played", stats.played],
              ["Streak", stats.streak],
              ["Best streak", stats.bestStreak],
              ["Best round", stats.best.bestRound ?? "—"],
              ["Best match", stats.best.bestMatch ?? "—"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-line-strong bg-black/25 px-2 py-1.5">
                <dt className="font-mono text-[9px] uppercase tracking-widest text-paper-dim">{k}</dt>
                <dd className="font-display text-lg font-semibold tabular-nums text-paper">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
          <section>
            <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">Mode</h3>
            <div className="grid grid-cols-1 gap-2 @md:grid-cols-3">
              {PRESETS.map((p) => (
                <button key={p.id} type="button" onClick={() => setCfg((c) => ({ ...c, ...p.patch }))} aria-pressed={preset?.id === p.id} className={`rounded-2xl border p-3 text-left transition ${preset?.id === p.id ? "border-moss/70 bg-moss/10" : "border-line-strong bg-black/20 hover:border-white/30"}`}>
                  <span className="block text-sm font-semibold text-paper">{p.label}</span>
                  <span className="block text-[11px] leading-snug text-paper-dim">{p.blurb}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">Opponents</span>
              <Segmented<number> value={cfg.players} onChange={(v) => setCfg((c) => ({ ...c, players: v }))} options={[{ value: 2, label: "1 bot" }, { value: 3, label: "2 bots" }, { value: 4, label: "3 bots" }]} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">Difficulty</span>
              <Segmented<Difficulty> value={cfg.difficulty} onChange={(v) => setCfg((c) => ({ ...c, difficulty: v }))} options={[{ value: "easy", label: "Easy" }, { value: "medium", label: "Medium" }, { value: "hard", label: "Hard" }]} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">Play to</span>
              <Segmented<number> value={cfg.target} onChange={(v) => setCfg((c) => ({ ...c, target: v }))} options={[{ value: 0, label: "1 round" }, { value: 200, label: "200" }, { value: 500, label: "500" }]} />
            </label>
          </section>

          <section>
            <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">House rules {cfg.startCards !== 7 && <span className="text-moss">· {cfg.startCards} cards each</span>}</h3>
            <div className="grid grid-cols-1 gap-2 @xl:grid-cols-2">
              {RULES.map((r) => (
                <Toggle key={r.key} on={cfg[r.key]} onClick={() => setCfg((c) => ({ ...c, [r.key]: !c[r.key] }))} label={r.label} blurb={r.blurb} icon={RULE_ICONS[r.key]} />
              ))}
              <Toggle on={cfg.startCards === 4} onClick={() => setCfg((c) => ({ ...c, startCards: c.startCards === 4 ? 7 : 4 }))} label="Quick deal" blurb="Everyone starts with 4 cards instead of 7." icon={<Shuffle className="h-4 w-4" />} />
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <GameButton variant="primary" onClick={onStart} className="px-8 py-3 text-base">
              <Trophy className="h-4 w-4" /> Deal me in
            </GameButton>
            <span className="text-[11px] text-paper-dim">Press <b className="text-paper">UNO!</b> when you hold two cards — or a bot may catch you.</span>
          </div>
        </div>
      </div>
      <div className="hidden">
        <CardFace card={{ id: 0, color: "red", value: "0" }} />
      </div>
    </div>
  );
}
