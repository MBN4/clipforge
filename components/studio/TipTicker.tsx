"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const TIPS = [
  "Clips between 20–40 seconds tend to get watched all the way through.",
  "A strong first word matters more than a strong first sentence.",
  "Burned-in captions lift watch time — most people scroll on mute.",
  "Vertical crops that keep the whole shot in view beat hard face-crops.",
  "The best clip is rarely the beginning — it's usually buried mid-video.",
  "Questions and contradictions make people stop scrolling.",
  "Posting the same clip to Shorts, Reels, and TikTok costs nothing extra.",
];

export function TipTicker() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % TIPS.length), 4500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mx-auto h-10 max-w-md text-center">
      <AnimatePresence mode="wait">
        <motion.p
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.4 }}
          className="text-sm text-paper-dim"
        >
          {TIPS[i]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
