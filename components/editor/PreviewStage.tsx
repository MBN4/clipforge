"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { motion } from "framer-motion";
import { StickerIcon } from "./StickerIcon";
import { CaptionOverlay } from "./CaptionOverlay";
import type { EditorState } from "@/app/editor/[jobId]/[clipIndex]/page";
import type { TextOverlaySpec, StickerSpec, CropSpec } from "@/lib/types";
import type { ToolKey } from "./ToolTabs";
import type { Timeline } from "@/lib/timeline";
import type { CaptionChunk } from "@/lib/captions";

const BOX_WIDTH = 340;
const BOX_HEIGHT = (BOX_WIDTH * 16) / 9;

export function PreviewStage({
  rawUrl,
  videoRef,
  state,
  currentTime,
  onTimeUpdate,
  playing,
  onPlayingChange,
  onUpdateCrop,
  onUpdateTextOverlay,
  onUpdateSticker,
  onUpdateCaptionY,
  activeTool,
  timeline,
  chunks,
}: {
  rawUrl: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  state: EditorState;
  currentTime: number;
  onTimeUpdate: (t: number) => void;
  playing: boolean;
  onPlayingChange: (p: boolean) => void;
  onUpdateCrop: (crop: CropSpec) => void;
  onUpdateTextOverlay: (id: string, patch: Partial<TextOverlaySpec>) => void;
  onUpdateSticker: (id: string, patch: Partial<StickerSpec>) => void;
  onUpdateCaptionY: (y: number) => void;
  activeTool: ToolKey;
  timeline: Timeline;
  /** caption chunks to show (cut words already removed) */
  chunks: CaptionChunk[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ x: number; y: number } | null>(null);
  const [panning, setPanning] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) v.play().catch(() => {});
    else v.pause();
  }, [playing, videoRef]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    function onTime() {
      if (v!.currentTime > state.trim.end) {
        v!.currentTime = state.trim.start;
      }
      onTimeUpdate(v!.currentTime);
    }
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.trim.start, state.trim.end]);

  // playback speed
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.playbackRate = state.speed;
  }, [state.speed, videoRef]);

  // jump over removed ranges (silences / filler words) and loop inside the trim, every frame
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v && !v.paused) {
        if (v.currentTime >= state.trim.end - 0.02) {
          v.currentTime = state.trim.start;
        } else {
          const to = timeline.skipTo(v.currentTime);
          if (to !== null) v.currentTime = to >= state.trim.end - 0.02 ? state.trim.start : to;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [timeline, state.trim.start, state.trim.end, videoRef]);

  function onPanStart(e: React.PointerEvent) {
    if (activeTool !== "reframe") return;
    dragState.current = { x: e.clientX, y: e.clientY };
    setPanning(true);
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function onPanMove(e: React.PointerEvent) {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.x;
    const dy = e.clientY - dragState.current.y;
    dragState.current = { x: e.clientX, y: e.clientY };
    const sensitivity = 1 / (state.crop.zoom * BOX_WIDTH);
    onUpdateCrop({
      x: Math.min(1, Math.max(0, state.crop.x - dx * sensitivity)),
      y: Math.min(1, Math.max(0, state.crop.y - dy * (1 / (state.crop.zoom * BOX_HEIGHT)))),
      zoom: state.crop.zoom,
    });
  }

  function onPanEnd() {
    dragState.current = null;
    setPanning(false);
  }

  const scale = BOX_WIDTH / 1080;
  const fit = state.layout === "fit";
  const f = state.filters;
  const warmth = f.warmth ?? 0;
  const vignette = f.vignette ?? 0;
  const pb = state.polish.progressBar;
  const progress = Math.min(1, Math.max(0, timeline.map(currentTime) / timeline.duration));

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-2xl border border-line-strong bg-black shadow-2xl"
        style={{ width: BOX_WIDTH, height: BOX_HEIGHT, cursor: activeTool === "reframe" ? (panning ? "grabbing" : "grab") : "default" }}
        onPointerDown={onPanStart}
        onPointerMove={onPanMove}
        onPointerUp={onPanEnd}
        onPointerLeave={onPanEnd}
      >
        {/* picture layers + colour grade (the filter wraps everything ffmpeg grades) */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            filter: `brightness(${1 + f.brightness}) contrast(${1 + f.contrast}) saturate(${1 + f.saturation})`,
          }}
        >
          {fit && <BlurBackdrop src={rawUrl} mainRef={videoRef} speed={state.speed} playing={playing} />}
          <video
            ref={videoRef}
            src={rawUrl}
            muted
            playsInline
            className="absolute inset-0 h-full w-full"
            style={
              fit
                ? { objectFit: "contain" }
                : {
                    objectFit: "cover",
                    objectPosition: `${state.crop.x * 100}% ${state.crop.y * 100}%`,
                    transform: `scale(${state.crop.zoom})`,
                    transformOrigin: `${state.crop.x * 100}% ${state.crop.y * 100}%`,
                  }
            }
            onLoadedMetadata={() => {
              if (videoRef.current) {
                videoRef.current.currentTime = state.trim.start;
                videoRef.current.playbackRate = state.speed;
              }
            }}
          />
          {Math.abs(warmth) > 0.01 && (
            <div
              className="absolute inset-0"
              style={{
                mixBlendMode: "soft-light",
                background: warmth > 0 ? `rgba(255,140,20,${warmth * 0.55})` : `rgba(40,120,255,${-warmth * 0.55})`,
              }}
            />
          )}
          {vignette > 0.01 && (
            <div
              className="absolute inset-0"
              style={{ background: `radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,${vignette * 0.85}) 100%)` }}
            />
          )}
        </div>

        {/* captions (animated; mirrors the libass export) */}
        {state.captionsEnabled && (
          <CaptionOverlay
            videoRef={videoRef}
            fallbackTime={currentTime}
            chunks={chunks}
            style={state.captionStyle}
            scale={scale}
            stageHeight={BOX_HEIGHT}
            draggable={activeTool === "captions"}
            onChangePositionY={onUpdateCaptionY}
          />
        )}

        {/* progress bar */}
        {pb.enabled && (
          <div
            className="pointer-events-none absolute left-0"
            style={{
              [pb.position === "top" ? "top" : "bottom"]: 0,
              height: pb.height * scale,
              width: `${progress * 100}%`,
              background: pb.color,
            }}
          />
        )}

        {/* text overlays */}
        {state.textOverlays.map((t) => {
          const isActive = currentTime >= t.start && currentTime <= t.end;
          return (
            <motion.div
              key={t.id}
              drag={activeTool === "text"}
              dragMomentum={false}
              dragConstraints={containerRef}
              onDragEnd={(_, info) => {
                const rect = containerRef.current?.getBoundingClientRect();
                if (!rect) return;
                const x = Math.min(1, Math.max(0, (info.point.x - rect.left) / rect.width));
                const y = Math.min(1, Math.max(0, (info.point.y - rect.top) / rect.height));
                onUpdateTextOverlay(t.id, { x, y });
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap font-black ${
                activeTool === "text" ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"
              }`}
              style={{
                left: `${t.x * 100}%`,
                top: `${t.y * 100}%`,
                color: t.color,
                fontSize: t.fontSize * scale,
                opacity: isActive ? 1 : 0.35,
                WebkitTextStroke: `${2 * scale}px rgba(0,0,0,0.6)`,
                paintOrder: "stroke fill",
              }}
            >
              {t.text}
            </motion.div>
          );
        })}

        {/* stickers */}
        {state.stickers.map((s) => {
          const isActive = currentTime >= s.start && currentTime <= s.end;
          return (
            <motion.div
              key={s.id}
              drag={activeTool === "stickers"}
              dragMomentum={false}
              dragConstraints={containerRef}
              onDragEnd={(_, info) => {
                const rect = containerRef.current?.getBoundingClientRect();
                if (!rect) return;
                const x = Math.min(1, Math.max(0, (info.point.x - rect.left) / rect.width));
                const y = Math.min(1, Math.max(0, (info.point.y - rect.top) / rect.height));
                onUpdateSticker(s.id, { x, y });
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 select-none ${
                activeTool === "stickers" ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"
              }`}
              style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, opacity: isActive ? 1 : 0.35 }}
            >
              <StickerIcon type={s.type} color={s.color} size={s.size * scale} />
            </motion.div>
          );
        })}
      </div>

      <button
        onClick={() => onPlayingChange(!playing)}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-line-strong text-paper transition hover:border-paper/40"
      >
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="5" y="4" width="5" height="16" />
            <rect x="14" y="4" width="5" height="16" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="6,4 20,12 6,20" />
          </svg>
        )}
      </button>
    </div>
  );
}

/** The blurred, zoomed copy of the video that fills the frame behind a "fit" layout. It's a second
 * <video> kept in step with the main one. */
function BlurBackdrop({
  src,
  mainRef,
  speed,
  playing,
}: {
  src: string;
  mainRef: RefObject<HTMLVideoElement | null>;
  speed: number;
  playing: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.playbackRate = speed;
    if (playing) v.play().catch(() => {});
    else v.pause();
  }, [playing, speed]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const bg = ref.current;
      const main = mainRef.current;
      if (bg && main && Math.abs(bg.currentTime - main.currentTime) > 0.12) bg.currentTime = main.currentTime;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mainRef]);

  return (
    <video
      ref={ref}
      src={src}
      muted
      playsInline
      aria-hidden
      className="absolute inset-0 h-full w-full"
      style={{ objectFit: "cover", transform: "scale(1.25)", filter: "blur(22px) brightness(0.9) saturate(1.2)" }}
    />
  );
}
