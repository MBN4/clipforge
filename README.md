# Clipforge

Paste a YouTube / Instagram / TikTok / Facebook link, or upload a file — Clipforge
transcribes it, finds the best moments, reframes them to 9:16, burns in captions,
and gives you ready-to-post shorts. Free, no watermark, no account.

## Requirements

- Node 20+
- `ffmpeg` / `ffprobe` on PATH
- Python 3.10+ with `pip install yt-dlp faster-whisper`

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## How it works

1. **Ingest** (`lib/download.ts`) — `yt-dlp` pulls the source video, or an uploaded
   file is used directly.
2. **Transcribe** (`lib/transcribe.ts`, `scripts/transcribe.py`) — `faster-whisper`
   (CPU, no GPU needed) produces word-level timestamps. The *first run* downloads
   model weights from Hugging Face — needs outbound network access once, then it's
   cached locally. If the model can't be fetched (offline environment), Clipforge
   automatically falls back to silence-detection heuristics so the app still works,
   just without burned captions.
3. **Highlight selection** (`lib/highlights.ts`, optionally `lib/ai.ts`) — scores
   candidate windows (15–55s) for hook words, pacing, punctuation. If
   `ANTHROPIC_API_KEY` is set, Claude re-ranks and titles the clips instead.
4. **Render** (`lib/render.ts`, `lib/captions.ts`) — `ffmpeg` trims each clip,
   composites a blurred-backdrop 9:16 frame (keeps the full source in view instead
   of a harsh crop), and burns in word-grouped captions via libass.

Jobs are tracked in `storage/db.json` (flat-file, single instance — swap for a real
DB/queue if you deploy this for more than a few concurrent users). Output files live
under `storage/jobs/<id>/` and are streamed through `/api/files/*`.

## ⚠️ About pulling from YouTube / Instagram / TikTok / Facebook

Downloading other people's videos from these platforms via `yt-dlp` generally
violates their Terms of Service, independent of copyright on the underlying
content. This is fine for personal use, re-clipping your own content, or testing —
but if you run this as a public product, you're taking on real legal/takedown risk.
Consider gating URL-based ingestion to content the user attests they own, or
sticking to direct upload only, before shipping this to the public.

## Known limitations

- Single-process job queue (file-backed) — fine for a side project, not for scale.
- No auth/accounts — anyone with the URL can see a job's clips while the dev server
  runs. Add auth before deploying multi-tenant.
- Whisper model download requires one-time network access to huggingface.co.
