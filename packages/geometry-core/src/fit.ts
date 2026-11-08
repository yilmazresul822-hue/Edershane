import type { Vec } from "./vec";
import type { Box } from "./layout";

/** Matematik koordinatlarını (y yukarı) ekrana (y aşağı) sığdırır. Tek tip ölçek, açılar korunur. */
export function fitToBounds(points: Record<string, Vec>, b: Box, margin = 40): Record<string, Vec> {
  const v = Object.values(points);
  const xs = v.map((p) => p.x), ys = v.map((p) => p.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const bw = Math.max(1e-9, Math.max(...xs) - minX), bh = Math.max(1e-9, Math.max(...ys) - minY);
  const s = Math.min((b.w - 2 * margin) / bw, (b.h - 2 * margin) / bh);
  const ox = b.x + (b.w - bw * s) / 2, oy = b.y + (b.h - bh * s) / 2;
  const out: Record<string, Vec> = {};
  for (const [k, p] of Object.entries(points)) out[k] = { x: ox + (p.x - minX) * s, y: oy + (bh - (p.y - minY)) * s };
  return out;
}
