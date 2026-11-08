import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { wrap, keyCells, pretty, latexToPlain, pickQuestions, buildBooklet, type BankQuestion } from "./index";

const m = (s: string) => s.length * 6;

describe("metin", () => {
  it("satır sarar, uzun kelimeyi bölmez", () => {
    expect(wrap("aaa bbb ccc", 40, m)).toEqual(["aaa", "bbb", "ccc"]);
    expect(wrap("aaa bbb", 100, m)).toEqual(["aaa bbb"]);
    expect(wrap("uzunuzunuzun", 10, m)).toEqual(["uzunuzunuzun"]);
  });
  it("üs ve kök yazımı", () => {
    expect(pretty("x^2+3*x")).toBe("x²+3·x");
    expect(pretty("x^{10}")).toBe("x¹⁰");
    expect(pretty("5*sqrt(3)/2")).toBe("5·√(3)/2");
    expect(latexToPlain("\\frac{x^{2}}{2}+\\sqrt{3}")).toBe("(x²)/(2)+√(3)");
  });
  it("cevap anahtarı hücreleri", () => {
    expect(keyCells([{ dogruIndex: 2 }, { dogruIndex: 0 }])).toEqual(["1-C", "2-A"]);
  });
});

const pool = (k: number, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${k}-${i}`, kazanim_id: k }));

describe("soru seçimi", () => {
  it("yanlışı çok olana daha çok soru verir, görülenleri atlar", () => {
    const seen = new Set(["1-0", "1-1"]);
    const r = pickQuestions({ 1: 6, 2: 2 }, { 1: pool(1, 20), 2: pool(2, 20) }, seen, 8, 8);
    expect(r.length).toBe(8);
    expect(r.some((q) => seen.has(q.id))).toBe(false);
    expect(r.filter((q) => q.kazanim_id === 1).length).toBe(6);
  });
  it("havuz azsa kalan yeri doldurur, kazanım başına sınırı aşmaz", () => {
    const r = pickQuestions({ 1: 5, 2: 5 }, { 1: pool(1, 20), 2: pool(2, 1) }, new Set(), 10, 8);
    expect(r.length).toBe(9);
    expect(r.filter((q) => q.kazanim_id === 1).length).toBe(8);
  });
});

let fonts: { f: Uint8Array; b: Uint8Array } | null = null;
try {
  const dir = createRequire(import.meta.url).resolve("dejavu-fonts-ttf/package.json").replace("package.json", "ttf/");
  fonts = { f: readFileSync(dir + "DejaVuSans.ttf"), b: readFileSync(dir + "DejaVuSans-Bold.ttf") };
} catch { fonts = null; }

describe.skipIf(!fonts)("PDF", () => {
  it("kapak + sorular + cevap anahtarı üretir", async () => {
    const q = (i: number): BankQuestion => ({
      id: `q${i}`, hash: `h${i}`.padEnd(32, "0"), zorluk: 0.3,
      stem: `2x + 3 = 7 denkleminde x kaçtır? (ğüşıöç İ) ${"uzun ".repeat(30)}`,
      secenekler: ["1", "2", "3", "4", "5"], dogruIndex: i % 5,
      steps: [{ latex: "\\frac{x^{2}}{2}", note: "Adım" }],
    });
    const bytes = await buildBooklet([1, 2, 3].map(q), {
      ogrenciAdi: "Ayşe Yılmaz", baseUrl: "https://edershane.pages.dev", kitapId: "abc12345",
      font: fonts!.f, fontBold: fonts!.b,
    });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThanOrEqual(3);
  });
});
