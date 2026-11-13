"use client";

import { useState } from "react";
import { Dices, Play, Zap } from "lucide-react";
import { GameButton, Segmented } from "@/components/games/shared/ResultOverlay";
import { useGameStats } from "@/lib/games/scores";
import { useSnlExtra } from "@/lib/games/snakesladders/stats";
import { MODE_INFO, type BoardMode } from "@/lib/games/snakesladders/layouts";
import type { Overshoot } from "@/lib/games/snakesladders/board";
import { unlockAudio } from "@/lib/games/audio";
import { PLAYER_COLORS, POWER_INFO } from "./theme";
import type { PlayerCfg } from "./useSnakesLadders";

export interface SetupState {
  mode: BoardMode;
  style: "bots" | "hotseat";
  count: number;
  names: string[];
  colors: number[];
  overshoot: Overshoot;
  extraTurnOnSix: boolean;
  powerups: boolean;
}

export const DEFAULT_SETUP: SetupState = {
  mode: "classic",
  style: "bots",
  count: 2,
  names: ["You", "Mia", "Leo", "Zoe"],
  colors: [0, 2, 1, 3],
  overshoot: "bounce",
  extraTurnOnSix: true,
  powerups: false,
};

const HOT = ["Player 1", "Player 2", "Player 3", "Player 4"];

export function playersFromSetup(s: SetupState): PlayerCfg[] {
  return Array.from({ length: s.count }, (_, i) => ({
    name: (s.names[i] || "").trim() || (s.style === "bots" ? DEFAULT_SETUP.names[i] : HOT[i]),
    color: s.colors[i],
    human: s.style === "hotseat" || i === 0,
  }));
}

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-start gap-3 rounded-2xl border border-line-strong bg-ink-3/60 p-3 text-left transition hover:border-white/30">
      <span className={`mt-0.5 h-5 w-9 shrink-0 rounded-full p-0.5 transition ${on ? "bg-moss" : "bg-white/15"}`}>
        <span className={`block h-4 w-4 rounded-full bg-ink transition-transform ${on ? "translate-x-4" : ""}`} />
      </span>
      <span>
        <span className="block text-sm font-semibold text-paper">{label}</span>
        <span className="block text-xs leading-snug text-paper-dim">{hint}</span>
      </span>
    </button>
  );
}

