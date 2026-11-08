import { describe, it, expect } from "vitest";
import { eloUpdate, eloScore, schedule, intervalFor, gradeOf, classifyError, W } from "./index";

describe("Elo", () => {
  it("eşit puanlarda doğru cevap +20, yanlış -20 (K=40)", () => {
    expect(eloUpdate(1000, 1000, 1, 0).student).toBeCloseTo(1020, 6);
    expect(eloUpdate(1000, 1000, 0, 0).student).toBeCloseTo(980, 6);
    expect(eloUpdate(1000, 1000, 1, 0).question).toBeCloseTo(996, 6);
  });
  it("ipucu kullanan doğru, tam puandan az alır", () => {
    expect(eloScore(true, 2)).toBeLessThan(eloScore(true, 0));
    expect(eloScore(false, 0)).toBe(0);
  });
});

describe("FSRS", () => {
  const t0 = 0, DAY = 86_400_000;
  it("ilk 'iyi' not: kararlılık w[2], aralık ≈ kararlılık (%90 tutma)", () => {
    const c = schedule(null, 3, t0);
    expect(c.s).toBeCloseTo(W[2], 6);
    expect(intervalFor(c.s)).toBeCloseTo(c.s, 3);
  });
  it("zamanında doğru tekrar kararlılığı artırır, unutma azaltır", () => {
    const c = schedule(null, 3, t0);
    const up = schedule(c, 3, t0 + c.s * DAY);
    const down = schedule(c, 1, t0 + c.s * DAY);
    expect(up.s).toBeGreaterThan(c.s);
    expect(down.s).toBeLessThan(c.s);
  });
  it("kolay > iyi > zor", () => {
    const c = schedule(null, 3, t0), at = t0 + c.s * DAY;
    expect(schedule(c, 4, at).s).toBeGreaterThan(schedule(c, 3, at).s);
    expect(schedule(c, 3, at).s).toBeGreaterThan(schedule(c, 2, at).s);
  });
  it("not eşlemesi", () => {
    expect(gradeOf(false, 0, 1)).toBe(1);
    expect(gradeOf(true, 3, 1)).toBe(1);
    expect(gradeOf(true, 0, 0.5)).toBe(4);
    expect(gradeOf(true, 1, 1)).toBe(3);
  });
});

describe("hata sınıflandırma", () => {
  it("tuzak, işaret, rakam yer değiştirme, basamak kayması", () => {
    expect(classifyError({ given: "3", correct: "5", tuzaklar: [{ cevap: "3", ad: "apsis-ordinat" }] }).neden).toContain("apsis-ordinat");
    expect(classifyError({ given: "-5", correct: "5" }).tip).toBe("dikkat");
    expect(classifyError({ given: "36", correct: "63" }).neden).toContain("yer değiştirmiş");
    expect(classifyError({ given: "50", correct: "5" }).neden).toContain("basamak");
    expect(classifyError({ given: "6", correct: "5" }).tip).toBe("islem");
  });
  it("boş ve yavaşsa süre, hızlıysa kavram", () => {
    expect(classifyError({ correct: "5", sureSn: 200, beklenenSn: 90 }).tip).toBe("sure");
    expect(classifyError({ correct: "5", sureSn: 10, beklenenSn: 90 }).tip).toBe("kavram");
  });
  it("tanınmayan yanlış düşük güvenli kavram sayılır", () => {
    const r = classifyError({ given: "7", correct: "20" });
    expect(r.tip).toBe("kavram");
    expect(r.guven).toBe("dusuk");
  });
});
