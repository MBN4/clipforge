"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import {
  activeWordIndex,
  chunkWordTimings,
  effectiveBackground,
  entranceAt,
  exitOpacityAt,
  wordBoxPadding,
  wordPopScaleAt,
  REVEAL_FADE_MS,
  type CaptionChunk,
  type CaptionStyle,
} from "@/lib/captions";
import { captionFontCss, getCaptionFont } from "@/lib/captionFonts";

function rgba(hex: string, alpha: number) {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Reads the video clock every animation frame while playing — <video>'s
 * timeupdate only fires ~4x/second, far too coarse for 100ms animations. */
function useVideoClock(videoRef: RefObject<HTMLVideoElement | null>, fallback: number) {
  const [t, setT] = useState(fallback);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v) setT((prev) => (prev === v.currentTime ? prev : v.currentTime));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [videoRef]);
  // Paused seeks still go through currentTime, so the rAF loop covers them too.
  return t;
}

/**
 * Live preview of the animated captions. Mirrors buildAssFromChunks() in
 * lib/captions.ts: same keyframes, same word timing, same font metrics.
 */
export function CaptionOverlay({
  videoRef,
  fallbackTime,
  chunks,
  style,
  scale,
  stageHeight,
  draggable,
  onChangePositionY,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  fallbackTime: number;
  chunks: CaptionChunk[];
  style: CaptionStyle;
  /** Stage px per 1080-wide output px. */
  scale: number;
  stageHeight: number;
  draggable: boolean;
  onChangePositionY: (y: number) => void;
}) {
  const t = useVideoClock(videoRef, fallbackTime);
  const drag = useRef<{ startY: number; startPos: number } | null>(null);

  const chunk = chunks.find((c) => t >= c.start && t < c.end);
  if (!chunk) return null;
  const words = chunkWordTimings(chunk, style.uppercase);
  if (!words.length) return null;

  const font = getCaptionFont(style.fontFamily);
  const ms = (t - chunk.start) * 1000;
  const anim = entranceAt(style.animation, ms);
  const opacity = anim.o * exitOpacityAt(style.animation, (chunk.end - t) * 1000);
  const k = activeWordIndex(words, t);

  const box = style.wordEffect === "box";
  const bg = effectiveBackground(style);
  const outline = box ? 0 : style.outlineWidth;
  // libass draws the outline outside the glyph; a CSS stroke is centred on
  // the edge (half hidden under the fill with paint-order), so double it.
  const stroke = (w: number, c: string) => (w > 0 ? `${2 * w * scale}px ${c}` : undefined);
  const shadow =
    !box && !bg && style.shadowDepth > 0 && style.shadowOpacity > 0
      ? `drop-shadow(${style.shadowDepth * scale}px ${style.shadowDepth * scale}px 0 ${rgba(
          style.shadowColor,
          style.shadowOpacity
        )})`
      : undefined;
  const pad = wordBoxPadding(style) * scale;

  const container: CSSProperties = {
    position: "absolute",
    left: "50%",
    top: `${style.positionY * 100}%`,
    width: 960 * scale,
    transform: `translate(-50%, -50%) translateY(${anim.dy * scale}px) rotate(${anim.r}deg) scale(${anim.s / 100})`,
    opacity,
    textAlign: "center",
    pointerEvents: draggable ? "auto" : "none",
    cursor: draggable ? "ns-resize" : undefined,
    touchAction: "none",
  };

  const text: CSSProperties = {
    fontFamily: captionFontCss(font.family),
    fontWeight: font.cssWeight,
    fontSize: style.fontSize * font.cssScale * scale,
    lineHeight: `${style.fontSize * scale}px`,
    letterSpacing: style.letterSpacing * scale,
    color: style.textColor,
    WebkitTextStroke: stroke(outline, style.outlineColor),
    paintOrder: "stroke fill",
    filter: shadow,
    whiteSpace: "normal",
    overflowWrap: "break-word",
    ...(bg
      ? {
          background: rgba(style.backgroundColor, style.backgroundOpacity),
          padding: `${(style.outlineWidth + 4) * scale}px ${(style.outlineWidth + 8) * scale}px`,
          boxDecorationBreak: "clone",
          WebkitBoxDecorationBreak: "clone",
        }
      : {}),
  };

  function wordStyle(i: number, ws: number): CSSProperties {
    const active = i === k;
    const s: CSSProperties = { display: "inline-block", position: "relative" };
    switch (style.wordEffect) {
      case "highlight":
        if (active) s.color = style.highlightColor;
        break;
      case "pop":
        if (active) {
          s.color = style.highlightColor;
          s.transform = `scale(${wordPopScaleAt((t - ws) * 1000) / 100})`;
        }
        break;
      case "box":
        if (active) {
          s.background = style.highlightColor;
          s.padding = `${pad}px`;
          s.margin = `${-pad}px`;
        }
        break;
      case "reveal":
        s.opacity = i < k ? 1 : i === k ? Math.min(1, ((t - ws) * 1000) / REVEAL_FADE_MS) : 0;
        break;
      case "glow":
        if (active) {
          s.WebkitTextStroke = stroke(style.outlineWidth + 4, style.highlightColor);
          s.textShadow = `0 0 ${10 * scale}px ${style.highlightColor}, 0 0 ${22 * scale}px ${style.highlightColor}`;
        }
        break;
    }
    return s;
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!draggable) return;
    e.stopPropagation();
    drag.current = { startY: e.clientY, startPos: style.positionY };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const next = drag.current.startPos + (e.clientY - drag.current.startY) / stageHeight;
    onChangePositionY(Math.round(Math.min(0.95, Math.max(0.05, next)) * 1000) / 1000);
  }
  function onPointerUp() {
    drag.current = null;
  }

  return (
    <div
      style={container}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={draggable ? "rounded-md outline-1 outline-dashed outline-paper/40" : undefined}
    >
      <span style={text}>
        {words.map((w, i) => {
          const progress =
            style.wordEffect === "karaoke" ? Math.min(1, Math.max(0, (t - w.start) / Math.max(0.01, w.end - w.start))) : 0;
          return (
            <span key={i}>
              {i > 0 && " "}
              <span style={wordStyle(i, w.start)}>
                {w.text}
                {style.wordEffect === "karaoke" && progress > 0 && (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      inset: 0,
                      color: style.highlightColor,
                      clipPath: `inset(-20% ${(1 - progress) * 100}% -20% 0)`,
                    }}
                  >
                    {w.text}
                  </span>
                )}
              </span>
            </span>
          );
        })}
      </span>
    </div>
  );
}
