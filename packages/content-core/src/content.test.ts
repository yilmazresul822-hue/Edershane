import { describe, it, expect } from "vitest";
import type { LLM } from "@edershane/teacher-core";
import {
  parseTranscript, chunkCues, overlapRatio, longestCommonRun, validateKavram, kavramToText, extractNotes,
} from "./index";

describe("transkript", () => {
  it("üç zaman biçimini okur, damgasız satırı öncekine ekler", () => {
    const raw = "[00:01:05] Merhaba arkadaşlar\ndevam eder\n02:10 ikinci satır\n1:00:00 üçüncü";
    expect(parseTranscript(raw)).toEqual([
      { sn: 65, text: "Merhaba arkadaşlar devam eder" },
      { sn: 130, text: "ikinci satır" },
      { sn: 3600, text: "üçüncü" },
    ]);
  });
  it("karakter ve süre sınırına göre böler", () => {
    const cues = [{ sn: 0, text: "a".repeat(10) }, { sn: 10, text: "b".repeat(10) }, { sn: 20, text: "c".repeat(10) }];
    const c = chunkCues(cues, 25);
    expect(c.length).toBe(2);
    expect(c[0].bitisSn).toBe(10);
    expect(c[1].baslangicSn).toBe(20);
    expect(chunkCues([{ sn: 0, text: "x" }, { sn: 100, text: "y" }], 1800, 60).length).toBe(2);
  });
  it("çok uzun satırı cümle sınırlarından bölerek sığdırır", () => {
    const c = chunkCues([{ sn: 0, text: "abc. ".repeat(1000) }], 1800);
    expect(c.length).toBeGreaterThan(1);
    expect(c.every((x) => x.text.length <= 1800)).toBe(true);
  });
});

describe("benzerlik", () => {
  it("kopyayı yakalar, ilgisiz metni yakalamaz", () => {
    expect(overlapRatio("a b c d e f", "a b c d e f g")).toBe(1);
    expect(overlapRatio("x y z w", "a b c d")).toBe(0);
    expect(longestCommonRun("bir iki üç dört beş", "sıfır bir iki üç yedi")).toBe(3);
  });
});

describe("not doğrulama", () => {
  const ok = { baslik: "Başlık", ozet: "Yeterince uzun bir özet metni." };
  it("eksik alanları boş dizi yapar, bozukları reddeder", () => {
    const r = validateKavram(ok);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.note.adimlar).toEqual([]);
    expect(validateKavram({ ...ok, ozet: "kısa" }).ok).toBe(false);
    expect(validateKavram({ ...ok, adimlar: Array(9).fill("adım metni") }).ok).toBe(false);
    expect(validateKavram({ ...ok, kazanim_id: "1" }).ok).toBe(false);
  });
  it("metin biçimi", () => {
    const r = validateKavram({ ...ok, adimlar: ["bir şey", "başka şey"] });
    if (r.ok) expect(kavramToText(r.note)).toContain("1) bir şey 2) başka şey");
  });
});

const SRC = "Arkadaşlar birinci dereceden denklemde bilinmeyeni yalnız bırakmak için önce sabit terimi karşı tarafa atarız sonra katsayıya böleriz ve kökü buluruz";
const chunk = { baslangicSn: 0, bitisSn: 30, text: SRC };
const copy = { notlar: [{ baslik: "Birinci derece denklem", ozet: "Birinci dereceden denklemde bilinmeyeni yalnız bırakmak için önce sabit terimi karşı tarafa atarız sonra katsayıya böleriz" }] };
const good = { notlar: [{
  baslik: "Birinci derece denklem",
  ozet: "ax+b=c biçimindeki denklemde x'i bulmak için önce b karşıya geçirilir, ardından a'ya bölünür.",
  adimlar: ["Sabiti diğer tarafa işaret değiştirerek taşı", "Katsayıya böl"],
  tuzaklar: ["Taşırken işareti değiştirmeyi unutmak"], ornek_tipleri: ["Tek bilinmeyenli basit denklem"],
}] };
const fake = (outs: unknown[]): LLM => { let i = 0; return { json: async () => JSON.stringify(outs[Math.min(i++, outs.length - 1)]) }; };

describe("not çıkarma", () => {
  it("kopya notu reddeder, yeniden yazılanı kabul eder", async () => {
    const r = await extractNotes(fake([copy, good]), chunk, [{ id: 1, kazanim: "x" }]);
    expect(r.taslaklar.length).toBe(1);
    expect(r.taslaklar[0].ozet).toContain("ax+b=c");
    expect(r.uyarilar).toEqual([]);
  });
  it("hep kopya gelirse not üretmez, uyarı verir", async () => {
    const r = await extractNotes(fake([copy]), chunk, []);
    expect(r.taslaklar).toEqual([]);
    expect(r.uyarilar.length).toBe(1);
  });
  it("konu yoksa boş döner; listede olmayan kazanım id'si null olur", async () => {
    expect((await extractNotes(fake([{ notlar: [] }]), chunk, [])).taslaklar).toEqual([]);
    const withK = { notlar: [{ ...good.notlar[0], kazanim_id: 99 }] };
    expect((await extractNotes(fake([withK]), chunk, [{ id: 1, kazanim: "x" }])).taslaklar[0].kazanim_id).toBeNull();
  });
});
