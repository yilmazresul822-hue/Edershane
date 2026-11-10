import { describe, it, expect } from "vitest";
import { panFor, gainFor, TIMBRE } from "./sound";
import { PENS, rgba, rng, pressureFactor } from "./pens";

describe("stereo konum ve ses seviyesi", () => {
  it("sol kenar sol hoparlör, sağ kenar sağ hoparlör, orta ortada; sınırlıdır", () => {
    expect(panFor(0, 400)).toBeCloseTo(-0.92, 5);
    expect(panFor(400, 400)).toBeCloseTo(0.92, 5);
    expect(panFor(200, 400)).toBeCloseTo(0, 5);
    expect(panFor(-50, 400)).toBeCloseTo(-0.92, 5);
  });
  it("kalem durunca sessiz, hızlanınca yükselir, üst sınır aşılmaz", () => {
    expect(gainFor("pencil", 0)).toBe(0);
    expect(gainFor("pencil", 1)).toBeGreaterThan(gainFor("pencil", 0.2));
    expect(gainFor("pencil", 99)).toBeLessThanOrEqual(0.2);
  });
  it("her kalemin bir sesi var", () => {
    for (const p of PENS) expect(TIMBRE[p.id]).toBeDefined();
  });
});

describe("kalem yardımcıları", () => {
  it("renk dönüşümü, tohumlu rastgelelik, basınç çarpanı", () => {
    expect(rgba("#ff0000", 0.5)).toBe("rgba(255,0,0,0.5)");
    const a = rng(5), b = rng(5);
    expect([a(), a()]).toEqual([b(), b()]);
    expect(pressureFactor(undefined)).toBe(1);
    expect(pressureFactor(1)).toBeGreaterThan(pressureFactor(0.2));
  });
});
