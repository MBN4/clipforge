export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
        <rect x="1" y="1" width="20" height="20" rx="5" stroke="var(--paper)" strokeOpacity="0.25" />
        <path d="M7 6L7 16M7 11H16M16 11L12.5 7.5M16 11L12.5 14.5" stroke="var(--ember)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-display font-semibold tracking-tight text-[1.05rem] text-paper">
        Clipforge
      </span>
    </span>
  );
}
