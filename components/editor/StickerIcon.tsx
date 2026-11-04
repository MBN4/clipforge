export type StickerType = "star" | "heart" | "fire" | "bolt" | "check" | "laugh" | "arrow" | "sparkle";

export const STICKER_TYPES: StickerType[] = ["star", "heart", "fire", "bolt", "check", "laugh", "arrow", "sparkle"];

const PATHS: Record<StickerType, string> = {
  star: "M50,5 61,35 95,35 68,55 78,90 50,70 22,90 32,55 5,35 39,35",
  heart:
    "M50 85 C20 65 5 45 5 28 C5 12 20 5 32 10 C40 13 46 20 50 28 C54 20 60 13 68 10 C80 5 95 12 95 28 C95 45 80 65 50 85 Z",
  fire: "M50 8 C38 26 28 36 28 54 C28 72 38 92 50 92 C62 92 72 72 72 54 C72 46 68 40 64 36 C64 46 56 52 51 49 C56 42 54 28 50 8 Z",
  bolt: "M55 4 25 55 45 55 35 96 80 40 58 40 Z",
  check: "",
  laugh: "",
  arrow: "M50 10 L85 45 H65 V90 H35 V45 H15 Z",
  sparkle: "M50 4 L58 38 L92 46 L58 54 L50 88 L42 54 L8 46 L42 38 Z",
};

export function StickerIcon({ type, color = "#ff4e1f", size = 32 }: { type: StickerType; color?: string; size?: number }) {
  if (type === "check") {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="46" fill={color} />
        <path d="M28 52 L44 68 L74 34" stroke="#141210" strokeWidth={9} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "laugh") {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="46" fill={color} />
        <circle cx="35" cy="42" r="6" fill="#141210" />
        <circle cx="65" cy="42" r="6" fill="#141210" />
        <path d="M26 58 Q50 82 74 58" stroke="#141210" strokeWidth={7} fill="none" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <path d={PATHS[type]} fill={color} />
    </svg>
  );
}
