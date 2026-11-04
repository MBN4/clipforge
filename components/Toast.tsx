"use client";

import { AnimatePresence, motion } from "framer-motion";

export interface ToastData {
  id: string;
  title: string;
  body?: string;
}

export function ToastStack({ toasts, onDismiss }: { toasts: ToastData[]; onDismiss: (id: string) => void }) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[70] flex flex-col gap-2 sm:right-6 sm:top-6">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            onClick={() => onDismiss(t.id)}
            className="pointer-events-auto flex w-72 cursor-pointer items-start gap-3 rounded-2xl border border-line-strong bg-ink-2 p-4 shadow-2xl shadow-black/50"
          >
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-moss" />
            <div>
              <p className="text-sm font-semibold text-paper">{t.title}</p>
              {t.body && <p className="mt-0.5 text-xs text-paper-dim">{t.body}</p>}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
