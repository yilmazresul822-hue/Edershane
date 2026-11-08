import { describe, it, expect } from "vitest";
import { LessonMachine, matchKazanim, pickTest, lessonTurn, type KazanimRow, type LLM } from "./index";

describe("LessonMachine", () => {
  it("2 yoklama cevabından sonra anlatıma geçer, anlatmadan teste geçilmez", () => {
    const m = new LessonMachine();
    expect(m.student("kökleri buluyoruz galiba")).toBe("yoklama");
    expect(m.student("evet")).toBe("anlatim");
    expect(m.anladim()).toBe(false);
    m.teacher();
    expect(m.canTest).toBe(true);
    expect(m.anladim()).toBe(true);
    expect(m.faz).toBe("test");
  });
  it("öğrenci isterse yoklama atlanır; tekrar anlatım sayacı sıfırlar", () => {
    const m = new LessonMachine();
    expect(m.student("Direkt anlat lütfen")).toBe("anlatim");
    m.teacher(); m.anladim(); m.testBitti();
    m.tekrarAnlat();
    expect(m.faz).toBe("anlatim");
    expect(m.canTest).toBe(false);
  });
});

const K: KazanimRow[] = [
  { id: 1, sinav: "TYT", ders: "Matematik", konu: "Denklemler", alt_konu: "Birinci dereceden denklemler", kazanim: "Bir bilinmeyenli birinci dereceden denklemi çözer" },
  { id: 2, sinav: "TYT", ders: "Matematik", konu: "Denklemler", alt_konu: "İkinci dereceden denklemler", kazanim: "İkinci dereceden denklemin köklerini bulur" },
  { id: 3, sinav: "AYT", ders: "Matematik", konu: "Türev", alt_konu: "Türev alma", kazanim: "Polinom fonksiyonun bir noktadaki türevini bulur" },
];

describe("konu eşleme ve test seçimi", () => {
  it("ekli yazılan konuyu bulur, alakasızı boş döner", () => {
    expect(matchKazanim("ikinci dereceden denklem", K)[0].id).toBe(2);
    expect(matchKazanim("türevi", K)[0].id).toBe(3);
    expect(matchKazanim("futbol", K)).toEqual([]);
  });
  it("Elo'ya yakın zorluktaki görülmemiş soruları seçer", () => {
    const rows = [{ id: "a", zorluk: 0.1 }, { id: "b", zorluk: 0.3 }, { id: "c", zorluk: 0.35 }, { id: "d", zorluk: 0.9 }];
    expect(pickTest(rows, new Set(), 1000, 2).map((r) => r.id)).toEqual(["c", "b"]);
    expect(pickTest(rows, new Set(["b"]), 1000, 2).map((r) => r.id)).toEqual(["c", "a"]);
    expect(pickTest(rows, new Set(["a", "b", "c"]), 1000, 3).length).toBe(3);
  });
});

const fake = (outs: unknown[]): LLM => { let i = 0; return { json: async () => JSON.stringify(outs[Math.min(i++, outs.length - 1)]) }; };
const sc = (commands: object[]) => ({ sentences: [{ id: "s1", text: "Hazır mısın?" }], commands });
const w = { id: "c1", type: "write_latex", speech_ref: "s1", at_ms: 0, latex: "x^{2}=4", zone: "solution_column" };
const base = { konu: "İkinci derece", history: [], notes: [] };

describe("lessonTurn", () => {
  it("yoklamada write_latex'i son denemede atar", async () => {
    const r = await lessonTurn(fake([sc([w])]), { ...base, faz: "yoklama" });
    expect(r.fallback).toBe(false);
    expect(r.script.commands.length).toBe(0);
  });
  it("anlatımda write_latex kabul edilir", async () => {
    const r = await lessonTurn(fake([sc([w])]), { ...base, faz: "anlatim" });
    expect(r.script.commands.length).toBe(1);
  });
  it("hiç toparlanamazsa güvenli cümleye düşer", async () => {
    const r = await lessonTurn(fake(["{}"]), { ...base, faz: "anlatim" });
    expect(r.fallback).toBe(true);
  });
});
