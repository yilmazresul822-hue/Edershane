import { classifyError, eloScore, eloUpdate, gradeOf, schedule } from "@edershane/student-model";
import type { Env } from "./index";

type User = { uid: string; token: string };
const UUID = /^[0-9a-f-]{36}$/i;
const isInt = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
const isStr = (v: unknown, max: number) => typeof v === "string" && v.length <= max;

export async function handleDeneme(body: any, user: User, env: Env, out: (d: unknown, s?: number) => Response) {
  if (typeof body !== "object" || !body) return out({ hata: "gövde yok" }, 400);
  if (!isInt(body.kazanim_id, 1, 1e9) || typeof body.dogru !== "boolean" || !isInt(body.sure_sn, 0, 7200) || !isInt(body.ipucu ?? 0, 0, 3))
    return out({ hata: "alanlar geçersiz" }, 400);
  if (body.verilen_cevap !== undefined && !isStr(body.verilen_cevap, 100)) return out({ hata: "verilen_cevap geçersiz" }, 400);
  if (body.dogru_cevap !== undefined && !isStr(body.dogru_cevap, 100)) return out({ hata: "dogru_cevap geçersiz" }, 400);
  const tuzaklar = Array.isArray(body.tuzaklar) ? body.tuzaklar.slice(0, 10).filter((t: any) => isStr(t?.cevap, 100) && isStr(t?.ad, 100)) : [];
  const soruElo = typeof body.soru_elo === "number" && body.soru_elo >= 0 && body.soru_elo <= 3000 ? body.soru_elo : 1000;
  const beklenen = isInt(body.beklenen_sn, 1, 7200) ? body.beklenen_sn : 90;
  const ipucu = (body.ipucu ?? 0) as number;
  const soruId = typeof body.soru_id === "string" && UUID.test(body.soru_id) ? body.soru_id : null;
  const soruMetni = isStr(body.soru_metni, 1000) ? body.soru_metni : null;
  const soruSpec = body.soru_spec && typeof body.soru_spec === "object" && JSON.stringify(body.soru_spec).length <= 1500 ? body.soru_spec : null;

  const H = { authorization: `Bearer ${user.token}`, apikey: env.SUPABASE_ANON_KEY, "content-type": "application/json" };
  const rest = (p: string, init: RequestInit = {}) => fetch(`${env.SUPABASE_URL}/rest/v1/${p}`, { ...init, headers: { ...H, ...(init.headers as any) } });

  const g = await rest(`ustalik?ogrenci_id=eq.${user.uid}&kazanim_id=eq.${body.kazanim_id}&select=*`);
  if (!g.ok) return out({ hata: "veri okunamadı" }, 502);
  const row = ((await g.json()) as any[])[0];

  const now = Date.now();
  const n = row?.deneme_sayisi ?? 0;
  const elo = eloUpdate(row?.elo ?? 1000, soruElo, eloScore(body.dogru, ipucu), n).student;
  const grade = gradeOf(body.dogru, ipucu, body.sure_sn / beklenen);
  const prev = row?.stabilite && row?.zorluk && row?.son_tekrar
    ? { s: row.stabilite as number, d: row.zorluk as number, lastMs: Date.parse(row.son_tekrar) } : null;
  const next = schedule(prev, grade, now);

  const hata = body.dogru ? null
    : classifyError({ given: body.verilen_cevap, correct: body.dogru_cevap ?? "", sureSn: body.sure_sn, beklenenSn: beklenen, tuzaklar });

  const up = await rest("ustalik?on_conflict=ogrenci_id,kazanim_id", {
    method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ ogrenci_id: user.uid, kazanim_id: body.kazanim_id, elo, stabilite: next.s, zorluk: next.d,
      son_tekrar: new Date(now).toISOString(), sonraki_tekrar: new Date(next.dueMs).toISOString(), deneme_sayisi: n + 1 }),
  });
  if (!up.ok) return out({ hata: "ustalık kaydedilemedi" }, 502);
  await rest("deneme", { method: "POST", headers: { prefer: "return=minimal" },
    body: JSON.stringify({ ogrenci_id: user.uid, kazanim_id: body.kazanim_id, soru_id: soruId, dogru: body.dogru, sure_sn: body.sure_sn, hata_tipi: hata?.tip ?? null }) });
  if (hata && !body.tekrar)
    await rest("yanlis_defteri", { method: "POST", headers: { prefer: "return=minimal" },
      body: JSON.stringify({ ogrenci_id: user.uid, kazanim_id: body.kazanim_id, soru_id: soruId, hata_tipi: hata.tip, soru_metni: soruMetni, soru_spec: soruSpec }) });

  return out({ elo: Math.round(elo), sonraki_tekrar: new Date(next.dueMs).toISOString(), hata });
}
