import { Vec } from "./vec";

export type Box = { x: number; y: number; w: number; h: number };
export type Obstacles = {
  segments: [Vec, Vec][];
  boxes: Box[];          // diğer etiketler, PDF metin kutuları
  bounds: Box;           // görünür alan
};

const ccw = (a: Vec, b: Vec, c: Vec) => (c.y - a.y) * (b.x - a.x) - (b.y - a.y) * (c.x - a.x);
const segCross = (a: Vec, b: Vec, c: Vec, d: Vec) =>
  ccw(a, c, d) * ccw(b, c, d) < 0 && ccw(a, b, c) * ccw(a, b, d) < 0;
const inBox = (p: Vec, r: Box) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

export function segHitsBox(s: [Vec, Vec], r: Box): boolean {
  if (inBox(s[0], r) || inBox(s[1], r)) return true;
  const c: Vec[] = [
    { x: r.x, y: r.y }, { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h },
  ];
  for (let i = 0; i < 4; i++) if (segCross(s[0], s[1], c[i], c[(i + 1) % 4])) return true;
  return false;
}

export const boxesOverlap = (a: Box, b: Box) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const inside = (r: Box, b: Box) =>
  r.x >= b.x && r.y >= b.y && r.x + r.w <= b.x + b.w && r.y + r.h <= b.y + b.h;

/** Etiket için en uygun kutuyu seçer. Çakışmasız aday yoksa ok=false döner. */
export function placeLabel(
  anchor: Vec, size: { w: number; h: number }, obs: Obstacles, gap = 8
): { box: Box; ok: boolean } {
  let best: Box | null = null;
  let bestScore = Infinity;
  for (const r of [gap, gap * 2, gap * 3]) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * 2 * Math.PI;
      const cx = anchor.x + Math.cos(a) * (r + size.w / 2);
      const cy = anchor.y + Math.sin(a) * (r + size.h / 2);
      const box: Box = { x: cx - size.w / 2, y: cy - size.h / 2, w: size.w, h: size.h };
      let score = r; // yakın olan tercih edilir
      if (!inside(box, obs.bounds)) score += 1e6;
      for (const s of obs.segments) if (segHitsBox(s, box)) score += 1000;
      for (const o of obs.boxes) if (boxesOverlap(box, o)) score += 1000;
      if (score < bestScore) { bestScore = score; best = box; }
    }
  }
  return { box: best!, ok: bestScore < 1000 };
}
