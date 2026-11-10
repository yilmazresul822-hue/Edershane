/** Gerçekçi dokulu kalemler. Aynı tohum + aynı noktalar = aynı çizim (canlı çizim ile son resim birebir uyuşur). */
export type PenId = "pencil" | "fountain" | "ballpoint" | "marker" | "highlighter";
export type Pt = { x: number; y: number; t: number; p?: number };
export type PenSpec = { id: PenId; label: string; mode: "incremental" | "path"; width: number; colors: string[] };

export const PENS: PenSpec[] = [
  { id: "pencil", label: "Kurşun", mode: "incremental", width: 1.8, colors: ["#34343b", "#6b4a2f", "#1d3fa8"] },
  { id: "fountain", label: "Dolma", mode: "incremental", width: 2.8, colors: ["#14206b", "#1b1a17", "#7a1f2b"] },
  { id: "ballpoint", label: "Tükenmez", mode: "incremental", width: 2, colors: ["#1d3fa8", "#1b1a17", "#c4271c"] },
  { id: "marker", label: "Keçeli", mode: "path", width: 5.5, colors: ["#d52b1e", "#1b1a17", "#1f7a4d", "#2f5fb3"] },
  { id: "highlighter", label: "Fosforlu", mode: "path", width: 17, colors: ["#fff04d", "#ff9ad5", "#7be0ff", "#9dff8a"] },
];
export const penSpec = (id: PenId) => PENS.find((p) => p.id === id)!;
export const SIZES = [0.7, 1, 1.7];

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rgba(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return `rgba(0,0,0,${a})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** Kalem (stylus) basıncı varsa çizgi kalınlığı çarpanı; fare/parmakta 1 */
export const pressureFactor = (p?: number) => (p === undefined || p <= 0 ? 1 : 0.55 + clamp(p, 0, 1) * 0.9);

/** k: sahne biriminin cihaz pikseli karşılığı (ctx dönüşümü sahne birimindeyse). Tane boyutu cihaz pikseline göre ayarlanır. */
export class StrokeRenderer {
  private last: Pt | null = null;
  private w: number;
  private r: () => number;
  private skip = 0;
  constructor(private ctx: CanvasRenderingContext2D, private pen: PenSpec, private color: string, private size: number, seed: number, private k: number) {
    this.w = pen.width * size;
    this.r = rng(seed);
  }

  add(pt: Pt) {
    const a = this.last;
    this.last = pt;
    const { ctx, pen, color, k } = this;
    const base = pen.width * this.size * pressureFactor(pt.p);
    if (!a) { // başlangıç noktası
      ctx.save();
      if (pen.id === "fountain") { ctx.fillStyle = rgba(color, 0.9); ctx.beginPath(); ctx.arc(pt.x, pt.y, base * 0.55, 0, 7); ctx.fill(); }
      if (pen.id === "ballpoint") { ctx.fillStyle = rgba(color, 0.85); ctx.beginPath(); ctx.arc(pt.x, pt.y, base * 0.6, 0, 7); ctx.fill(); }
      ctx.restore();
      return;
    }
    const dx = pt.x - a.x, dy = pt.y - a.y, len = Math.hypot(dx, dy);
    if (len < 0.04) return;
    ctx.save();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const line = (lw: number, style: string) => { ctx.strokeStyle = style; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(pt.x, pt.y); ctx.stroke(); };

    if (pen.id === "pencil") {
      line(base * 2.2, rgba(color, 0.07));            // grafit lekesi
      line(base * 0.9, rgba(color, 0.62));             // çekirdek çizgi
      const n = Math.ceil(len * k * 1.7);
      for (let j = 0; j < n; j++) {                    // koyu taneler
        const t = this.r();
        ctx.fillStyle = rgba(color, 0.14 + this.r() * 0.42);
        const s = (0.6 + this.r() * 0.9) / k;
        ctx.fillRect(a.x + dx * t + (this.r() - 0.5) * base * 1.9, a.y + dy * t + (this.r() - 0.5) * base * 1.9, s, s);
      }
      ctx.globalCompositeOperation = "destination-out";  // kâğıdın dokusu: çizgiyi tane tane deler
      for (let j = 0; j < n * 1.1; j++) {
        const t = this.r();
        ctx.fillStyle = `rgba(0,0,0,${0.25 + this.r() * 0.4})`;
        const s = (0.7 + this.r() * 1.1) / k;
        ctx.fillRect(a.x + dx * t + (this.r() - 0.5) * base * 1.5, a.y + dy * t + (this.r() - 0.5) * base * 1.5, s, s);
      }
    } else if (pen.id === "fountain") {
      const sp = len / Math.max(1, pt.t - a.t);          // sahne birimi / ms
      const target = clamp(base * (1.7 - Math.min(1.2, sp * 1.1)), base * 0.42, base * 1.75);
      this.w += (target - this.w) * 0.35;
      line(this.w, rgba(color, 0.96));
      if (sp < 0.07) { ctx.fillStyle = rgba(color, 0.22); ctx.beginPath(); ctx.arc(pt.x, pt.y, this.w * 0.72, 0, 7); ctx.fill(); } // yavaşta mürekkep birikir
    } else if (pen.id === "ballpoint") {
      if (this.skip > 0) { this.skip--; ctx.restore(); return; }
      if (this.r() < 0.018) this.skip = 2;                // arada mürekkep atlar
      line(base, rgba(color, 0.74 + this.r() * 0.22));
      line(base * 0.45, rgba(color, 0.35));               // topun ortasında daha koyu iz
    }
    ctx.restore();
  }
}

/** Keçeli ve fosforlu: tek yol olarak çizilir (eklem noktalarında koyulaşma olmasın). */
export function drawPath(ctx: CanvasRenderingContext2D, pen: PenSpec, color: string, size: number, pts: Pt[]) {
  if (!pts.length) return;
  const base = pen.width * size;
  ctx.save();
  ctx.lineJoin = "round";
  const trace = () => {
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 1) ctx.lineTo(pts[0].x + 0.01, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    if (pts.length > 1) ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
  };
  if (pen.id === "marker") {
    ctx.lineCap = "round";
    ctx.strokeStyle = rgba(color, 0.16); ctx.lineWidth = base * 1.3; trace();   // yumuşak keçe kenarı
    ctx.strokeStyle = rgba(color, 0.88); ctx.lineWidth = base; trace();
  } else {
    ctx.lineCap = "butt";                                                         // fosforlu: düz uçlu
    ctx.strokeStyle = rgba(color, 0.42); ctx.lineWidth = base; trace();
  }
  ctx.restore();
}

export type Rendered = { canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number };

/** Bitmiş çizgiyi sahne koordinatlarında bir resme çevirir (Excalidraw'a eklenip taşınabilsin diye). */
export function strokeToCanvas(pen: PenSpec, color: string, size: number, pts: Pt[], seed: number, maxSide = 4096): Rendered | null {
  if (!pts.length) return null;
  const pad = pen.width * size * 2.4 + 3;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x = Math.min(...xs) - pad, y = Math.min(...ys) - pad;
  const w = Math.max(...xs) - Math.min(...xs) + pad * 2, h = Math.max(...ys) - Math.min(...ys) + pad * 2;
  const k = Math.min(2, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(w * k)); canvas.height = Math.max(1, Math.ceil(h * k));
  const ctx = canvas.getContext("2d")!;
  ctx.scale(k, k); ctx.translate(-x, -y);
  if (pen.mode === "path") drawPath(ctx, pen, color, size, pts);
  else { const sr = new StrokeRenderer(ctx, pen, color, size, seed, k); pts.forEach((p) => sr.add(p)); }
  return { canvas, x, y, w, h };
}
