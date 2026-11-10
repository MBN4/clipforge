const ROW_A = ["YouTube", "Instagram Reels", "TikTok", "Facebook", "YouTube Shorts", "Your own uploads"];
const ROW_B = [
  "Word-by-word captions",
  "9:16 reframing",
  "Highlight scoring",
  "No watermark",
  "In-browser editor",
  "$0 forever",
];

function Row({ items, reverse = false, tone }: { items: string[]; reverse?: boolean; tone: "solid" | "outline" }) {
  const doubled = [...items, ...items];
  return (
    <div className="flex overflow-hidden">
      <div className={`flex shrink-0 items-center gap-10 pr-10 ${reverse ? "animate-marquee-reverse" : "animate-marquee"}`}>
        {doubled.map((t, i) => (
          <span key={i} className="flex items-center gap-10 whitespace-nowrap">
            <span
              className={`font-display text-4xl font-semibold tracking-tight md:text-6xl ${
                tone === "solid" ? "text-paper" : "text-outline"
              }`}
            >
              {t}
            </span>
            <span className={`text-2xl md:text-4xl ${tone === "solid" ? "text-ember" : "text-moss"}`}>✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Marquee() {
  return (
    <section aria-label="Supported sources and features" className="relative overflow-hidden py-16 md:py-24">
      <div className="-rotate-2 space-y-5 [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
        <Row items={ROW_A} tone="solid" />
        <Row items={ROW_B} tone="outline" reverse />
      </div>
    </section>
  );
}
