import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t border-line px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-paper-dim sm:flex-row">
        <Logo />
        <p>Built for creators who'd rather post than edit.</p>
        <p className="font-mono text-xs">© Clipforge</p>
      </div>
    </footer>
  );
}
