import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { latexToPlain, pretty } from "./plain";
import { wrap, keyCells, LETTERS } from "./layout";
import type { BankQuestion } from "./types";

const A4: [number, number] = [595.28, 841.89];
const M = 48, QR = 52;

export type BookletOptions = {
  ogrenciAdi: string; baslik?: string; baseUrl: string; kitapId: string; tarih?: Date;
  font: Uint8Array; fontBold: Uint8Array;
};

const qrPng = async (url: string) =>
  (await QRCode.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: "M" })).split(",")[1];

class Flow {
  page!: PDFPage;
  y = 0;
  constructor(private doc: PDFDocument, private onPage: (p: PDFPage, n: number) => void) { this.newPage(); }
  newPage() { this.page = this.doc.addPage(A4); this.y = A4[1] - M; this.onPage(this.page, this.doc.getPageCount()); }
  need(h: number) { if (this.y - h < M + 20) this.newPage(); }
}

export async function buildBooklet(qs: BankQuestion[], o: BookletOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const f = await doc.embedFont(o.font, { subset: true });
  const fb = await doc.embedFont(o.fontBold, { subset: true });
  const grey = rgb(0.4, 0.4, 0.4);
  const flow = new Flow(doc, (p, n) =>
    p.drawText(`${o.kitapId} · sayfa ${n}`, { x: M, y: 24, size: 8, font: f, color: grey }));
  const w = (font: PDFFont, size: number) => (s: string) => font.widthOfTextAtSize(s, size);
  const put = (t: string, font: PDFFont, size: number, x = M, lead = size * 1.4) => {
    flow.need(lead);
    flow.page.drawText(t, { x, y: flow.y - size, size, font });
    flow.y -= lead;
  };

  // --- kapak ---
  const cover = flow.page;
  cover.drawText(o.baslik ?? "Kişisel Soru Bankası", { x: M, y: A4[1] - 200, size: 30, font: fb });
  cover.drawText(o.ogrenciAdi, { x: M, y: A4[1] - 250, size: 20, font: f });
  cover.drawText(`${qs.length} soru · ${(o.tarih ?? new Date()).toLocaleDateString("tr-TR")}`,
    { x: M, y: A4[1] - 280, size: 12, font: f, color: grey });
  cover.drawImage(await doc.embedPng(await qrPng(`${o.baseUrl}/kitapcik/${o.kitapId}`)),
    { x: M, y: 120, width: 110, height: 110 });
  cover.drawText("Yanlış yaptığın soruyu bu kodla uygulamada aç,", { x: M + 125, y: 190, size: 11, font: f });
  cover.drawText("öğretmenle birlikte yeniden çöz.", { x: M + 125, y: 174, size: 11, font: f });
  flow.newPage();

  // --- sorular ---
  const qrs = await Promise.all(qs.map(async (q) => doc.embedPng(await qrPng(`${o.baseUrl}/s/${q.hash}`))));
  const size = 11, lead = 15, textW = A4[0] - 2 * M - QR - 16;
  for (const [i, q] of qs.entries()) {
    const stem = wrap(`${i + 1}. ${pretty(q.stem)}`, textW, w(f, size));
    const opts = q.secenekler.map((s, j) => wrap(`${LETTERS[j]}) ${pretty(s)}`, textW - 14, w(f, size)));
    const h = Math.max(lead * (stem.length + opts.flat().length) + 8, QR + 8);
    flow.need(h);
    const top = flow.y;
    let y = top - size;
    for (const l of stem) { flow.page.drawText(l, { x: M, y, size, font: f }); y -= lead; }
    for (const ol of opts) for (const l of ol) { flow.page.drawText(l, { x: M + 14, y, size, font: f }); y -= lead; }
    flow.page.drawImage(qrs[i], { x: A4[0] - M - QR, y: top - QR, width: QR, height: QR });
    flow.y = Math.min(y, top - QR) - 18;
  }

  // --- cevap anahtarı ve çözümler ---
  flow.newPage();
  put("Cevap Anahtarı", fb, 18, M, 30);
  const cells = keyCells(qs);
  for (let r = 0; r * 6 < cells.length; r++) {
    flow.need(20);
    cells.slice(r * 6, r * 6 + 6).forEach((c, k) =>
      flow.page.drawText(c, { x: M + k * 84, y: flow.y - 12, size: 12, font: f }));
    flow.y -= 20;
  }
  flow.y -= 16;
  put("Çözümler", fb, 18, M, 30);
  for (const [i, q] of qs.entries()) {
    flow.need(45);
    put(`${i + 1}) Doğru şık: ${LETTERS[q.dogruIndex]} (${pretty(q.secenekler[q.dogruIndex])})`, fb, 11);
    for (const st of q.steps) {
      const plain = latexToPlain(st.latex);
      for (const l of wrap(`• ${st.note}${plain ? ": " + plain : ""}`, A4[0] - 2 * M - 12, w(f, 10)))
        put(l, f, 10, M + 12, 13);
    }
    flow.y -= 8;
  }
  return doc.save();
}