export function SetupScreen({ initial, onStart }: { initial: SetupState; onStart: (s: SetupState) => void }) {
  const [s, setS] = useState<SetupState>(initial);
  const stats = useGameStats("snakesladders");
  const extra = useSnlExtra();
  const set = <K extends keyof SetupState>(k: K, v: SetupState[K]) => setS((p) => ({ ...p, [k]: v }));
  const pickColor = (i: number, c: number) =>
    setS((p) => {
      const colors = [...p.colors];
      const other = colors.indexOf(c);
      if (other >= 0) colors[other] = colors[i];
      colors[i] = c;
      return { ...p, colors };
    });
  const nameAt = (i: number) => s.names[i] ?? "";
  const label = (t: string) => <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-paper-dim">{t}</p>;

  return (
    <div className="w-full rounded-3xl border border-line-strong bg-ink-2/80 p-4 @lg:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-moss/15 text-moss">
          <Dices className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-2xl font-semibold tracking-tight text-paper">Snakes &amp; Ladders</h3>
          <p className="text-xs text-paper-dim">Race to the final square. Ladders lift you, snakes drop you.</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 text-center" data-testid="snl-stats">
        {[
          ["Wins", `${stats.wins}/${stats.played}`],
          ["Streak", stats.streak],
          ["Best turns", stats.best.fewestTurns ?? "-"],
          ["Bitten", extra.bitten],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-line-strong bg-ink/60 px-2 py-2">
            <p className="font-mono text-[9px] uppercase tracking-widest text-paper-dim">{k}</p>
            <p className="font-display text-lg font-semibold tabular-nums text-paper">{v}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 @2xl:grid-cols-2">
        <div className="space-y-4">
          <div>
            {label("Board")}
            <Segmented value={s.mode} onChange={(v) => set("mode", v)} options={(Object.keys(MODE_INFO) as BoardMode[]).map((m) => ({ value: m, label: MODE_INFO[m].label, hint: MODE_INFO[m].blurb }))} />
            <p className="mt-1.5 text-xs text-paper-dim">{MODE_INFO[s.mode].blurb}</p>
          </div>
          <div>
            {label("Who plays")}
            <Segmented
              value={s.style}
              onChange={(v) =>
                setS((p) => {
                  const from = p.style === "bots" ? DEFAULT_SETUP.names : HOT;
                  const to = v === "bots" ? DEFAULT_SETUP.names : HOT;
                  return { ...p, style: v, names: p.names.map((n, i) => (n === from[i] ? to[i] : n)) };
                })
              }
              options={[{ value: "bots", label: "You vs bots" }, { value: "hotseat", label: "Hot-seat" }]}
            />
            <div className="mt-2">
              <Segmented value={s.count} onChange={(v) => set("count", v)} options={[2, 3, 4].map((n) => ({ value: n, label: `${n} players` }))} size="sm" />
            </div>
          </div>
          <div className="space-y-2">
            {label("Names & colours")}
            {Array.from({ length: s.count }, (_, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={nameAt(i)}
                  maxLength={12}
                  placeholder={s.style === "bots" ? DEFAULT_SETUP.names[i] : HOT[i]}
                  onChange={(e) => setS((p) => ({ ...p, names: p.names.map((n, k) => (k === i ? e.target.value : n)) }))}
                  aria-label={`Player ${i + 1} name`}
                  className="min-w-0 flex-1 rounded-xl border border-line-strong bg-ink-3 px-3 py-2 text-sm text-paper outline-none focus:border-moss/60"
                />
                {s.style === "bots" && i > 0 && <span className="font-mono text-[9px] uppercase tracking-widest text-paper-dim">bot</span>}
                <div className="flex gap-1.5">
                  {PLAYER_COLORS.map((c, ci) => (
                    <button key={c.id} type="button" aria-label={`${c.label} for player ${i + 1}`} onClick={() => pickColor(i, ci)} className={`h-6 w-6 rounded-full border-2 transition ${s.colors[i] === ci ? "scale-110 border-paper" : "border-transparent opacity-60 hover:opacity-100"}`} style={{ background: c.main }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {label("Rules")}
          <div>
            <Segmented value={s.overshoot} onChange={(v) => set("overshoot", v)} options={[{ value: "bounce", label: "Bounce-back", hint: "Overshooting the last square bounces you back" }, { value: "exact", label: "Exact finish", hint: "You must roll the exact number; otherwise you stay put" }]} />
            <p className="mt-1.5 text-xs text-paper-dim">{s.overshoot === "bounce" ? "Overshoot the finish and you bounce back from it." : "You need the exact number to land on the finish; too high and you stay."}</p>
          </div>
          <Toggle on={s.extraTurnOnSix} onChange={(v) => set("extraTurnOnSix", v)} label="Extra turn on a 6" hint="Roll again after a 6. Three 6s in a row forfeit the turn and send you back." />
          <Toggle on={s.powerups} onChange={(v) => set("powerups", v)} label="Power-up squares (optional)" hint="Adds special squares to the board; classic play stays pure when off." />
          {s.powerups && (
            <ul className="space-y-1 rounded-2xl border border-line-strong bg-ink/60 p-3 text-xs text-paper-dim">
              {(Object.keys(POWER_INFO) as (keyof typeof POWER_INFO)[]).map((k) => (
                <li key={k} className="flex gap-2">
                  <Zap className="mt-0.5 h-3 w-3 shrink-0" style={{ color: POWER_INFO[k].color }} />
                  <span><b className="text-paper">{POWER_INFO[k].label}:</b> {POWER_INFO[k].text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <GameButton
        variant="primary"
        className="mt-6 w-full !py-3 text-base"
        onClick={() => {
          unlockAudio();
          onStart(s);
        }}
      >
        <Play className="h-4 w-4" /> Start game
      </GameButton>
    </div>
  );
}
