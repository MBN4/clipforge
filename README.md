# Clipforge

Paste a YouTube / Instagram / TikTok / Facebook link, or upload a file — Clipforge
transcribes it, finds the best moments, reframes them to 9:16, burns in captions,
and gives you ready-to-post shorts. Then edit any clip in a real in-browser editor
before exporting. Free, no watermark, no account.

## Requirements

- Node 20+
- `ffmpeg` / `ffprobe` on PATH, built with `libass` (captions) and `librsvg`
  (sticker overlays) — most distro ffmpeg builds already include both
- Python 3.10+ with `pip install yt-dlp faster-whisper`
- A system font covering Latin text in bold (DejaVu Sans / Liberation Sans are
  assumed by default on Linux) — used for captions and text overlays

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## How it works

1. **Ingest** (`lib/download.ts`) — `yt-dlp` pulls the source video (optionally
   scoped to a `--download-sections` time range you pick up front), or an
   uploaded file is used directly and fast-trimmed with `ffmpeg -c copy`.
2. **Transcribe** (`lib/transcribe.ts`, `scripts/transcribe.py`) — `faster-whisper`
   (CPU, no GPU needed; greedy decoding for speed) produces word-level
   timestamps. The *first run* downloads model weights from Hugging Face — needs
   outbound network access once, then it's cached locally. If the model can't be
   fetched (offline environment), Clipforge automatically falls back to
   silence-detection heuristics, spreading evenly-spaced picks across the full
   video, so the app still works — just without burned captions.
3. **Highlight selection** (`lib/highlights.ts`, optionally `lib/ai.ts`) — scores
   candidate windows (15–55s) for hook words, pacing, punctuation, for however
   many clips you asked for (scales with video length). If `ANTHROPIC_API_KEY`
   is set, Claude re-ranks and titles the clips instead.
4. **Render** (`lib/render.ts`, `lib/captions.ts`) — `ffmpeg` trims each clip,
   composites a blurred-backdrop 9:16 frame (keeps the full source in view
   instead of a harsh crop — the backdrop is blurred at quarter resolution and
   scaled back up, since blur cost scales with pixel count and the detail loss
   isn't visible once blurred anyway), and burns in word-grouped captions via
   libass. Clips render with bounded concurrency (3 at a time) rather than
   sequentially.
5. **Edit** (`app/editor/[jobId]/[clipIndex]`, `lib/exportRender.ts`) — every
   clip can be opened in a real in-browser editor: trim, reframe (drag-to-pan
   + zoom over the original footage), edit caption text/timing/style, add
   draggable text overlays and stickers, apply color filters, mix in a music
   track. Everything previews live in the browser; **Export** renders the
   final file in a single `ffmpeg` pass combining every edit.

Jobs are tracked in-memory with an async-persisted `storage/db.json` snapshot
(single instance — swap for a real DB/queue if you deploy this for more than a
few concurrent users). Output files, raw per-clip segments (the editor's
working source), and uploaded music live under `storage/jobs/<id>/` and are
streamed through `/api/files/*`.

## The mini-arcade

The processing screen includes a collapsible arcade so waiting isn't dead
time: **Chess** (custom SVG pieces, Easy/Medium/Hard AI with repetition
avoidance, four modes — Classic, Chaos, King of the Hill, Three-Check),
**Snake** (speed presets), and **2048** (4×4 or 5×5). All three support
fullscreen. Sound effects are synthesized with the Web Audio API (no audio
assets to ship), with a persisted mute toggle. A toast + browser notification
fires when your clip job finishes, even if you're mid-game.

## ⚠️ About pulling from YouTube / Instagram / TikTok / Facebook

Downloading other people's videos from these platforms via `yt-dlp` generally
violates their Terms of Service, independent of copyright on the underlying
content. This is fine for personal use, re-clipping your own content, or testing —
but if you run this as a public product, you're taking on real legal/takedown risk.
Consider gating URL-based ingestion to content the user attests they own, or
sticking to direct upload only, before shipping this to the public.

## Known limitations

- Single-process job queue (in-memory + async file snapshot) — fine for a side
  project, not for scale, and not durable across a process crash mid-job.
- No auth/accounts — anyone with the URL can see a job's clips while the dev
  server runs. Add auth before deploying multi-tenant.
- Whisper model download requires one-time network access to huggingface.co.
- The editor is well-built for short-form clips, not a from-scratch
  Premiere/CapCut clone — no multi-track timeline, transitions, keyframed
  animation, or undo history.
- Chess/Snake/2048 are genuinely playable but intentionally scoped (e.g. no
  true chess variants like Atomic/Horde, which would need a custom rules
  engine rather than a layer on top of `chess.js`).

## Project layout

- `lib/pipeline.ts` — orchestrates ingest → transcribe → highlight → render
  for a job.
- `lib/exportRender.ts` — the editor's export engine: one `ffmpeg` filter
  graph combining trim, crop/zoom/pan, color grading, stickers (SVG via
  `librsvg`, since `drawtext` can't rasterize color emoji fonts at arbitrary
  sizes), text, captions, and audio mixing.
- `lib/captions.ts` — ASS subtitle generation, parameterized by style
  (font/size/colors/position) so both the default render and the editor can
  use it.
- `lib/games/` — chess AI (`chessAi.ts`) and modes (`chessModes.ts`).
- `components/editor/` — the in-browser clip editor UI.
- `components/games/` — Chessboard, Snake, Game2048, and the GameHub tab
  switcher.
