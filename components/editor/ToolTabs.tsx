"use client";

export type ToolKey = "trim" | "captions" | "reframe" | "text" | "stickers" | "filters" | "music";

const TOOLS: { key: ToolKey; label: string }[] = [
  { key: "trim", label: "Trim" },
  { key: "captions", label: "Captions" },
  { key: "reframe", label: "Reframe" },
  { key: "text", label: "Text" },
  { key: "stickers", label: "Stickers" },
  { key: "filters", label: "Filters" },
  { key: "music", label: "Music" },
];

export function ToolTabs({ active, onChange }: { active: ToolKey; onChange: (t: ToolKey) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 border-b border-line p-3">
      {TOOLS.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            active === t.key ? "bg-ember text-ink" : "border border-line-strong text-paper-dim hover:text-paper"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
