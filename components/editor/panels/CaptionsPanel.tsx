"use client";

import { useState, type ReactNode } from "react";
import {
  applyPreset,
  CAPTION_ANIMATIONS,
  CAPTION_PRESETS,
  DEFAULT_CAPTION_STYLE,
  WORD_EFFECTS,
  type CaptionChunk,
  type CaptionStyle,
} from "@/lib/captions";
import { CAPTION_FONT_GROUPS, CAPTION_FONT_LIST, captionFontCss, getCaptionFont } from "@/lib/captionFonts";

export interface CaptionGenState {
  busy: boolean;
  error: string | null;
  /** "whisper_missing" -> offer the one-click install */
  code: string | null;
  installing: boolean;
  onGenerate: (opts: { language: string; translate: boolean; quality: "fast" | "accurate" }) => void;
  onInstall: () => void;
}

const LANGUAGES: [string, string][] = [
  ["auto", "Auto-detect"], ["en", "English"], ["es", "Spanish"], ["fr", "French"], ["de", "German"], ["pt", "Portuguese"],
  ["it", "Italian"], ["nl", "Dutch"], ["pl", "Polish"], ["tr", "Turkish"], ["ru", "Russian"], ["ar", "Arabic"],
  ["fa", "Persian"], ["ur", "Urdu"], ["hi", "Hindi"], ["bn", "Bengali"], ["id", "Indonesian"], ["ja", "Japanese"],
  ["ko", "Korean"], ["zh", "Chinese"],
];

const POSITIONS: { label: string; y: number }[] = [
  { label: "Top", y: 0.2 },
  { label: "Middle", y: 0.5 },
  { label: "Bottom", y: 0.72 },
];

function Section({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-line-strong">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[11px] font-semibold text-paper-dim"
      >
        {title}
        <span className={`transition ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && <div className="space-y-3 px-3 pb-3">{children}</div>}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`block ${disabled ? "opacity-40" : ""}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] text-paper-dim">{label}</span>
        <span className="font-mono text-xs text-paper">{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-3 accent-ember"
      />
    </label>
  );
}

function ColorField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <label className={`block ${disabled ? "opacity-40" : ""}`}>
      <span className="text-[11px] text-paper-dim">{label}</span>
      <div className="mt-1 flex items-center gap-2 rounded-lg border border-line-strong bg-ink-3 px-1.5 py-1">
        <input
          type="color"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent"
        />
        <span className="font-mono text-[11px] uppercase text-paper-dim">{value}</span>
      </div>
    </label>
  );
}

