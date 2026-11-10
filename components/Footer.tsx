import Link from "next/link";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-line px-5 pt-14 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-sm text-paper-dim">Built for creators who&apos;d rather post than edit.</p>
        </div>
        <div className="grid grid-cols-2 gap-x-16 gap-y-3 text-sm">
          <span className="font-mono text-[11px] uppercase tracking-widest text-paper-dim/70">Product</span>
          <span className="font-mono text-[11px] uppercase tracking-widest text-paper-dim/70">More</span>
          <Link href="/studio" className="text-paper-dim transition hover:text-paper">
            Studio
          </Link>
          <a href="https://github.com" target="_blank" rel="noreferrer" className="text-paper-dim transition hover:text-paper">
            GitHub
          </a>
          <Link href="/#how" className="text-paper-dim transition hover:text-paper">
            How it works
          </Link>
          <Link href="/#pricing" className="text-paper-dim transition hover:text-paper">
            Pricing
          </Link>
          <Link href="/#captions" className="text-paper-dim transition hover:text-paper">
            Captions
          </Link>
          <span className="font-mono text-xs text-paper-dim/70">© Clipforge</span>
        </div>
      </div>
      <div className="footer-wordmark pointer-events-none mx-auto mt-12 select-none text-center font-display font-semibold leading-[0.8] tracking-[-0.06em]" aria-hidden>
        Clipforge
      </div>
    </footer>
  );
}
