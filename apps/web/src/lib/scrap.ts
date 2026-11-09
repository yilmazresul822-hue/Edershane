/** Yırtık kâğıt kenarı üreten clip-path çokgeni. Aynı tohum her zaman aynı kenarı verir. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type TornOpts = { w?: number; h?: number; amp?: number; step?: number };

/** w, h: elemanın yaklaşık piksel boyu; amp: kenardaki en büyük çıkıntı (px); step: kenar boyunca ortalama aralık (px). */
export function tornPolygon(seed: number, o: TornOpts = {}): string {
  const w = Math.max(20, o.w ?? 320), h = Math.max(20, o.h ?? 120);
  const amp = o.amp ?? 3, step = o.step ?? 13;
  const r = rng(seed);
  const ax = (amp / w) * 100, ay = (amp / h) * 100;      // piksel çıkıntıyı yüzdeye çevir
  const sx = (step / w) * 100, sy = (step / h) * 100;
  const pts: [number, number][] = [];
  const next = (s: number) => s * (0.55 + r() * 0.9);
  for (let x = 0; x < 100; x += next(sx)) pts.push([x, r() * ay]);                 // üst
  for (let y = 0; y < 100; y += next(sy)) pts.push([100 - r() * ax, y]);           // sağ
  for (let x = 100; x > 0; x -= next(sx)) pts.push([x, 100 - r() * ay]);           // alt
  for (let y = 100; y > 0; y -= next(sy)) pts.push([r() * ax, y]);                 // sol
  return "polygon(" + pts.map(([x, y]) => `${Math.min(100, Math.max(0, x)).toFixed(1)}% ${Math.min(100, Math.max(0, y)).toFixed(1)}%`).join(",") + ")";
}
