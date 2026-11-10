# Clipforge

Paste a YouTube / Instagram / TikTok / Facebook link, or upload a file — Clipforge
transcribes it, finds the best moments, reframes them to 9:16, burns in animated
word-by-word captions, and gives you ready-to-post shorts. Then edit any clip in
a real in-browser editor, including fully customizable caption styles and
animations, before exporting. Free, no watermark, no account.

## Requirements

- Node 20+
- `ffmpeg` / `ffprobe` on PATH, built with `libass` (captions) and `librsvg`
  (sticker overlays) — most distro ffmpeg builds already include both
- Python 3.10+ with `pip install yt-dlp faster-whisper`
- libass 0.17+ (Ubuntu 24.04 / Debian 12 and newer) for the caption
  "background box" option — everything else works on older libass too
- A system font covering Latin text in bold (DejaVu Sans / Liberation Sans are
  assumed by default on Linux) — used for text overlays. Caption fonts are
  bundled in `public/fonts/`, so captions don't depend on what's installed

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

For a production build:

```bash
npm run build
npm start
```

`npm run lint` runs ESLint.

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
   libass, animated by default (each caption pops in and the spoken word is
   highlighted). Clips render with bounded concurrency (3 at a time) rather
   than sequentially.
5. **Edit** (`app/editor/[jobId]/[clipIndex]`, `lib/exportRender.ts`) — every
   clip can be opened in a real in-browser editor: trim, reframe (drag-to-pan
   + zoom over the original footage), style animated captions (see below), add
   draggable text overlays and stickers, apply color filters, mix in a music
   track. Everything previews live in the browser; **Export** renders the
   final file in a single `ffmpeg` pass combining every edit.

Jobs are tracked in-memory with an async-persisted `storage/db.json` snapshot
(single instance — swap for a real DB/queue if you deploy this for more than a
few concurrent users). Output files, raw per-clip segments (the editor's
working source), and uploaded music live under `storage/jobs/<id>/` and are
streamed through `/api/files/*`.

## Animated captions

The editor's **Captions** tab gives you full control of how captions look and
move:

- **Presets:** Spotlight, Karaoke, Word box, Bouncy, Neon, Typewriter, Comic,
  Marker and Clean. One click applies a preset, and you can tweak anything
  after that.
- **Entrance animation:** none, fade, pop, bounce, slide up, zoom in, swing.
- **Word effects:** these follow the transcript's word timings.
  - Highlight: the spoken word changes colour.
  - Word pop: the spoken word scales up and changes colour.
  - Karaoke: colour sweeps across each word as it's said.
  - Word box: a coloured box sits behind the spoken word.
  - Reveal: words appear as they're spoken.
  - Glow: the spoken word glows.
- **Text:** 7 bundled fonts plus the system ones, size, letter spacing,
  uppercase, and words per caption (1–6).
- **Colours and effects:** text and highlight colours, outline colour and
  width, drop-shadow colour, distance and opacity, and an optional background
  box.
- **Position:** presets or a slider, or drag the caption on the preview.

The last style you used is remembered in your browser for the next clip.

How it works: `lib/captions.ts` holds the keyframes and word timing.
`components/editor/CaptionOverlay.tsx` plays them back live, reading the
video clock every frame. The export turns the same keyframes into libass
override tags: `\t` transforms, `\kf` karaoke, and one event per spoken
word for word effects. Because both renderers read from one place, the
preview matches the exported file. Fonts in `public/fonts/` are loaded with
`@font-face` in the browser and passed to ffmpeg's `ass` filter as
`fontsdir`, and `lib/captionFonts.ts` corrects for how libass sizes fonts
compared with CSS. All fonts are free to redistribute; see
`public/FONT-LICENSES.md`.

### Adding a caption font

1. Drop the `.ttf` into `public/fonts/` and add its license to
   `public/FONT-LICENSES.md`.
2. Add an `@font-face` rule for it in `app/globals.css`.
3. Add an entry to `CAPTION_FONT_LIST` in `lib/captionFonts.ts`:
   - `assFamily`: set this only if libass needs a different name than the
     CSS family. Static non-regular weights often do, e.g.
     "Poppins ExtraBold".
   - `cssScale`: `unitsPerEm / (usWinAscent + usWinDescent)`, taken from
     the font's `head` and `OS/2` tables.
4. Check that libass picks the file you expect. Render a caption with
   `ffmpeg -v verbose ... -vf ass=file.ass:fontsdir=public/fonts` and look
   at the `fontselect:` line. If the name doesn't match, libass quietly
   falls back to some other installed font.

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
  Premiere/CapCut clone — no multi-track timeline, transitions, custom
  keyframed animation of overlays, or undo history.
- Word-level caption effects need Whisper's word timings. If you edit a
  caption's text so its word count changes, that caption's words are
  re-timed evenly across its duration. Clips made by the silence-detection
  fallback have no transcript, so they have no captions to animate (you can
  still add caption text by hand).
- With the "Word pop" effect, the popping word pushes its neighbours aside
  slightly in the exported video but not in the preview. libass lays out
  scaled text, while CSS transforms don't affect layout.
- Caption styles are remembered per browser (`localStorage`), not per job or
  account.
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
- `lib/captions.ts` — animated caption engine: styles, presets, validation,
  word timing, animation keyframes, and ASS generation (used by both the
  default render and the editor export).
- `lib/captionFonts.ts` — caption font registry (CSS ↔ libass names and
  size metrics).
- `public/fonts/` — bundled caption fonts (licenses in
  `public/FONT-LICENSES.md`).
- `lib/games/` — chess AI (`chessAi.ts`) and modes (`chessModes.ts`).
- `components/editor/` — the in-browser clip editor UI.
  `CaptionOverlay.tsx` is the live animated-caption preview, and
  `panels/CaptionsPanel.tsx` is the caption style and animation controls.
- `components/landing/` — the home page: a dependency-free WebGL shader
  backdrop (`ShaderBackdrop.tsx`), the 3D clip orbit (`Hero.tsx`), the
  scroll-pinned "how it works" sequence (`ForgeSequence.tsx`), and a live
  caption showcase driven by the real `CAPTION_PRESETS`
  (`CaptionShowcase.tsx`). All looping motion respects
  `prefers-reduced-motion`.
- `components/games/` — Chessboard, Snake, Game2048, and the GameHub tab
  switcher.
