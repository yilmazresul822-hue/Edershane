import { describe, it, expect } from "vitest";
import { tornPolygon } from "./scrap";

const coords = (s: string) => [...s.matchAll(/([\d.]+)% ([\d.]+)%/g)].map((m) => [Number(m[1]), Number(m[2])]);

describe("tornPolygon", () => {
  it("geçerli bir clip-path çokgeni üretir, tüm noktalar kutunun içinde", () => {
    const s = tornPolygon(7, { w: 300, h: 100 });
    expect(s.startsWith("polygon(")).toBe(true);
    const c = coords(s);
    expect(c.length).toBeGreaterThan(20);
    for (const [x, y] of c) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(100); expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(100); }
  });
  it("aynı tohum aynı kenarı, farklı tohum farklı kenarı verir", () => {
    expect(tornPolygon(3)).toBe(tornPolygon(3));
    expect(tornPolygon(3)).not.toBe(tornPolygon(4));
  });
  it("çıkıntı piksel olarak sınırlıdır: 3px çıkıntı 100px'lik kenarda en çok %3", () => {
    const c = coords(tornPolygon(5, { w: 400, h: 100, amp: 3 }));
    const topYs = c.filter(([x, y]) => x > 2 && x < 96 && y < 50).map(([, y]) => y);
    expect(Math.max(...topYs)).toBeLessThanOrEqual(3.1);
  });
});
