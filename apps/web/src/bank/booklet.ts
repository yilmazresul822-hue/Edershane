import { buildBooklet, pickQuestions, type BankQuestion, type PoolQ } from "@edershane/bank-pdf";
import fontUrl from "dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url";
import fontBoldUrl from "dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf?url";

export type BookletCfg = {
  supabaseUrl: string; anonKey: string; getToken: () => Promise<string>;
  baseUrl: string; ogrenciAdi: string;
};
type Row = { id: string; hash: string; kazanim_id: number; zorluk: number; govde: any; cevap: any; cozum: any };

const bytes = async (u: string) => new Uint8Array(await (await fetch(u)).arrayBuffer());

/** Yanlış defterindeki kazanımlardan, görülmemiş özgün sorularla kişisel PDF üretir. */
export async function makeBooklet(c: BookletCfg, max = 30): Promise<Blob> {
  const H = { authorization: `Bearer ${await c.getToken()}`, apikey: c.anonKey };
  const get = async <T,>(p: string): Promise<T> => {
    const r = await fetch(`${c.supabaseUrl}/rest/v1/${p}`, { headers: H });
    if (!r.ok) throw new Error(`Veri okunamadı (${r.status})`);
    return r.json();
  };

  const wrong = await get<{ kazanim_id: number }[]>("yanlis_defteri?cozuldu=eq.false&select=kazanim_id&order=zaman.desc&limit=200");
  const mistakes: Record<number, number> = {};
  for (const w of wrong) mistakes[w.kazanim_id] = (mistakes[w.kazanim_id] ?? 0) + 1;

  const seenRows = await get<{ soru_id: string }[]>("deneme?soru_id=not.is.null&select=soru_id&limit=2000");
  const seen = new Set(seenRows.map((r) => r.soru_id));

  const rows = new Map<string, Row>();
  const pool: Record<number, PoolQ[]> = {};
  await Promise.all(Object.keys(mistakes).map(async (k) => {
    const rs = await get<Row[]>(`uretilen_soru?kazanim_id=eq.${k}&dogrulandi=eq.true&select=id,hash,kazanim_id,zorluk,govde,cevap,cozum&order=zorluk.asc&limit=60`);
    rs.forEach((r) => rows.set(r.id, r));
    pool[Number(k)] = rs.map((r) => ({ id: r.id, kazanim_id: r.kazanim_id }));
  }));

  const picked = pickQuestions(mistakes, pool, seen, max);
  if (!picked.length) throw new Error("Yanlış defterinde çözülmemiş soru yok ya da havuzda yeni soru kalmadı.");

  const qs: BankQuestion[] = picked.map((p) => {
    const r = rows.get(p.id)!;
    return { id: r.id, hash: r.hash, zorluk: r.zorluk, stem: r.govde.stem, secenekler: r.govde.secenekler,
      dogruIndex: r.cevap.dogru_index, steps: r.cozum.steps };
  });
  const [font, fontBold] = await Promise.all([bytes(fontUrl), bytes(fontBoldUrl)]);
  const pdf = await buildBooklet(qs, {
    ogrenciAdi: c.ogrenciAdi, baseUrl: c.baseUrl, kitapId: crypto.randomUUID().slice(0, 8), font, fontBold,
  });
  return new Blob([pdf as BlobPart], { type: "application/pdf" });
}

export function download(blob: Blob, name = "soru-bankasi.pdf") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
