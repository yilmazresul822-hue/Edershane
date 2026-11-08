import { describe, it, expect } from "vitest";
import { altitude, angleDeg, bisectorFoot, placeLabel, fitToBounds } from "./index";

describe("dikme", () => {
  it("geniş açılı üçgende ayak kenarın dışına düşer", () => {
    const A = { x: 0, y: 0 }, C = { x: 4, y: 0 }, B = { x: -2, y: 3 };
    const r = altitude(B, A, C);
    expect(r.outside).toBe(true);
    expect(r.extension).not.toBeNull();
    expect(angleDeg(r.foot, B, C)).toBeCloseTo(90, 6);
  });
  it("dik üçgende ayak kenarın içinde", () => {
    const r = altitude({ x: 1, y: 2 }, { x: 0, y: 0 }, { x: 4, y: 0 });
    expect(r.outside).toBe(false);
    expect(r.extension).toBeNull();
  });
});

describe("açıortay", () => {
  it("dik açıyı 45/45 böler", () => {
    const A = { x: 0, y: 0 }, B = { x: 4, y: 0 }, C = { x: 0, y: 3 };
    const D = bisectorFoot(A, B, C);
    expect(angleDeg(A, B, D)).toBeCloseTo(45, 6);
  });
});

describe("etiket yerleşimi", () => {
  it("çizgiyle çakışmayan konum bulur", () => {
    const res = placeLabel(
      { x: 100, y: 100 }, { w: 30, h: 18 },
      { segments: [[{ x: 0, y: 100 }, { x: 200, y: 100 }]], boxes: [],
        bounds: { x: 0, y: 0, w: 400, h: 400 } }
    );
    expect(res.ok).toBe(true);
  });
});

describe("fitToBounds", () => {
  it("açıyı korur ve sınırlar içinde kalır", () => {
    const P = { A: { x: 0, y: 0 }, B: { x: 5, y: 0 }, C: { x: -1.5, y: 2.598 } };
    const b = { x: 0, y: 0, w: 640, h: 700 };
    const F = fitToBounds(P, b, 60);
    expect(angleDeg(F.A, F.B, F.C)).toBeCloseTo(angleDeg(P.A, P.B, P.C), 3);
    for (const p of Object.values(F)) {
      expect(p.x).toBeGreaterThanOrEqual(60 - 1e-6); expect(p.x).toBeLessThanOrEqual(580 + 1e-6);
      expect(p.y).toBeGreaterThanOrEqual(60 - 1e-6); expect(p.y).toBeLessThanOrEqual(640 + 1e-6);
    }
    expect(F.C.y).toBeLessThan(F.A.y);
  });
});
