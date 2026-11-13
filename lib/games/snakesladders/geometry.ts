// Pure SVG geometry for the board: square centres, snake bodies, ladders. All in a 1000x1000 viewBox.
import { squareToRC } from "./board";

export interface Pt {
  x: number;
  y: number;
}
export const VB = 1000;
export const cellOf = (size: number) => VB / size;

export function squareCenter(n: number, size: number): Pt {
  const { row, col } = squareToRC(n, size);
  const c = cellOf(size);
  return { x: (col + 0.5) * c, y: (size - 1 - row + 0.5) * c };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Head-to-tail centreline of a snake as a smooth sinuous curve (N+1 samples). Tokens slide along this. */
export function snakeCenterline(from: number, to: number, size: number, index: number, N = 72): Pt[] {
  const H = squareCenter(from, size);
  const T = squareCenter(to, size);
  const c = cellOf(size);
  const dx = T.x - H.x;
  const dy = T.y - H.y;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const nx = -uy;
  const ny = ux;
  const waves = Math.max(2, Math.round(L / (c * 1.7)));
  const amp = Math.min(L * 0.2, c * 1.05) * (index % 2 === 0 ? 1 : -1);
  const pts: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const off = amp * Math.sin(Math.PI * waves * t) * Math.pow(Math.sin(Math.PI * t), 0.6);
    pts.push({ x: H.x + dx * t + nx * off, y: H.y + dy * t + ny * off });
  }
  return pts;
}

export function polyLength(pts: Pt[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return s;
}

/** Point at fraction t (0..1) of the polyline's arc length. */
export function pointAlong(pts: Pt[], t: number): Pt {
  if (t <= 0) return pts[0];
  if (t >= 1) return pts[pts.length - 1];
  const total = polyLength(pts);
  let want = t * total;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (want <= seg) {
      const k = seg === 0 ? 0 : want / seg;
      return { x: lerp(pts[i - 1].x, pts[i].x, k), y: lerp(pts[i - 1].y, pts[i].y, k) };
    }
    want -= seg;
  }
  return pts[pts.length - 1];
}

export interface SnakeShape {
  center: Pt[];
  left: Pt[];
  right: Pt[];
  widths: number[];
  /** closed outline path for the body */
  body: string;
  /** polyline path through the centre */
  centerPath: string;
  head: { x: number; y: number; angle: number };
}

const fmt = (n: number) => n.toFixed(1);
const toPath = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${fmt(p.x)} ${fmt(p.y)}`).join(" ");

export function snakeShape(from: number, to: number, size: number, index: number): SnakeShape {
  const center = snakeCenterline(from, to, size, index);
  const c = cellOf(size);
  const N = center.length - 1;
  const left: Pt[] = [];
  const right: Pt[] = [];
  const widths: number[] = [];
  for (let i = 0; i <= N; i++) {
    const a = center[Math.max(0, i - 1)];
    const b = center[Math.min(N, i + 1)];
    const tx = b.x - a.x;
    const ty = b.y - a.y;
    const tl = Math.hypot(tx, ty) || 1;
    const nx = -ty / tl;
    const ny = tx / tl;
    const t = i / N;
    const w = c * (0.035 + 0.135 * Math.pow(1 - t, 0.85)) * (t < 0.08 ? 0.75 + t * 3 : 1);
    widths.push(w);
    left.push({ x: center[i].x + nx * w, y: center[i].y + ny * w });
    right.push({ x: center[i].x - nx * w, y: center[i].y - ny * w });
  }
  const outline = [...left, ...right.slice().reverse()];
  const body = toPath(outline) + " Z";
  const h0 = center[0];
  const h1 = center[2];
  // the head faces away from the body
  const angle = (Math.atan2(h0.y - h1.y, h0.x - h1.x) * 180) / Math.PI;
  return { center, left, right, widths, body, centerPath: toPath(center), head: { x: h0.x, y: h0.y, angle } };
}

export interface LadderShape {
  foot: Pt;
  top: Pt;
  railA: [Pt, Pt];
  railB: [Pt, Pt];
  rungs: [Pt, Pt][];
  length: number;
  railWidth: number;
  rungWidth: number;
}

export function ladderShape(from: number, to: number, size: number): LadderShape {
  const F = squareCenter(from, size);
  const T = squareCenter(to, size);
  const c = cellOf(size);
  const dx = T.x - F.x;
  const dy = T.y - F.y;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const nx = -uy;
  const ny = ux;
  const g = c * 0.15;
  const inset = c * 0.12;
  const s0 = { x: F.x + ux * inset, y: F.y + uy * inset };
  const s1 = { x: T.x - ux * inset, y: T.y - uy * inset };
  const railA: [Pt, Pt] = [{ x: s0.x + nx * g, y: s0.y + ny * g }, { x: s1.x + nx * g, y: s1.y + ny * g }];
  const railB: [Pt, Pt] = [{ x: s0.x - nx * g, y: s0.y - ny * g }, { x: s1.x - nx * g, y: s1.y - ny * g }];
  const count = Math.max(2, Math.floor((L - inset * 2) / (c * 0.3)));
  const rungs: [Pt, Pt][] = [];
  for (let k = 0; k < count; k++) {
    const t = (k + 0.5) / count;
    const p = { x: lerp(s0.x, s1.x, t), y: lerp(s0.y, s1.y, t) };
    rungs.push([{ x: p.x + nx * g, y: p.y + ny * g }, { x: p.x - nx * g, y: p.y - ny * g }]);
  }
  return { foot: F, top: T, railA, railB, rungs, length: L, railWidth: c * 0.055, rungWidth: c * 0.035 };
}
