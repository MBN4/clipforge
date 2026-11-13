"use client";

import { Play, Swords, Trophy, Users } from "lucide-react";
import { GameButton, Segmented } from "@/components/games/shared/ResultOverlay";
import { COLOR_NAMES, COLORS, type Color } from "@/lib/games/ludo/board";
import type { Difficulty, Kind, Mode, Settings } from "@/lib/games/ludo/engine";
import type { GameStats } from "@/lib/games/scores";
import type { Prefs } from "./storage";
import { SWATCH } from "./theme";

type Seat = Kind | "off";
const NEXT: Record<Seat, Seat> = { human: "bot", bot: "off", off: "human" };

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center gap-3 rounded-2xl border border-line-strong bg-ink-3/60 px-3 py-2 text-left transition hover:border-white/30"
    >
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-ember" : "bg-white/15"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-paper transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-paper">{label}</span>
        <span className="block text-[11px] leading-snug text-paper-dim">{hint}</span>
      </span>
    </button>
  );
}

export function activeCount(seats: Prefs["seats"]) {
  return COLORS.filter((c) => seats[c] !== "off").length;
}

export function LudoSetup({
  prefs,
  onChange,
  onStart,
  stats,
  captures,
}: {
  prefs: Prefs;
  onChange: (p: Prefs) => void;
  onStart: () => void;
  stats: GameStats;
  captures: number;
}) {
  const { settings, seats } = prefs;
  const set = (patch: Partial<Settings>) => onChange({ ...prefs, settings: { ...settings, ...patch } });
  const count = activeCount(seats);
  const hasBot = COLORS.some((c) => seats[c] === "bot");
  const humans = COLORS.filter((c) => seats[c] === "human").length;

  const setCount = (n: number) => {
    const active: Color[] = n === 2 ? [0, 2] : n === 3 ? [0, 1, 2] : [0, 1, 2, 3];
    const humanKept = COLORS.filter((c) => seats[c] === "human" && active.includes(c));
    const next = { 0: "off", 1: "off", 2: "off", 3: "off" } as Prefs["seats"];
    const firstHuman = humanKept[0] ?? active[0];
    for (const c of active) next[c] = humanKept.length ? (humanKept.includes(c) ? "human" : "bot") : c === firstHuman ? "human" : "bot";
    onChange({ ...prefs, seats: next });
  };
  const cycle = (c: Color) => {
    let nx = NEXT[seats[c]];
    const trial = { ...seats, [c]: nx } as Prefs["seats"];
    const valid = (s: Prefs["seats"]) => COLORS.filter((x) => s[x] !== "off").length >= 2 && COLORS.some((x) => s[x] === "human");
    for (let i = 0; i < 3 && !valid(trial); i++) {
      nx = NEXT[nx];
      trial[c] = nx;
    }
    if (valid(trial)) onChange({ ...prefs, seats: trial });
  };

  const best = stats.best.fewestTurns;
  const bestQ = stats.best.fewestTurnsQuick;
  const tiles: { label: string; value: string }[] = [
    { label: "Wins", value: String(stats.wins) },
    { label: "Played", value: String(stats.played) },
    { label: "Best streak", value: String(stats.bestStreak) },
    { label: "Fewest turns", value: best !== undefined ? String(best) : bestQ !== undefined ? `${bestQ} (quick)` : "-" },
    { label: "Captures", value: String(captures) },
  ];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 rounded-3xl border border-line-strong bg-gradient-to-b from-ink-2 to-ink p-5 @lg:p-7" data-ludo="setup">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-line-strong bg-ink-3">
          <div className="grid grid-cols-2 gap-1">
            {COLORS.map((c) => (
              <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: SWATCH[c].base, boxShadow: `0 0 8px ${SWATCH[c].base}88` }} />
            ))}
          </div>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-paper">Ludo</h2>
          <p className="text-xs text-paper-dim">Roll a six to start, race home, send rivals back to the yard.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 @md:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-line-strong bg-ink/60 px-3 py-2">
            <p className="font-mono text-[9px] uppercase tracking-widest text-paper-dim">{t.label}</p>
            <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-paper">{t.value}</p>
          </div>
        ))}
      </div>

      <section className="space-y-2">
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-dim">
          <Trophy className="h-3 w-3" /> Mode
        </p>
        <Segmented<Mode>
          value={settings.mode}
          onChange={(mode) => set({ mode })}
          options={[
            { value: "classic", label: "Classic - 4 tokens", hint: "All four tokens must reach home" },
            { value: "quick", label: "Quick - 2 tokens", hint: "A shorter race with two tokens each" },
          ]}
        />
      </section>

      <section className="space-y-2">
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-dim">
          <Users className="h-3 w-3" /> Players
        </p>
        <Segmented<number>
          value={count}
          onChange={setCount}
          options={[
            { value: 2, label: "2 players" },
            { value: 3, label: "3 players" },
            { value: 4, label: "4 players" },
          ]}
        />
        <div className="grid grid-cols-2 gap-2 @md:grid-cols-4">
          {COLORS.map((c) => {
            const seat = seats[c];
            return (
              <button
                key={c}
                type="button"
                data-seat={c}
                onClick={() => cycle(c)}
                aria-label={`${COLOR_NAMES[c]}: ${seat}`}
                className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-left transition ${seat === "off" ? "border-line-strong bg-ink/40 opacity-50" : "border-white/25 bg-ink-3"}`}
                style={seat !== "off" ? { boxShadow: `inset 0 0 0 1px ${SWATCH[c].base}55` } : undefined}
              >
                <span className="h-5 w-5 shrink-0 rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, ${SWATCH[c].light}, ${SWATCH[c].base} 55%, ${SWATCH[c].dark})` }} />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-paper">{COLOR_NAMES[c]}</span>
                  <span className="block text-[10px] uppercase tracking-wider text-paper-dim">{seat === "human" ? (humans > 1 ? "Player" : "You") : seat === "bot" ? "Bot" : "Off"}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-paper-dim">Tap a colour to cycle You / Bot / Off. Two or more humans play pass-and-play on this device.</p>
      </section>

      {hasBot && (
        <section className="space-y-2">
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-dim">
            <Swords className="h-3 w-3" /> Bot difficulty
          </p>
          <Segmented<Difficulty>
            value={settings.difficulty}
            onChange={(difficulty) => set({ difficulty })}
            options={[
              { value: "easy", label: "Easy", hint: "Mostly random moves" },
              { value: "medium", label: "Medium", hint: "Captures, safety and finishing first" },
              { value: "hard", label: "Hard", hint: "Also avoids squares within reach of your tokens" },
            ]}
          />
        </section>
      )}

      <section className="grid gap-2 @md:grid-cols-2">
        <Toggle on={settings.tripleSix} onChange={(tripleSix) => set({ tripleSix })} label="Three sixes lose the turn" hint="A third six in a row cancels your last move." />
        <Toggle on={settings.blocks} onChange={(blocks) => set({ blocks })} label="Blocks" hint="Two same-colour tokens on a square can't be passed." />
        <Toggle on={settings.autoMove} onChange={(autoMove) => set({ autoMove })} label="Auto-move" hint="Play the only legal move automatically." />
        <Toggle on={settings.playOn} onChange={(playOn) => set({ playOn })} label="Play on for all ranks" hint="Keep going after the first finisher." />
      </section>

      <GameButton variant="primary" onClick={onStart} className="w-full py-3">
        <Play className="h-4 w-4" /> Start game
      </GameButton>
    </div>
  );
}
