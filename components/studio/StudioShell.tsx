"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Activity, ArrowLeft, Clapperboard, LayoutDashboard, ListVideo, Plus, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/Logo";
import { SoundToggle } from "@/components/SoundToggle";
import { DashboardProvider, useDashboard } from "./DashboardProvider";
import { isActive } from "@/lib/dashboard";
import { Label } from "./ui";

const NAV: { href: string; label: string; icon: LucideIcon; badge?: "queue" | "clips" }[] = [
  { href: "/studio", label: "Overview", icon: LayoutDashboard },
  { href: "/studio/new", label: "New project", icon: Plus },
  { href: "/studio/queue", label: "Queue", icon: ListVideo, badge: "queue" },
  { href: "/studio/library", label: "Library", icon: Clapperboard, badge: "clips" },
  { href: "/studio/activity", label: "Activity", icon: Activity },
];

function useActiveHref() {
  const path = usePathname();
  // longest matching tab wins, so "/studio" is only "Overview" on the exact page
  const match = NAV.filter((n) => (n.href === "/studio" ? path === "/studio" : path.startsWith(n.href))).sort((a, b) => b.href.length - a.href.length)[0];
  return match?.href;
}

function useBadges() {
  const { jobs } = useDashboard();
  return {
    queue: jobs.filter(isActive).length,
    clips: jobs.reduce((n, j) => n + (j.stage === "done" ? j.clips.length : 0), 0),
  };
}

function Meter({ label, used, cap }: { label: string; used: number; cap: number }) {
  const pct = cap ? Math.round((used / cap) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-paper-dim">
        <span>{label}</span>
        <span className="tabular-nums text-paper">{pct}%</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.07]">
        <div className="h-full rounded-full bg-gradient-to-r from-ember to-ember-soft transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Sidebar() {
  const active = useActiveHref();
  const badges = useBadges();
  const { system, offline } = useDashboard();
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-ink-2/40 px-4 py-5 backdrop-blur-xl lg:flex">
      <Link href="/" className="px-2" aria-label="Clipforge home">
        <Logo />
      </Link>

      <nav className="mt-8 flex flex-col gap-1" aria-label="Studio">
        {NAV.map((n) => {
          const on = active === n.href;
          const count = n.badge ? badges[n.badge] : 0;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                on ? "text-paper" : "text-paper-dim hover:text-paper"
              }`}
            >
              {on && (
                <motion.span
                  layoutId="studio-nav-active"
                  className="absolute inset-0 rounded-xl border border-white/10 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                />
              )}
              {on && <span className="absolute -left-4 top-2 bottom-2 w-[3px] rounded-r-full bg-ember" />}
              <n.icon className={`relative h-[18px] w-[18px] ${on ? "text-ember" : ""}`} strokeWidth={1.75} />
              <span className="relative">{n.label}</span>
              {count > 0 && (
                <span
                  className={`relative ml-auto min-w-5 rounded-full px-1.5 py-0.5 text-center font-mono text-[10px] tabular-nums ${
                    n.badge === "queue" ? "bg-ember text-ink" : "bg-white/10 text-paper-dim"
                  }`}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-4">
        <div className="rounded-xl border border-line-strong bg-ink/60 p-3.5">
          <div className="mb-3 flex items-center justify-between">
            <Label>Engine</Label>
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-paper-dim">
              <span className={`h-1.5 w-1.5 rounded-full ${offline ? "bg-red-400" : "bg-moss pulse-dot"}`} />
              {offline ? "Offline" : "Live"}
            </span>
          </div>
          <div className="space-y-3">
            <Meter label="Compute" used={system?.compute.used ?? 0} cap={system?.compute.capacity ?? 1} />
            <Meter label="Downloads" used={system?.downloads.active ?? 0} cap={system?.downloads.limit ?? 1} />
          </div>
          {system && <p className="mt-3 text-[11px] leading-relaxed text-paper-dim">{system.cpus} cores shared fairly across all videos.</p>}
        </div>
        <div className="flex items-center justify-between px-1">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-paper-dim transition hover:text-paper">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to site
          </Link>
          <SoundToggle />
        </div>
      </div>
    </aside>
  );
}

function MobileBars() {
  const active = useActiveHref();
  const badges = useBadges();
  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-ink/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link href="/" aria-label="Clipforge home">
          <Logo />
        </Link>
        <SoundToggle />
      </header>
      <nav
        aria-label="Studio"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-ink/90 px-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl lg:hidden"
      >
        {NAV.map((n) => {
          const on = active === n.href;
          const count = n.badge === "queue" ? badges.queue : 0;
          return (
            <Link key={n.href} href={n.href} className={`relative flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] font-medium ${on ? "text-paper" : "text-paper-dim"}`}>
              <span className="relative">
                <n.icon className={`h-5 w-5 ${on ? "text-ember" : ""}`} strokeWidth={1.75} />
                {count > 0 && <span className="absolute -right-2 -top-1.5 min-w-4 rounded-full bg-ember px-1 text-center font-mono text-[9px] text-ink">{count}</span>}
              </span>
              {n.label.split(" ")[0]}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export function StudioShell({ children }: { children: React.ReactNode }) {
  return (
    <DashboardProvider>
      <div className="relative flex min-h-screen flex-1">
        <Sidebar />
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[420px] overflow-hidden" aria-hidden>
            <div className="absolute -right-24 -top-32 h-[420px] w-[520px] rounded-full bg-ember/[0.12] blur-[120px]" />
            <div className="absolute left-1/3 -top-40 h-[300px] w-[420px] rounded-full bg-moss/[0.05] blur-[120px]" />
          </div>
          <MobileBars />
          <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-28 pt-8 sm:px-6 lg:px-10 lg:pb-16 lg:pt-12">{children}</main>
        </div>
      </div>
    </DashboardProvider>
  );
}
