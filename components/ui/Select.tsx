"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** small secondary text on the right of the option */
  hint?: string;
}

interface Props<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  ariaLabel?: string;
  /** extra classes for the trigger button (use for width, e.g. "sm:w-56") */
  className?: string;
  /** md = page toolbars, sm = compact side panels */
  size?: "md" | "sm";
  /** minimum width of the open panel in px (it's never narrower than the trigger) */
  menuWidth?: number;
}

interface Pos {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
  up: boolean;
}

const GAP = 6;
const MENU_MAX = 288;

/**
 * Drop-in replacement for the browser's <select>, whose popup can't be styled. Animated panel,
 * keyboard support (arrows, Home/End, Enter, Esc, type-to-jump), and rendered in a portal so it's
 * never clipped by a dialog or scroll container. Flips upward when there's no room below.
 */
export function Select<T extends string>({ value, onChange, options, ariaLabel, className = "", size = "md", menuWidth = 200 }: Props<T>) {
  const reduce = useReducedMotion();
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<Pos | null>(null);

  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const selected = options[selectedIndex];

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(Math.max(r.width, menuWidth), window.innerWidth - 16);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    const below = window.innerHeight - r.bottom - GAP - 8;
    const above = r.top - GAP - 8;
    const up = below < 200 && above > below;
    const room = up ? above : below;
    setPos({
      left,
      width,
      maxHeight: Math.max(120, Math.min(MENU_MAX, room)),
      up,
      ...(up ? { bottom: window.innerHeight - r.top + GAP } : { top: r.bottom + GAP }),
    });
  }, [menuWidth]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true); // capture: follows scrolling containers too
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // move focus into the open list so the keyboard works however the menu was opened
  // (Safari doesn't focus a button when it's clicked)
  useEffect(() => {
    if (open && pos) menuRef.current?.focus({ preventScroll: true });
  }, [open, pos]);

  // keep the active row in view while arrowing through a long list
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, pos]);

  function openMenu() {
    setActive(selectedIndex);
    setOpen(true);
  }
  function choose(i: number) {
    const o = options[i];
    if (o) onChange(o.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => Math.min(options.length - 1, a + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(active);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          // type-to-jump, like a native select
          const now = Date.now();
          typed.current.text = now - typed.current.at > 700 ? e.key.toLowerCase() : typed.current.text + e.key.toLowerCase();
          typed.current.at = now;
          const hit = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text));
          if (hit >= 0) setActive(hit);
        }
    }
  }

  const trigger =
    size === "sm"
      ? "rounded-lg bg-ink-3 px-2.5 py-1.5 text-xs gap-1.5"
      : "rounded-xl bg-ink-2 px-4 py-3 text-sm gap-2";
  const row = size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={`group flex w-full items-center justify-between border text-left text-paper outline-none transition-colors ${trigger} ${
          open ? "border-ember" : "border-line-strong hover:border-white/30 focus-visible:border-ember"
        } ${className}`}
      >
        <span className="min-w-0 flex-1 truncate">{selected?.label}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-paper-dim transition-transform duration-200 group-hover:text-paper ${open ? "rotate-180 text-ember" : ""}`}
        />
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && pos && (
              <motion.ul
                ref={menuRef}
                id={`${id}-list`}
                role="listbox"
                aria-label={ariaLabel}
                tabIndex={-1}
                onKeyDown={onKeyDown}
                initial={reduce ? false : { opacity: 0, y: pos.up ? 8 : -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: pos.up ? 6 : -6, scale: 0.97, transition: { duration: 0.12 } }}
                transition={{ duration: reduce ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position: "fixed",
                  left: pos.left,
                  width: pos.width,
                  top: pos.top,
                  bottom: pos.bottom,
                  maxHeight: pos.maxHeight,
                  transformOrigin: pos.up ? "bottom center" : "top center",
                }}
                className="z-[100] overflow-y-auto outline-none [scrollbar-color:rgba(255,255,255,0.22)_transparent] [scrollbar-width:thin] rounded-xl border border-line-strong bg-ink-2/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl"
              >
                {options.map((o, i) => {
                  const isSel = o.value === value;
                  return (
                    <motion.li
                      key={o.value}
                      data-i={i}
                      role="option"
                      aria-selected={isSel}
                      title={o.label}
                      initial={reduce ? false : { opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.16, delay: reduce ? 0 : Math.min(i, 8) * 0.016 }}
                      onPointerEnter={() => setActive(i)}
                      onClick={() => choose(i)}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg leading-snug transition-colors ${row} ${
                        i === active ? "bg-white/[0.07]" : ""
                      } ${isSel ? "font-semibold text-ember-soft" : "text-paper"}`}
                    >
                      <span className="line-clamp-2 min-w-0 flex-1 break-words">{o.label}</span>
                      {o.hint && <span className="shrink-0 text-[11px] text-paper-dim">{o.hint}</span>}
                      {isSel && <Check className="h-4 w-4 shrink-0 text-ember" strokeWidth={2.5} />}
                    </motion.li>
                  );
                })}
              </motion.ul>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