function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.key}
          title={o.hint}
          onClick={() => onChange(o.key)}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
            value === o.key ? "border-ember bg-ember text-ink" : "border-line-strong text-paper-dim hover:text-paper"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function PresetTile({ name, style, active, onClick }: { name: string; style: CaptionStyle; active: boolean; onClick: () => void }) {
  const font = getCaptionFont(style.fontFamily);
  const sample = style.uppercase ? "SAY IT" : "Say it";
  const [a, b] = sample.split(" ");
  const box = style.wordEffect === "box";
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-xl border p-2 transition ${
        active ? "border-ember bg-ember/10" : "border-line-strong hover:border-paper/30"
      }`}
    >
      <span
        className="flex h-9 items-center justify-center whitespace-nowrap rounded-md px-1"
        style={{
          fontFamily: captionFontCss(font.family),
          fontWeight: font.cssWeight,
          // sized like the real caption would look, clamped so every face fits the tile
          fontSize: Math.min(26, Math.max(14, style.fontSize * font.cssScale * 0.36)) * (font.tileFit ?? 1),
          maxWidth: "100%",
          overflow: "hidden",
          color: style.textColor,
          letterSpacing: style.letterSpacing * 0.2,
          WebkitTextStroke: !box && style.outlineWidth > 0 ? `${Math.min(3, style.outlineWidth * 0.35)}px ${style.outlineColor}` : undefined,
          paintOrder: "stroke fill",
          background: style.background && !box ? style.backgroundColor : undefined,
        }}
      >
        <span style={{ opacity: style.wordEffect === "spotlight" ? 0.45 : undefined }}>{a}</span>&nbsp;
        <span
          style={{
            color: style.wordEffect === "none" ? (style.emphasis ? style.emphasisColor : undefined) : box ? undefined : style.highlightColor,
            textDecoration: style.wordEffect === "underline" ? "underline" : undefined,
            background: box ? style.highlightColor : undefined,
            padding: box ? "0 3px" : undefined,
            textShadow: style.wordEffect === "glow" ? `0 0 8px ${style.highlightColor}` : undefined,
          }}
        >
          {b}
        </span>
      </span>
      <span className="text-[10px] font-semibold text-paper-dim">{name}</span>
    </button>
  );
}

export function CaptionsPanel({
  enabled,
  onToggle,
  chunks,
  onChangeChunks,
  style,
  onChangeStyle,
  wordsPerCaption,
  onRegroup,
  canRegroup,
  gen,
}: {
  enabled: boolean;
  onToggle: (v: boolean) => void;
  chunks: CaptionChunk[];
  onChangeChunks: (c: CaptionChunk[]) => void;
  style: CaptionStyle;
  onChangeStyle: (s: CaptionStyle) => void;
  wordsPerCaption: number;
  onRegroup: (n: number) => void;
  canRegroup: boolean;
  gen: CaptionGenState;
}) {
  const [language, setLanguage] = useState("auto");
  const [translate, setTranslate] = useState(false);
  const [quality, setQuality] = useState<"fast" | "accurate">("fast");
  function set<K extends keyof CaptionStyle>(key: K, value: CaptionStyle[K]) {
    onChangeStyle({ ...style, [key]: value });
  }
  function updateChunk(i: number, patch: Partial<CaptionChunk>) {
    onChangeChunks(chunks.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function removeChunk(i: number) {
    onChangeChunks(chunks.filter((_, idx) => idx !== i));
  }
  function addChunk() {
    const last = chunks[chunks.length - 1];
    const start = last ? last.end + 0.2 : 0;
    onChangeChunks([...chunks, { text: "New caption", start, end: start + 2 }]);
  }

  const presetStyles = CAPTION_PRESETS.map((p) => ({ ...p, full: applyPreset(style, p) }));
  const activePreset = presetStyles.find((p) =>
    (Object.keys(p.style) as (keyof CaptionStyle)[])
      .filter((k) => k !== "fontSize" && k !== "positionY")
      .every((k) => p.style[k] === style[k])
  )?.id;

  const isBox = style.wordEffect === "box";
  const highlightLabel = isBox ? "Box color" : style.wordEffect === "karaoke" ? "Fill color" : style.wordEffect === "glow" ? "Glow color" : "Highlight";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm font-semibold text-paper">Captions</h3>
          {enabled && <p className="mt-1 text-xs text-paper-dim">Drag the caption on the preview to move it.</p>}
        </div>
        <button
          onClick={() => onToggle(!enabled)}
          aria-label="Toggle captions"
          className={`h-6 w-11 shrink-0 rounded-full transition ${enabled ? "bg-ember" : "bg-ink-3"}`}
        >
          <span
            className={`block h-5 w-5 translate-y-0.5 rounded-full bg-paper transition ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {enabled && (
        <>
          <Section title="Auto captions">
            <p className="text-[11px] leading-snug text-paper-dim">
              {canRegroup
                ? "Captions came from the speech in this clip. Re-run to fix mistakes or change language."
                : "Transcribe the speech in this clip into word-timed, animated captions."}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[11px] text-paper-dim">Spoken language</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line-strong bg-ink-3 px-2 py-1.5 text-xs text-paper"
                >
                  {LANGUAGES.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <span className="text-[11px] text-paper-dim">Accuracy</span>
                <div className="mt-1 inline-flex w-full rounded-lg border border-line-strong bg-ink-3 p-0.5">
                  {(["fast", "accurate"] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuality(q)}
                      className={`flex-1 rounded-md px-2 py-1 text-[11px] font-semibold capitalize transition ${
                        quality === q ? "bg-paper text-ink" : "text-paper-dim"
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <label className="flex items-center justify-between">
              <span className="text-[11px] text-paper-dim">Translate to English</span>
              <input type="checkbox" checked={translate} onChange={(e) => setTranslate(e.target.checked)} className="accent-ember" />
            </label>
            <button
              onClick={() => gen.onGenerate({ language, translate, quality })}
              disabled={gen.busy}
              className="w-full rounded-full bg-ember py-2 text-xs font-semibold text-ink transition hover:brightness-110 disabled:opacity-60"
            >
              {gen.busy ? "Transcribing… this can take a minute" : canRegroup ? "Re-generate captions" : "✨ Auto-generate captions"}
            </button>
            {gen.error && (
              <div className="rounded-lg border border-ember/40 bg-ember/10 p-2.5">
                <p className="text-[11px] text-ember">{gen.error}</p>
                {gen.code === "whisper_missing" && (
                  <>
                    <button
                      onClick={gen.onInstall}
                      disabled={gen.installing}
                      className="mt-2 rounded-full bg-ember px-3 py-1.5 text-[11px] font-semibold text-ink disabled:opacity-60"
                    >
                      {gen.installing ? "Installing… (a few minutes)" : "Install speech-to-text"}
                    </button>
                    <p className="mt-1.5 text-[11px] text-paper-dim">
                      Runs <code className="text-paper">pip install faster-whisper</code>. The first caption run then downloads a speech model (~150 MB).
                    </p>
                  </>
                )}
              </div>
            )}
          </Section>

          <Section title="Style presets">
            <div className="grid grid-cols-3 gap-2">
              {presetStyles.map((p) => (
                <PresetTile
                  key={p.id}
                  name={p.name}
                  style={p.full}
                  active={activePreset === p.id}
                  onClick={() => onChangeStyle(p.full)}
                />
              ))}
            </div>
          </Section>

          <Section title="Animation">
            <div className="space-y-1.5">
              <span className="text-[11px] text-paper-dim">Caption entrance</span>
              <Chips options={CAPTION_ANIMATIONS} value={style.animation} onChange={(v) => set("animation", v)} />
            </div>
            <div className="space-y-1.5">
              <span className="text-[11px] text-paper-dim">Word effect</span>
              <Chips options={WORD_EFFECTS} value={style.wordEffect} onChange={(v) => set("wordEffect", v)} />
              <p className="text-[11px] text-paper-dim/80">{WORD_EFFECTS.find((e) => e.key === style.wordEffect)?.hint}</p>
            </div>
            <label className="flex items-start justify-between gap-3">
              <span>
                <span className="block text-[11px] text-paper">Auto-emphasize key words</span>
                <span className="block text-[11px] text-paper-dim/80">Numbers, money and impact words get their own colour</span>
              </span>
              <input
                type="checkbox"
                checked={style.emphasis}
                onChange={(e) => set("emphasis", e.target.checked)}
                className="mt-1 accent-ember"
              />
            </label>
            {style.emphasis && <ColorField label="Emphasis color" value={style.emphasisColor} onChange={(v) => set("emphasisColor", v)} />}
          </Section>

          <Section title="Text">
            <div>
              <span className="text-[11px] text-paper-dim">Font</span>
              <div className="mt-1 max-h-60 space-y-2.5 overflow-y-auto rounded-lg border border-line-strong bg-ink-3 p-2">
                {CAPTION_FONT_GROUPS.map((g) => (
                  <div key={g}>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-paper-dim/70">{g}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {CAPTION_FONT_LIST.filter((f) => f.group === g).map((f) => (
                        <button
                          key={f.family}
                          onClick={() => set("fontFamily", f.family)}
                          title={f.label}
                          className={`truncate rounded-md border px-2 py-1.5 text-left text-[15px] leading-tight transition ${
                            style.fontFamily === f.family ? "border-ember bg-ember/10 text-paper" : "border-transparent bg-ink-2 text-paper-dim hover:text-paper"
                          }`}
                          style={{ fontFamily: captionFontCss(f.family), fontWeight: f.cssWeight }}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <Slider label="Size" value={style.fontSize} min={40} max={240} onChange={(v) => set("fontSize", v)} />
            <Slider
              label="Letter spacing"
              value={style.letterSpacing}
              min={-4}
              max={20}
              step={0.5}
              onChange={(v) => set("letterSpacing", v)}
            />
            <label className="flex items-center justify-between">
              <span className="text-[11px] text-paper-dim">UPPERCASE</span>
              <input
                type="checkbox"
                checked={style.uppercase}
                onChange={(e) => set("uppercase", e.target.checked)}
                className="accent-ember"
              />
            </label>
            {canRegroup && (
              <div className="space-y-1.5">
                <span className="text-[11px] text-paper-dim">Words per caption</span>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      onClick={() => onRegroup(n)}
                      className={`h-7 w-7 rounded-full border text-[11px] font-semibold transition ${
                        wordsPerCaption === n ? "border-ember bg-ember text-ink" : "border-line-strong text-paper-dim hover:text-paper"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-paper-dim/80">Re-splits captions from the transcript (resets text edits).</p>
              </div>
            )}
          </Section>

          <Section title="Colors">
            <div className="grid grid-cols-2 gap-3">
              <ColorField label="Text" value={style.textColor} onChange={(v) => set("textColor", v)} />
              <ColorField
                label={highlightLabel}
                value={style.highlightColor}
                onChange={(v) => set("highlightColor", v)}
                disabled={style.wordEffect === "none" || style.wordEffect === "reveal"}
              />
            </div>
          </Section>

          <Section title="Outline & shadow" defaultOpen={false}>
            <div className="grid grid-cols-2 gap-3">
              <ColorField label="Outline" value={style.outlineColor} onChange={(v) => set("outlineColor", v)} disabled={isBox} />
              <ColorField
                label="Shadow"
                value={style.shadowColor}
                onChange={(v) => set("shadowColor", v)}
                disabled={isBox || style.background}
              />
            </div>
            <Slider label="Outline width" value={style.outlineWidth} min={0} max={16} step={0.5} onChange={(v) => set("outlineWidth", v)} disabled={isBox} />
            <Slider
              label="Shadow distance"
              value={style.shadowDepth}
              min={0}
              max={16}
              step={0.5}
              onChange={(v) => set("shadowDepth", v)}
              disabled={isBox || style.background}
            />
            <Slider
              label="Shadow opacity"
              value={style.shadowOpacity}
              min={0}
              max={1}
              step={0.05}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => set("shadowOpacity", v)}
              disabled={isBox || style.background}
            />
            {isBox && <p className="text-[11px] text-paper-dim/80">The word box effect draws its own box instead of an outline.</p>}
          </Section>

          <Section title="Background" defaultOpen={false}>
            <label className={`flex items-center justify-between ${isBox ? "opacity-40" : ""}`}>
              <span className="text-[11px] text-paper-dim">Box behind captions</span>
              <input
                type="checkbox"
                checked={style.background && !isBox}
                disabled={isBox}
                onChange={(e) => set("background", e.target.checked)}
                className="accent-ember"
              />
            </label>
            {style.background && !isBox && (
              <>
                <ColorField label="Box color" value={style.backgroundColor} onChange={(v) => set("backgroundColor", v)} />
                <Slider
                  label="Box opacity"
                  value={style.backgroundOpacity}
                  min={0.1}
                  max={1}
                  step={0.05}
                  format={(v) => `${Math.round(v * 100)}%`}
                  onChange={(v) => set("backgroundOpacity", v)}
                />
              </>
            )}
            {isBox && <p className="text-[11px] text-paper-dim/80">Not available with the word box effect.</p>}
          </Section>

          <Section title="Position">
            <div className="inline-flex rounded-full border border-line-strong bg-ink-3 p-0.5">
              {POSITIONS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => set("positionY", p.y)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    Math.abs(style.positionY - p.y) < 0.01 ? "bg-paper text-ink" : "text-paper-dim"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <Slider
              label="Vertical position"
              value={style.positionY}
              min={0.05}
              max={0.95}
              step={0.005}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => set("positionY", v)}
            />
          </Section>

          <button
            onClick={() => onChangeStyle({ ...DEFAULT_CAPTION_STYLE })}
            className="w-full rounded-full border border-line-strong py-1.5 text-[11px] font-semibold text-paper-dim transition hover:text-paper"
          >
            Reset style to default
          </button>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-paper-dim">Caption text</p>
              <button onClick={addChunk} className="text-[11px] font-semibold text-ember">
                + Add
              </button>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {chunks.map((c, i) => (
                <div key={i} className="rounded-xl border border-line-strong p-2.5">
                  <input
                    value={c.text}
                    onChange={(e) => updateChunk(i, { text: e.target.value })}
                    className="w-full rounded-lg bg-ink-3 px-2 py-1.5 text-sm text-paper"
                  />
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      type="number"
                      step={0.1}
                      value={c.start.toFixed(1)}
                      onChange={(e) => updateChunk(i, { start: parseFloat(e.target.value) || 0 })}
                      className="w-16 rounded-lg bg-ink-3 px-1.5 py-1 font-mono text-[11px] text-paper-dim"
                    />
                    <span className="text-[11px] text-paper-dim">to</span>
                    <input
                      type="number"
                      step={0.1}
                      value={c.end.toFixed(1)}
                      onChange={(e) => updateChunk(i, { end: parseFloat(e.target.value) || 0 })}
                      className="w-16 rounded-lg bg-ink-3 px-1.5 py-1 font-mono text-[11px] text-paper-dim"
                    />
                    <button onClick={() => removeChunk(i)} className="ml-auto text-[11px] text-paper-dim hover:text-ember">
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              {!chunks.length && <p className="text-xs text-paper-dim">No captions yet — add one above.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
