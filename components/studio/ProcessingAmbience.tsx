"use client";

import { motion } from "framer-motion";

export function ProcessingAmbience() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        className="absolute h-[420px] w-[420px] rounded-full opacity-20 blur-[120px]"
        style={{ background: "var(--ember)" }}
        animate={{ x: [0, 80, -40, 0], y: [0, -60, 40, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        initial={{ top: "10%", left: "15%" }}
      />
      <motion.div
        className="absolute h-[320px] w-[320px] rounded-full opacity-[0.1] blur-[110px]"
        style={{ background: "var(--moss)" }}
        animate={{ x: [0, -60, 50, 0], y: [0, 50, -30, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
        initial={{ bottom: "15%", right: "12%" }}
      />
    </div>
  );
}
