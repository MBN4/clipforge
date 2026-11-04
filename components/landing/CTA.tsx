import Link from "next/link";

export function CTA() {
  return (
    <section id="pricing" className="border-t border-line px-6 py-28">
      <div className="mx-auto flex max-w-4xl flex-col items-center rounded-[2rem] border border-line-strong bg-ink-2 px-8 py-16 text-center">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-moss">
          $0 / month, forever
        </span>
        <h2 className="mt-5 text-balance font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Your next clip is two minutes away.
        </h2>
        <p className="mt-4 max-w-md text-sm text-paper-dim">
          No account walls, no card on file. Paste a link and watch it turn
          into something worth posting.
        </p>
        <Link
          href="/studio"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-ember px-7 py-3.5 text-sm font-semibold text-ink transition hover:brightness-110"
        >
          Open the studio →
        </Link>
      </div>
    </section>
  );
}
