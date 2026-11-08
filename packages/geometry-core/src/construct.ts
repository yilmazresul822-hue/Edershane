import { Vec, add, sub, mul, dot, len, dist, unit } from "./vec";

export const midpoint = (a: Vec, b: Vec): Vec => mul(add(a, b), 0.5);

/** Açı (derece): vertex köşesinde p1-vertex-p2 */
export function angleDeg(vertex: Vec, p1: Vec, p2: Vec): number {
  const u = unit(sub(p1, vertex));
  const v = unit(sub(p2, vertex));
  const c = Math.max(-1, Math.min(1, dot(u, v)));
  return (Math.acos(c) * 180) / Math.PI;
}

export type Altitude = {
  foot: Vec;
  t: number;
  outside: boolean;
  /** Ayak kenarın dışındaysa kenarı uzatan kesikli çizgi */
  extension: [Vec, Vec] | null;
};

/** p noktasından a-b doğrusuna dikme */
export function altitude(p: Vec, a: Vec, b: Vec): Altitude {
  const ab = sub(b, a);
  const d = dot(ab, ab);
  if (d < 1e-12) throw new Error("Kenar sıfır uzunluklu");
  const t = dot(sub(p, a), ab) / d;
  const foot = add(a, mul(ab, t));
  const outside = t < 0 || t > 1;
  const extension: [Vec, Vec] | null =
    t < 0 ? [a, foot] : t > 1 ? [b, foot] : null;
  return { foot, t, outside, extension };
}

/** vertex köşesinden karşı kenar (b-c) üzerine açıortay ayağı */
export function bisectorFoot(vertex: Vec, b: Vec, c: Vec): Vec {
  const ab = dist(vertex, b);
  const ac = dist(vertex, c);
  return add(b, mul(sub(c, b), ab / (ab + ac)));
}

/** p'den a-b'ye paralel, verilen uzunlukta doğru parçası (p merkezli) */
export function parallelThrough(p: Vec, a: Vec, b: Vec, length: number): [Vec, Vec] {
  const u = unit(sub(b, a));
  const h = mul(u, length / 2);
  return [sub(p, h), add(p, h)];
}

/** Dik açı kare işareti: köşe + iki ışın yönünde 3 nokta */
export function rightAngleMarker(vertex: Vec, p1: Vec, p2: Vec, size: number): [Vec, Vec, Vec] {
  const u = mul(unit(sub(p1, vertex)), size);
  const v = mul(unit(sub(p2, vertex)), size);
  return [add(vertex, u), add(add(vertex, u), v), add(vertex, v)];
}

export const segLength = (a: Vec, b: Vec) => len(sub(a, b));
