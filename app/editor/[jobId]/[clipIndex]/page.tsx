"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { PreviewStage } from "@/components/editor/PreviewStage";
import { TrimBar } from "@/components/editor/TrimBar";
import { ToolTabs, type ToolKey } from "@/components/editor/ToolTabs";
import { TrimPanel } from "@/components/editor/panels/TrimPanel";
import { CaptionsPanel } from "@/components/editor/panels/CaptionsPanel";
import { ReframePanel } from "@/components/editor/panels/ReframePanel";
import { TextPanel } from "@/components/editor/panels/TextPanel";
import { StickersPanel } from "@/components/editor/panels/StickersPanel";
import { FiltersPanel } from "@/components/editor/panels/FiltersPanel";
import { MusicPanel } from "@/components/editor/panels/MusicPanel";
import { EnhancePanel, type Cuts } from "@/components/editor/panels/EnhancePanel";
import {
  dropCutWords,
  groupWordsIntoChunks,
  normalizeCaptionStyle,
  DEFAULT_CAPTION_STYLE,
  type CaptionChunk,
  type CaptionStyle,
} from "@/lib/captions";
import { nanoid } from "nanoid";
import { buildTimeline, normalizeRanges } from "@/lib/timeline";
import { DEFAULT_AUDIO, DEFAULT_FILTERS, DEFAULT_POLISH } from "@/lib/editSpec";
import { sfx } from "@/lib/sound";
import type { TextOverlaySpec, StickerSpec, CropSpec, FilterSpec, Word, AudioSpec, PolishSpec, LayoutMode } from "@/lib/types";

interface ClipData {
  index: number;
  title: string;
  duration: number;
  rawUrl: string;
  words: Word[];
}

export interface MusicState {
  path: string;
  url: string;
  name: string;
  volume: number;
  duckOriginal: number;
}

export interface EditorState {
  trim: { start: number; end: number };
  crop: CropSpec;
  captionsEnabled: boolean;
  captionChunks: CaptionChunk[];
  captionStyle: CaptionStyle;
  textOverlays: TextOverlaySpec[];
  stickers: StickerSpec[];
  filters: FilterSpec;
  music: MusicState | null;
  /** ranges cut out by Remove silences / Cut filler words (source time) */
  cuts: Cuts;
  speed: number;
  audio: AudioSpec;
  polish: PolishSpec;
  layout: LayoutMode;
}

// "um", "uh", "er", "hmm"… — whisper often drops these, so this only fires when it kept them
const FILLER = /^(u+m+|u+h+|e+r+m*|h+m+|m{2,})$/i;
const bareWord = (w: string) => w.toLowerCase().replace(/[^a-z]/g, "");
const DEFAULT_CROP: CropSpec = { x: 0.5, y: 0.5, zoom: 1 };
const DEFAULT_WORDS_PER_CAPTION = 3;

// The last caption look the user picked is remembered (per browser) and
// used as the starting style for the next clip they open.
const CAPTION_PREFS_KEY = "clipforge.captionPrefs.v1";

