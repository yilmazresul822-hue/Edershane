import { describe, it, expect } from "vitest";
import { validateSpec, structureQuestion, kazanimFor, type LLM } from "./index";

const base = { ozet: "2x+3=7 denklemi", soru_metni: "2x+3=7 ise x kaçtır?" };
const fake = (outs: unknown[]) => { let n = 0; const llm: LLM = { json: async () => JSON.stringify(outs[Math.min(n++, outs.length - 1)]) }; return { llm, calls: () => n }; };

describe("validateSpec", () => {
  it("denklemi kabul eder, çift '=' ve kod benzeri girdiyi reddeder", () => {
    expect(validateSpec({ kind: "equation", eq: "2*x+3=7", ...base }).ok).toBe(true);
    expect(validateSpec({ kind: "equation", eq: "x=1=2", ...base }).ok).toBe(false);
    expect(validateSpec({ kind: "equation", eq: "__import__('os')=1", ...base }).ok).toBe(false);
  });
  it("unsupported neden ile döner", () => {
    const r = validateSpec({ kind: "unsupported", neden: "Çember soruları henüz yok" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.unsupported).toContain("Çember");
  });
  it("integral: sınırlar birlikte olmalı; negatif sınır serbest", () => {
    expect(validateSpec({ kind: "integral", expr: "2*x", a: "0", ...base }).ok).toBe(false);
    expect(validateSpec({ kind: "integral", expr: "2*x", a: -1, b: 2, ...base }).ok).toBe(true);
  });
  it("üçgen: sayılar metne çevrilir, varsayılanlar gelir", () => {
    const r = validateSpec({ kind: "triangle", a: 3, b: 4, c: 5, ...base });
    expect(r.ok).toBe(true);
    if (r.ok && r.spec.kind === "triangle") { expect(r.spec.a).toBe("3"); expect(r.spec.ask).toBe("angles"); expect(r.spec.vertex).toBe("B"); }
    expect(validateSpec({ kind: "triangle", a: -3, b: 4, c: 5, ...base }).ok).toBe(false);
  });
  it("özet eksikse reddeder", () => {
    expect(validateSpec({ kind: "equation", eq: "x=1", soru_metni: "x kaçtır?" }).ok).toBe(false);
  });
});

describe("structureQuestion", () => {
  it("bozuk cevapta bir kez yeniden dener", async () => {
    const f = fake([{ kind: "equation" }, { kind: "equation", eq: "x+1=2", ...base }]);
    expect((await structureQuestion(f.llm, { text: "x+1=2" })).ok).toBe(true);
    expect(f.calls()).toBe(2);
  });
  it("unsupported'ta yeniden denemez", async () => {
    const f = fake([{ kind: "unsupported", neden: "Çember soruları henüz yok" }]);
    const r = await structureQuestion(f.llm, { text: "çember" });
    expect(r.ok).toBe(false);
    expect(f.calls()).toBe(1);
  });
});

describe("kazanımFor", () => {
  it("türe göre eşler", () => {
    expect(kazanimFor({ kind: "equation", eq: "x=1" }, ["Denklemin derecesi 1"])).toBe(1);
    expect(kazanimFor({ kind: "equation", eq: "x=1" }, ["Denklemin derecesi 2"])).toBe(2);
    expect(kazanimFor({ kind: "integral", expr: "x" }, [])).toBe(5);
  });
});
