"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  onSubmitUrl: (url: string) => void;
  onSubmitFile: (file: File) => void;
  disabled?: boolean;
  busyLabel?: string | null;
}

export function SourceInput({ onSubmitUrl, onSubmitFile, disabled, busyLabel }: Props) {
  const [mode, setMode] = useState<"link" | "upload">("link");
  const [url, setUrl] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-5 inline-flex rounded-full border border-line-strong bg-ink-2 p-1 text-sm">
        {(["link", "upload"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-full px-4 py-1.5 font-medium transition ${
              mode === m ? "bg-paper text-ink" : "text-paper-dim hover:text-paper"
            }`}
          >
            {m === "link" ? "Paste a link" : "Upload a file"}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {mode === "link" ? (
          <motion.form
            key="link"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (url.trim()) onSubmitUrl(url.trim());
            }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=…"
              disabled={disabled}
              className="flex-1 rounded-2xl border border-line-strong bg-ink-2 px-5 py-4 font-mono text-sm text-paper placeholder:text-paper-dim/60 outline-none transition focus:border-ember disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={disabled || !url.trim()}
              className="rounded-2xl bg-ember px-7 py-4 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-40"
            >
              {busyLabel || "Continue"}
            </button>
          </motion.form>
        ) : (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) onSubmitFile(file);
            }}
            onClick={() => !disabled && inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition ${
              dragOver ? "border-ember bg-ember/5" : "border-line-strong bg-ink-2"
            } ${disabled ? "pointer-events-none opacity-50" : ""}`}
          >
            <p className="font-medium text-paper">Drop a video file here</p>
            <p className="mt-1 text-sm text-paper-dim">or click to browse — mp4, mov, mkv</p>
            <input
              ref={inputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onSubmitFile(file);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
