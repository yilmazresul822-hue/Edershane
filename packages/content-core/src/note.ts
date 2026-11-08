export type Kavram = {
  baslik: string; ozet: string;
  adimlar: string[]; tuzaklar: string[]; ornek_tipleri: string[];
  kazanim_id?: number | null;
};
export type NoteResult = { ok: true; note: Kavram } | { ok: false; error: string };

const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();

function strList(v: unknown, maxN: number, minL: number, maxL: number, name: string): string[] | string {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > maxN) return `${name}: en fazla ${maxN} elemanlı dizi olmalı`;
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string") return `${name}: maddeler metin olmalı`;
    const t = clean(x);
    if (t.length < minL || t.length > maxL) return `${name}: her madde ${minL}-${maxL} karakter olmalı`;
    out.push(t);
  }
  return out;
}

export function validateKavram(raw: unknown): NoteResult {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "Not nesne değil" };
  const r = raw as Record<string, unknown>;
  const baslik = typeof r.baslik === "string" ? clean(r.baslik) : "";
  const ozet = typeof r.ozet === "string" ? clean(r.ozet) : "";
  if (baslik.length < 3 || baslik.length > 80) return { ok: false, error: "baslik 3-80 karakter olmalı" };
  if (ozet.length < 10 || ozet.length > 400) return { ok: false, error: `${baslik}: ozet 10-400 karakter olmalı` };
  const adimlar = strList(r.adimlar, 8, 3, 220, "adimlar");
  if (typeof adimlar === "string") return { ok: false, error: `${baslik}: ${adimlar}` };
  const tuzaklar = strList(r.tuzaklar, 5, 3, 220, "tuzaklar");
  if (typeof tuzaklar === "string") return { ok: false, error: `${baslik}: ${tuzaklar}` };
  const ornek = strList(r.ornek_tipleri, 5, 3, 160, "ornek_tipleri");
  if (typeof ornek === "string") return { ok: false, error: `${baslik}: ${ornek}` };
  const k = r.kazanim_id;
  if (k !== undefined && k !== null && !(Number.isInteger(k) && (k as number) >= 1))
    return { ok: false, error: `${baslik}: kazanim_id geçersiz` };
  return { ok: true, note: { baslik, ozet, adimlar, tuzaklar, ornek_tipleri: ornek, kazanim_id: (k as number | null | undefined) ?? null } };
}

/** Hem öğretmenin göreceği metin hem embedding girdisi. */
export function kavramToText(n: Kavram): string {
  const p = [n.baslik, `Özet: ${n.ozet}`];
  if (n.adimlar.length) p.push("Yöntem: " + n.adimlar.map((a, i) => `${i + 1}) ${a}`).join(" "));
  if (n.tuzaklar.length) p.push("Tuzaklar: " + n.tuzaklar.join("; "));
  if (n.ornek_tipleri.length) p.push("Örnek tipleri: " + n.ornek_tipleri.join("; "));
  return p.join("\n");
}
