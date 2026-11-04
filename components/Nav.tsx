import Link from "next/link";
import { Logo } from "./Logo";

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-ink/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-paper-dim md:flex">
          <a href="/#how" className="transition hover:text-paper">
            How it works
          </a>
          <a href="/#pricing" className="transition hover:text-paper">
            Pricing
          </a>
          <a
            href="https://github.com"
            className="transition hover:text-paper"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </nav>
        <Link
          href="/studio"
          className="rounded-full bg-paper px-4 py-2 text-sm font-semibold text-ink transition hover:bg-ember hover:text-ink"
        >
          Open Studio
        </Link>
      </div>
    </header>
  );
}
