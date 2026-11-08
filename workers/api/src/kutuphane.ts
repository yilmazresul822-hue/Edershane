import { chunkCues, parseTranscript, extractNotes, validateKavram, kavramToText, mmss, type Taslak } from "@edershane/content-core";
import type { LLM } from "@edershane/teacher-core";
import { embed } from "./embed";
import type { Env } from "./index";

type User = { uid: string; token: string };
type Out = (d: unknown, s?: number) => Response;
const PER = 6;        // istek başına parça (Worker alt istek sınırı için)
const MIN_SIM = 0.5;  // ölçülmedi: beta'da logdaki değerlere bakarak ayarlanacak
const IZIN = ["kendi", "izinli", "kamu", "belirsiz"];
const isStr = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max;

export const rest = (env: Env, token: string, path: string, init: RequestInit = {}) =>
  fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY, "content-type": "application/json",
      ...((init.headers as Record<string, string>) ?? {}) },
  });

export async function isAdmin(token: string, env: Env) {
  const r = await rest(env, token, "rpc/is_admin", { method: "POST", body: "{}" });
  return r.ok && (await r.json()) === true;
}

/** Transkripti parçalayıp kavram notu TASLAKLARI üretir. Hiçbir şey kaydetmez. */
export async function handleNotCikar(body: any, user: User, llm: LLM, env: Env, out: Out) {
  if (typeof body?.transcript !== "string" || body.transcript.length < 50 || body.transcript.length > 80_000)
    return out({ hata: "transcript 50-80.000 karakter olmalı" }, 400);
  const bas = Number.isInteger(body.parca_bas) && body.parca_bas >= 0 ? body.parca_bas : 0;
  const chunks = chunkCues(parseTranscript(body.transcript));
  if (!chunks.length) return out({ hata: "transkript okunamadı" }, 400);

  const kz = await rest(env, user.token, "kazanim?select=id,kazanim&order=id.asc&limit=300");
  if (!kz.ok) return out({ hata: "kazanımlar okunamadı" }, 502);
  const kazanimlar = (await kz.json()) as { id: number; kazanim: string }[];

  const taslaklar: Taslak[] = [];
  const uyarilar: string[] = [];
  for (const c of chunks.slice(bas, bas + PER)) {
    try {
      const r = await extractNotes(llm, c, kazanimlar);
      taslaklar.push(...r.taslaklar);
      uyarilar.push(...r.uyarilar);
    } catch (e) { console.error(e); uyarilar.push(`Parça ${mmss(c.baslangicSn)}: model hatası`); }
  }
  return out({ toplam_parca: chunks.length, sonraki: bas + PER < chunks.length ? bas + PER : null, taslaklar, uyarilar });
}

/** Onaylanan notları embedding ile kaydeder. Hata olursa hiçbir şey kalmaz. */
export async function handleNotKaydet(body: any, user: User, env: Env, out: Out) {
  const k = body?.kaynak;
  if (!isStr(k?.baslik, 200) || !isStr(k?.tur, 30) || !isStr(k?.sahip, 100) || !IZIN.includes(k?.izin_durumu))
    return out({ hata: "kaynak geçersiz (izin_durumu: kendi | izinli | kamu | belirsiz)" }, 400);
  if (!Array.isArray(body.notlar) || body.notlar.length < 1 || body.notlar.length > 20)
    return out({ hata: "notlar 1-20 elemanlı dizi olmalı" }, 400);

  const rows: { n: any; icerik: string; bas: number | null; bit: number | null; sim: number | null }[] = [];
  for (const raw of body.notlar) {
    const v = validateKavram(raw);
    if (!v.ok) return out({ hata: v.error }, 400);
    rows.push({ n: v.note, icerik: kavramToText(v.note),
      bas: Number.isInteger(raw.baslangicSn) ? raw.baslangicSn : null,
      bit: Number.isInteger(raw.bitisSn) ? raw.bitisSn : null,
      sim: typeof raw.benzerlik === "number" ? raw.benzerlik : null });
  }

  const vecs: number[][] = [];
  try { for (const r of rows) vecs.push(await embed(env.GEMINI_API_KEY, env.EMBED_MODEL, r.icerik, "RETRIEVAL_DOCUMENT")); }
  catch (e) { console.error(e); return out({ hata: "embedding üretilemedi, hiçbir şey kaydedilmedi" }, 502); }

  const ks = await rest(env, user.token, "kaynak", { method: "POST", headers: { prefer: "return=representation" },
    body: JSON.stringify({ tur: k.tur, baslik: k.baslik, sahip: k.sahip, izin_durumu: k.izin_durumu }) });
  if (!ks.ok) return out({ hata: "kaynak kaydedilemedi" }, 502);
  const kid = ((await ks.json()) as { id: number }[])[0]?.id;

  const ins = await rest(env, user.token, "kavram_notu", { method: "POST", headers: { prefer: "return=minimal" },
    body: JSON.stringify(rows.map((r, i) => ({
      kaynak_id: kid, kazanim_id: r.n.kazanim_id ?? null, baslik: r.n.baslik, icerik: r.icerik, embedding: vecs[i],
      kaynak_bas_sn: r.bas, kaynak_bit_sn: r.bit, benzerlik: r.sim, onayli: true,
    }))) });
  if (!ins.ok) {
    await rest(env, user.token, `kaynak?id=eq.${kid}`, { method: "DELETE" });
    return out({ hata: "notlar kaydedilemedi, kaynak geri alındı" }, 502);
  }
  return out({ kaynak_id: kid, kaydedilen: rows.length });
}

/** Öğretmen için: soruya en yakın onaylı notların metni. Hata olursa notsuz devam edilir. */
export async function getNotes(query: string, token: string, env: Env, kz: number | null = null): Promise<string[]> {
  try {
    const q = await embed(env.GEMINI_API_KEY, env.EMBED_MODEL, query.slice(0, 1000), "RETRIEVAL_QUERY");
    const call = async (k: number | null) => {
      const r = await rest(env, token, "rpc/not_ara", { method: "POST", body: JSON.stringify({ q, kz: k, n: 3 }) });
      return r.ok ? ((await r.json()) as { icerik: string; benzerlik: number }[]) : [];
    };
    let rows = kz !== null ? await call(kz) : [];
    if (!rows.length) rows = await call(null); // kazanımı etiketlenmemiş notlar için
    console.info("not_ara en iyi benzerlik:", rows[0]?.benzerlik ?? "yok");
    return rows.filter((x) => x.benzerlik >= MIN_SIM).map((x) => x.icerik);
  } catch (e) { console.error(e); return []; }
}