function loadCaptionPrefs(): { style: CaptionStyle; wordsPerCaption: number } | null {
  try {
    const raw = localStorage.getItem(CAPTION_PREFS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const n = Math.round(Number(parsed?.wordsPerCaption));
    return {
      style: normalizeCaptionStyle(parsed?.style),
      wordsPerCaption: n >= 1 && n <= 6 ? n : DEFAULT_WORDS_PER_CAPTION,
    };
  } catch {
    return null;
  }
}

function saveCaptionPrefs(style: CaptionStyle, wordsPerCaption: number) {
  try {
    localStorage.setItem(CAPTION_PREFS_KEY, JSON.stringify({ style, wordsPerCaption }));
  } catch {
    // storage unavailable (private mode etc.) — preference just isn't remembered
  }
}

export default function EditorPage() {
  const params = useParams<{ jobId: string; clipIndex: string }>();
  const router = useRouter();
  const jobId = params.jobId;
  const clipIndex = parseInt(params.clipIndex, 10);

  const [clip, setClip] = useState<ClipData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolKey>("trim");
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [wordsPerCaption, setWordsPerCaption] = useState(DEFAULT_WORDS_PER_CAPTION);
  const prefsLoaded = useRef(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  const [state, setState] = useState<EditorState>({
    trim: { start: 0, end: 0 },
    crop: DEFAULT_CROP,
    captionsEnabled: true,
    captionChunks: [],
    captionStyle: DEFAULT_CAPTION_STYLE,
    textOverlays: [],
    stickers: [],
    filters: DEFAULT_FILTERS,
    music: null,
    cuts: { silences: [], fillers: [] },
    speed: 1,
    audio: DEFAULT_AUDIO,
    polish: DEFAULT_POLISH,
    layout: "fill",
  });

  const [genBusy, setGenBusy] = useState(false);
  const [genError, setGenError] = useState<{ message: string; code: string | null } | null>(null);
  const [installingWhisper, setInstallingWhisper] = useState(false);

  // everything time-based is mapped through this: cuts + speed change where things land
  const removed = useMemo(() => normalizeRanges([...state.cuts.silences, ...state.cuts.fillers]), [state.cuts]);
  const timeline = useMemo(() => buildTimeline(state.trim, removed, state.speed), [state.trim, removed, state.speed]);
  const shownChunks = useMemo(() => dropCutWords(state.captionChunks, timeline), [state.captionChunks, timeline]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        setLoadError("Couldn't load that job.");
        return;
      }
      const data = await res.json();
      const found = data.job.clips.find((c: any) => c.index === clipIndex);
      if (!found) {
        setLoadError("Couldn't find that clip.");
        return;
      }
      if (cancelled) return;
      const prefs = loadCaptionPrefs();
      const perCaption = prefs?.wordsPerCaption ?? DEFAULT_WORDS_PER_CAPTION;
      setClip({ index: found.index, title: found.title, duration: found.duration, rawUrl: found.rawUrl, words: found.words });
      setWordsPerCaption(perCaption);
      setState((s) => ({
        ...s,
        trim: { start: 0, end: found.duration },
        captionChunks: groupWordsIntoChunks(found.words, perCaption),
        captionStyle: prefs?.style ?? s.captionStyle,
      }));
      prefsLoaded.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, clipIndex]);

  useEffect(() => {
    if (prefsLoaded.current) saveCaptionPrefs(state.captionStyle, wordsPerCaption);
  }, [state.captionStyle, wordsPerCaption]);

  function regroupCaptions(n: number) {
    if (!clip) return;
    setWordsPerCaption(n);
    update("captionChunks", groupWordsIntoChunks(clip.words, n));
  }

  async function generateCaptions(opts: { language: string; translate: boolean; quality: "fast" | "accurate" }) {
    if (!clip) return;
    setGenBusy(true);
    setGenError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/clips/${clipIndex}/captions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(opts),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGenError({ message: data.error || "Caption generation failed.", code: data.code ?? null });
        sfx.lose();
        return;
      }
      const words: Word[] = data.words;
      setClip((c) => (c ? { ...c, words } : c));
      setState((s) => ({ ...s, captionsEnabled: true, captionChunks: groupWordsIntoChunks(words, wordsPerCaption) }));
      sfx.jobDone();
    } catch {
      setGenError({ message: "Couldn't reach the server.", code: null });
    } finally {
      setGenBusy(false);
    }
  }

  async function installWhisper() {
    setInstallingWhisper(true);
    try {
      const res = await fetch("/api/system/install", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tool: "whisper" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Install failed");
      setGenError({ message: "Speech-to-text installed. Click “Auto-generate captions” again.", code: null });
    } catch (e) {
      setGenError({ message: e instanceof Error ? e.message : "Install failed", code: "whisper_missing" });
    } finally {
      setInstallingWhisper(false);
    }
  }

  // filler words in the transcript that haven't been cut yet
  const fillerRanges = useMemo(
    () =>
      (clip?.words ?? [])
        .filter((w) => FILLER.test(bareWord(w.word)) && !timeline.isRemoved((w.start + w.end) / 2))
        .map((w) => ({ start: Math.max(0, w.start - 0.02), end: w.end + 0.04 })),
    [clip?.words, timeline]
  );
  const cutFillers = useCallback(() => {
    setState((s) => ({ ...s, cuts: { ...s.cuts, fillers: [...s.cuts.fillers, ...fillerRanges] } }));
  }, [fillerRanges]);

  function update<K extends keyof EditorState>(key: K, value: EditorState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  async function handleExport() {
    if (!clip) return;
    setExporting(true);
    setExportError(null);
    try {
      const spec = {
        trim: state.trim,
        crop: state.crop,
        captions: { enabled: state.captionsEnabled, chunks: state.captionChunks, style: state.captionStyle },
        textOverlays: state.textOverlays,
        stickers: state.stickers,
        filters: state.filters,
        removed,
        speed: state.speed,
        audio: state.audio,
        polish: state.polish,
        layout: state.layout,
        music: state.music
          ? { path: state.music.path, volume: state.music.volume, duckOriginal: state.music.duckOriginal }
          : null,
      };
      const res = await fetch(`/api/jobs/${jobId}/clips/${clipIndex}/export`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(spec),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Export failed");
      setExportedUrl(data.videoUrl);
      sfx.jobDone();
    } catch (e: any) {
      setExportError(e.message);
      sfx.lose();
    } finally {
      setExporting(false);
    }
  }

  function addTextOverlay() {
    const overlay: TextOverlaySpec = {
      id: nanoid(6),
      text: "New text",
      x: 0.5,
      y: 0.4,
      fontSize: 64,
      color: "#ffffff",
      bold: true,
      start: state.trim.start,
      end: Math.min(state.trim.end, state.trim.start + 4),
    };
    update("textOverlays", [...state.textOverlays, overlay]);
    sfx.click();
  }

  function addSticker(type: StickerSpec["type"]) {
    const sticker: StickerSpec = {
      id: nanoid(6),
      type,
      x: 0.5,
      y: 0.5,
      size: 160,
      color: "#ff4e1f",
      start: state.trim.start,
      end: Math.min(state.trim.end, state.trim.start + 4),
    };
    update("stickers", [...state.stickers, sticker]);
    sfx.click();
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink text-paper">
        <p className="font-display text-xl font-semibold">{loadError}</p>
        <Link href="/studio/library" className="rounded-full bg-ember px-6 py-3 text-sm font-semibold text-ink">
          Back to studio
        </Link>
      </div>
    );
  }

  if (!clip) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line-strong border-t-ember" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ink text-paper">
      <header className="flex items-center justify-between border-b border-line px-6 py-3">
        <Link href="/studio/library">
          <Logo />
        </Link>
        <p className="hidden truncate font-mono text-xs text-paper-dim sm:block">{clip.title}</p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="rounded-full bg-ember px-6 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-50"
        >
          {exporting ? "Exporting…" : "Export"}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-hidden bg-ink-3/40 p-6">
          <PreviewStage
            rawUrl={clip.rawUrl}
            videoRef={videoRef}
            state={state}
            currentTime={currentTime}
            onTimeUpdate={setCurrentTime}
            playing={playing}
            onPlayingChange={setPlaying}
            onUpdateCrop={(crop) => update("crop", crop)}
            onUpdateTextOverlay={(id, patch) =>
              update(
                "textOverlays",
                state.textOverlays.map((t) => (t.id === id ? { ...t, ...patch } : t))
              )
            }
            onUpdateSticker={(id, patch) =>
              update(
                "stickers",
                state.stickers.map((s) => (s.id === id ? { ...s, ...patch } : s))
              )
            }
            onUpdateCaptionY={(y) => setState((s) => ({ ...s, captionStyle: { ...s.captionStyle, positionY: y } }))}
            activeTool={tool}
            timeline={timeline}
            chunks={shownChunks}
          />
          <TrimBar
            duration={clip.duration}
            trim={state.trim}
            currentTime={currentTime}
            removed={removed}
            onChange={(trim) => update("trim", trim)}
            onSeek={(t) => {
              if (videoRef.current) videoRef.current.currentTime = t;
              setCurrentTime(t);
            }}
          />
        </div>

        <div className="flex w-[340px] shrink-0 flex-col border-l border-line bg-ink-2">
          <ToolTabs active={tool} onChange={setTool} />
          <div className="flex-1 overflow-y-auto p-4">
            {tool === "trim" && <TrimPanel duration={clip.duration} trim={state.trim} onChange={(t) => update("trim", t)} />}
            {tool === "captions" && (
              <CaptionsPanel
                enabled={state.captionsEnabled}
                onToggle={(v) => update("captionsEnabled", v)}
                chunks={state.captionChunks}
                onChangeChunks={(c) => update("captionChunks", c)}
                style={state.captionStyle}
                onChangeStyle={(s) => update("captionStyle", s)}
                wordsPerCaption={wordsPerCaption}
                onRegroup={regroupCaptions}
                canRegroup={clip.words.length > 0}
                gen={{
                  busy: genBusy,
                  error: genError?.message ?? null,
                  code: genError?.code ?? null,
                  installing: installingWhisper,
                  onGenerate: generateCaptions,
                  onInstall: installWhisper,
                }}
              />
            )}
            {tool === "reframe" && <ReframePanel crop={state.crop} onChange={(c) => update("crop", c)} />}
            {tool === "text" && (
              <TextPanel
                overlays={state.textOverlays}
                onAdd={addTextOverlay}
                onChange={(overlays) => update("textOverlays", overlays)}
                trim={state.trim}
              />
            )}
            {tool === "stickers" && (
              <StickersPanel
                stickers={state.stickers}
                onAdd={addSticker}
                onChange={(stickers) => update("stickers", stickers)}
                trim={state.trim}
              />
            )}
            {tool === "filters" && <FiltersPanel filters={state.filters} onChange={(f) => update("filters", f)} />}
            {tool === "enhance" && (
              <EnhancePanel
                jobId={jobId}
                clipIndex={clipIndex}
                trim={state.trim}
                timeline={timeline}
                speed={state.speed}
                onSpeed={(v) => update("speed", v)}
                cuts={state.cuts}
                onCuts={(c) => update("cuts", c)}
                fillerCount={fillerRanges.length}
                onCutFillers={cutFillers}
                hasWords={clip.words.length > 0}
                audio={state.audio}
                onAudio={(a) => update("audio", a)}
                polish={state.polish}
                onPolish={(p) => update("polish", p)}
                layout={state.layout}
                onLayout={(l) => update("layout", l)}
              />
            )}
            {tool === "music" && (
              <MusicPanel jobId={jobId} music={state.music} onChange={(m) => update("music", m)} />
            )}
          </div>
        </div>
      </div>

      {(exporting || exportError || exportedUrl) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-2xl border border-line-strong bg-ink-2 px-6 py-4 shadow-2xl"
        >
          {exporting && (
            <>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-line-strong border-t-ember" />
              <span className="text-sm text-paper-dim">Rendering your edit…</span>
            </>
          )}
          {exportError && <span className="text-sm text-ember">{exportError}</span>}
          {exportedUrl && !exporting && (
            <>
              <span className="text-sm text-paper">Exported!</span>
              <a
                href={exportedUrl}
                download={`clip-${clipIndex}-edited.mp4`}
                className="rounded-full bg-ember px-4 py-2 text-xs font-semibold text-ink"
              >
                Download
              </a>
              <button
                onClick={() => router.push("/studio/library")}
                className="rounded-full border border-line-strong px-4 py-2 text-xs font-semibold text-paper-dim hover:text-paper"
              >
                Back to clips
              </button>
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}
