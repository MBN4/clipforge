"use client";

import { Segmented } from "@/components/games/shared/ResultOverlay";
import { PIECE_SETS, PieceSvg, type PieceSet } from "./pieces";
import type { ChessPrefs } from "./settings";
import { THEMES, type BoardTheme } from "./themes";

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-center justify-between py-1 text-xs text-paper">
      <span>{label}</span>
      <span className={`relative h-4.5 w-8 rounded-full transition ${on ? "bg-moss" : "bg-white/15"}`}>
        <span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-ink transition-all ${on ? "left-4" : "left-0.5"}`} />
      </span>
    </button>
  );
}

export function SettingsPanel({ prefs, setPrefs, passAndPlay }: { prefs: ChessPrefs; setPrefs: (p: Partial<ChessPrefs>) => void; passAndPlay?: boolean }) {
  return (
    <div className="space-y-3 rounded-lg border border-line-strong bg-ink-2 p-3" data-settings>
      <div>
        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-dim">Board</p>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(THEMES) as BoardTheme[]).map((t) => (
            <button
              key={t}
              type="button"
              title={THEMES[t].label}
              aria-label={`${THEMES[t].label} board`}
              onClick={() => setPrefs({ theme: t })}
              className={`grid h-8 w-8 grid-cols-2 overflow-hidden rounded-md ring-2 transition ${prefs.theme === t ? "ring-moss" : "ring-transparent hover:ring-white/30"}`}
            >
              <span style={{ background: THEMES[t].light }} />
              <span style={{ background: THEMES[t].dark }} />
              <span style={{ background: THEMES[t].dark }} />
              <span style={{ background: THEMES[t].light }} />
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-dim">Pieces</p>
        <Segmented<PieceSet>
          size="sm"
          value={prefs.pieceSet}
          onChange={(v) => setPrefs({ pieceSet: v })}
          options={PIECE_SETS.map((s) => ({
            value: s.id,
            label: (
              <span className="flex items-center gap-1">
                <PieceSvg type={2} color={0} set={s.id} className="h-4 w-4" />
                {s.label}
              </span>
            ),
          }))}
        />
      </div>
      <div className="divide-y divide-white/5">
        <Toggle label="Show legal moves" on={prefs.showLegal} onChange={(v) => setPrefs({ showLegal: v })} />
        <Toggle label="Coordinates" on={prefs.showCoords} onChange={(v) => setPrefs({ showCoords: v })} />
        <Toggle label="Evaluation bar" on={prefs.showEval} onChange={(v) => setPrefs({ showEval: v })} />
        <Toggle label="Always promote to queen" on={prefs.autoQueen} onChange={(v) => setPrefs({ autoQueen: v })} />
        {passAndPlay && <Toggle label="Auto-flip board" on={prefs.autoFlip} onChange={(v) => setPrefs({ autoFlip: v })} />}
      </div>
    </div>
  );
}
