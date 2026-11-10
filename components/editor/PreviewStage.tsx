"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { motion } from "framer-motion";
import { StickerIcon } from "./StickerIcon";
import { CaptionOverlay } from "./CaptionOverlay";
import type { EditorState } from "@/app/editor/[jobId]/[clipIndex]/page";
import type { TextOverlaySpec, StickerSpec, CropSpec } from "@/lib/types";
import type { ToolKey } from "./ToolTabs";

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
        <video
          ref={videoRef}
          src={rawUrl}
          muted
          playsInline
          className="absolute inset-0 h-full w-full"
          style={{
            objectFit: "cover",
            objectPosition: `${state.crop.x * 100}% ${state.crop.y * 100}%`,
            transform: `scale(${state.crop.zoom})`,
            transformOrigin: `${state.crop.x * 100}% ${state.crop.y * 100}%`,
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) videoRef.current.currentTime = state.trim.start;
          }}
        />

        {/* color filter preview */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            filter: `brightness(${1 + state.filters.brightness}) contrast(${1 + state.filters.contrast}) saturate(${
              1 + state.filters.saturation
            })`,
          }}
        />

        {/* captions (animated; mirrors the libass export) */}
        {state.captionsEnabled && (
          <CaptionOverlay
            videoRef={videoRef}
            fallbackTime={currentTime}
            chunks={state.captionChunks}
            style={state.captionStyle}
            scale={scale}
            stageHeight={BOX_HEIGHT}
            draggable={activeTool === "captions"}
            onChangePositionY={onUpdateCaptionY}
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
