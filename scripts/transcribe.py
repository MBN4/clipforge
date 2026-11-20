#!/usr/bin/env python3
"""Transcribe audio to word-level timestamped JSON using faster-whisper.
Usage: transcribe.py <audio_path> <out_json_path> [model_size] [language|auto] [transcribe|translate] [beam_size]
Exits non-zero and prints an error to stderr if the model cannot be loaded
(e.g. no network to fetch weights) so the caller can fall back gracefully.
"""
import os
import sys
import json


def main():
    if len(sys.argv) < 3:
        print("usage: transcribe.py <audio> <out.json> [model]", file=sys.stderr)
        sys.exit(2)

    audio_path = sys.argv[1]
    out_path = sys.argv[2]
    model_size = sys.argv[3] if len(sys.argv) > 3 else "base"
    language = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != "auto" else None
    task = sys.argv[5] if len(sys.argv) > 5 and sys.argv[5] in ("transcribe", "translate") else "transcribe"
    try:
        beam_size = max(1, min(8, int(sys.argv[6]))) if len(sys.argv) > 6 else 1
    except ValueError:
        beam_size = 1

    try:
        from faster_whisper import WhisperModel
    except Exception as e:
        print(f"faster-whisper not available: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        model = WhisperModel(
            model_size,
            device="cpu",
            compute_type="int8",
            cpu_threads=max(1, (os.cpu_count() or 4) // 2),  # logical CPUs are usually 2x physical cores; more threads just thrash
        )
        # Highlight-picking just needs decent timing + rough text, not
        # publication-quality transcripts — beam_size=1 (greedy) instead of
        # faster-whisper's default beam_size=5 cuts transcription time
        # dramatically for a small accuracy cost, and condition_on_previous_text
        # avoids the extra context-conditioning pass.
        segments_iter, info = model.transcribe(
            audio_path,
            word_timestamps=True,
            vad_filter=True,
            language=language,
            task=task,
            beam_size=beam_size,
            condition_on_previous_text=False,
        )

        segments = []
        for seg in segments_iter:
            words = [
                {"word": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3)}
                for w in (seg.words or [])
            ]
            segments.append(
                {
                    "text": seg.text.strip(),
                    "start": round(seg.start, 3),
                    "end": round(seg.end, 3),
                    "words": words,
                }
            )

        result = {
            "method": "whisper",
            "language": info.language,
            "duration": info.duration,
            "segments": segments,
        }
        with open(out_path, "w") as f:
            json.dump(result, f)
    except Exception as e:
        print(f"transcription failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
