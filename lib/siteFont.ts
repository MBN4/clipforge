// Site-wide font choice, picked from the caption showcase on the landing page.
// The choice lives in localStorage and is applied as a data attribute on <html>
// (see the `html[data-site-font]` rule in app/globals.css). An inline script in
// app/layout.tsx re-applies it before first paint, so refreshes never flash the
// default font. Only bundled fonts are offered — they're the ones every
// visitor is guaranteed to have.

export const SITE_FONT_KEY = "clipforge-site-font";
const EVT = "clipforge-site-font-change";

export const SITE_FONT_FILES: Record<string, string> = {
  Poppins: "Poppins-ExtraBold.ttf",
  Anton: "Anton-Regular.ttf",
  "Bebas Neue": "BebasNeue-Regular.ttf",
  "Archivo Black": "ArchivoBlack-Regular.ttf",
  "Luckiest Guy": "LuckiestGuy-Regular.ttf",
  Bangers: "Bangers-Regular.ttf",
  "Permanent Marker": "PermanentMarker-Regular.ttf",
};

export const DEFAULT_SITE_FONT_LABEL = "Bricolage Grotesque + Inter";

export function isSiteFont(family: string): boolean {
  return Object.prototype.hasOwnProperty.call(SITE_FONT_FILES, family);
}

/** Inline script (string) run in <head> to apply the saved font before paint. */
export const SITE_FONT_BOOT_SCRIPT = `(function(){try{var f=localStorage.getItem(${JSON.stringify(SITE_FONT_KEY)});var m=${JSON.stringify(
  SITE_FONT_FILES,
)};if(f&&Object.prototype.hasOwnProperty.call(m,f)){var d=document.documentElement;d.setAttribute("data-site-font",f);d.style.setProperty("--site-font",'"'+f+'", system-ui, sans-serif');var l=document.createElement("link");l.rel="preload";l.as="font";l.type="font/ttf";l.crossOrigin="anonymous";l.href="/fonts/"+m[f];document.head.appendChild(l)}}catch(e){}})();`;

/** The active site font ("" = default). The <html> attribute is the source of truth. */
export function readSiteFont(): string {
  return document.documentElement.getAttribute("data-site-font") ?? "";
}

function apply(family: string) {
  const el = document.documentElement;
  if (family && isSiteFont(family)) {
    el.setAttribute("data-site-font", family);
    el.style.setProperty("--site-font", `"${family}", system-ui, sans-serif`);
  } else {
    el.removeAttribute("data-site-font");
    el.style.removeProperty("--site-font");
  }
}

let token = 0;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type VTDoc = Document & { startViewTransition?: (cb: () => void | Promise<void>) => { finished: Promise<void> } };

/**
 * Set (or, with "", clear) the site font and remember it on this device.
 * The new font is loaded first, then the old page cross-fades into the new one
 * with a View Transition (never going blank), and `anchor` (the section the
 * user is looking at) is held in place so the reflow can't shove the page around.
 */
export async function setSiteFont(family: string, anchor?: Element | null) {
  const next = isSiteFont(family) ? family : "";
  try {
    if (next) localStorage.setItem(SITE_FONT_KEY, next);
    else localStorage.removeItem(SITE_FONT_KEY);
  } catch {}
  if (next === readSiteFont()) return;

  const mine = ++token;
  if (next) {
    try {
      await Promise.race([document.fonts.load(`1em "${next}"`), sleep(1200)]);
    } catch {}
    if (mine !== token) return;
  }

  const swap = async () => {
    const before = anchor?.getBoundingClientRect().top;
    apply(next);
    if (anchor && before !== undefined) {
      const delta = anchor.getBoundingClientRect().top - before;
      if (Math.abs(delta) > 0.5) window.scrollTo({ top: window.scrollY + delta, behavior: "instant" });
    }
    window.dispatchEvent(new Event(EVT));
    await sleep(30); // let React paint the new state before the "after" snapshot is taken
  };

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const doc = document as VTDoc;
  if (!reduce && doc.startViewTransition) {
    await doc.startViewTransition(swap).finished.catch(() => {});
  } else if (!reduce) {
    // no View Transitions: a gentle dip instead of a blank page
    const html = document.documentElement;
    html.classList.add("font-swap");
    await sleep(200);
    await swap();
    requestAnimationFrame(() => requestAnimationFrame(() => html.classList.remove("font-swap")));
  } else {
    await swap();
  }
}

export function subscribeSiteFont(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === SITE_FONT_KEY || e.key === null) {
      apply(e.newValue ?? "");
      cb();
    }
  };
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener("storage", onStorage);
  };
}
