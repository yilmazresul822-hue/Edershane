import { describe, it, expect } from "vitest";
import { checkScript, leaks, teach, parseJson, type LLM, type TeachInput } from "./index";

const ctx = { points: ["A", "B", "C"], level: 3 as const };
const valid = () => ({
  sentences: [{ id: "s1", text: "B'den AC'ye dikme indirelim." }, { id: "s2", text: "Ayak noktası dışarıda kalır." }],
  commands: [
    { id: "c1", type: "construct_altitude", speech_ref: "s1", at_ms: 500, from: "B", onto: ["A", "C"], foot_label: "H" },
    { id: "c2", type: "label_point", speech_ref: "s2", at_ms: 0, target: "H", text: "H" },
  ],
});
const withCmd = (cmd: object, sentences?: object[]) => ({ ...valid(), sentences: sentences ?? valid().sentences, commands: [cmd] });
const badPoint = { id: "x", type: "label_point", speech_ref: "s1", at_ms: 0, target: "Z", text: "Z" };

describe("checkScript", () => {
  it("geçerli betiği kabul eder; dikme ayağı sonraki komutta nokta olarak bilinir", () => {
    const r = checkScript(valid(), ctx);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.dropped).toEqual([]);
  });
  it("bilinmeyen noktayı reddeder", () => {
    const r = checkScript(withCmd(badPoint), ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toContain("Z");
  });
  it("soft modda hatalı komutu atar, betiği korur", () => {
    const r = checkScript(withCmd(badPoint), { ...ctx, soft: true });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.dropped.length).toBe(1); expect(r.script.commands.length).toBe(0); }
  });
  it("olmayan speech_ref'i reddeder", () => {
    const r = checkScript(withCmd({ ...badPoint, target: "A", speech_ref: "s9" }), ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toContain("speech_ref");
  });
  it("seviye 1'de write_latex yasak, seviye 3'te serbest", () => {
    const w = { id: "w", type: "write_latex", speech_ref: "s1", at_ms: 0, latex: "x=2", zone: "solution_column" };
    expect(checkScript(withCmd(w), { ...ctx, level: 1 }).ok).toBe(false);
    expect(checkScript(withCmd(w), ctx).ok).toBe(true);
  });
  it("seviye 2'de 3. formül reddedilir", () => {
    const w = (n: number) => ({ id: `w${n}`, type: "write_latex", speech_ref: "s1", at_ms: 0, latex: `x=${n}`, zone: "solution_column" });
    const raw = { ...valid(), commands: [w(1), w(2), w(3)] };
    expect(checkScript(raw, { ...ctx, level: 2 }).ok).toBe(false);
  });
  it("seviye < 3'te nihai cevabı söyleyen cümleyi reddeder", () => {
    const s = [{ id: "s1", text: "Sonuç x=5 çıkar." }];
    expect(checkScript({ sentences: s, commands: [] }, { ...ctx, level: 2, answer: "x=5" }).ok).toBe(false);
    expect(checkScript({ sentences: s, commands: [] }, { ...ctx, level: 3, answer: "x=5" }).ok).toBe(true);
  });
  it("sayısal cevap tam sayı eşleşmesiyle aranır; çoklu cevap desteklenir", () => {
    expect(leaks("Cevap 5 olur", "5")).toBe(true);
    expect(leaks("15 tane var", "5")).toBe(false);
    expect(leaks("Açı 90 derece", "5")).toBe(false);
    expect(leaks("Kökler 2 ve x=3", "x=2|x=3")).toBe(true);
  });
});

const input: TeachInput = { question: "Soru", points: ["A", "B", "C"], facts: [], steps: [], level: 3, history: [] };
const fake = (outs: string[]): LLM => { let i = 0; return { json: async () => outs[Math.min(i++, outs.length - 1)] }; };

describe("teach", () => {
  it("JSON bozuksa yeniden dener", async () => {
    const r = await teach(fake(["bozuk{", JSON.stringify(valid())]), input);
    expect(r.tries).toBe(2);
    expect(r.fallback).toBe(false);
  });
  it("code fence içindeki JSON'u okur", () => {
    expect(parseJson("```json\n{\"a\":1}\n```")).toEqual({ a: 1 });
  });
  it("son denemede hatalı komutu atıp devam eder", async () => {
    const out = JSON.stringify(withCmd(badPoint));
    const r = await teach(fake([out]), input);
    expect(r.tries).toBe(3);
    expect(r.fallback).toBe(false);
    expect(r.dropped.length).toBe(1);
  });
  it("hiç toparlanamazsa güvenli cümleye düşer", async () => {
    const r = await teach(fake(["{}"]), input);
    expect(r.fallback).toBe(true);
    expect(r.script.sentences.length).toBe(1);
  });
});
