import { useEffect, useRef, useState } from "react";
import { pickTest, zorlukToElo } from "@edershane/teacher-core";
import { pretty } from "@edershane/bank-pdf";
import { supabase } from "../lib/supabase";
import { apiPost } from "../lib/api";
import { btn, btnP, card, row } from "../ui";

type Q = { id: string; zorluk: number; govde: { stem: string; secenekler: string[]; spec: any };
  cevap: { dogru_index: number; deger: string; tuzaklar: { cevap: string; ad: string }[] } };
export type TestResult = { dogru: number; toplam: number; yanlislar: { stem: string; spec: any; zayif: string }[] };

export function TestRunner({ kazanimId, onDone, onClose }: { kazanimId: number; onDone(r: TestResult): void; onClose(): void }) {
  const [qs, setQs] = useState<Q[] | null>(null);
  const [i, setI] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const res = useRef<TestResult>({ dogru: 0, toplam: 0, yanlislar: [] });
  const t0 = useRef(Date.now());

  useEffect(() => {
    (async () => {
      const [a, b, c] = await Promise.all([
        supabase.from("uretilen_soru").select("id,zorluk,govde,cevap").eq("kazanim_id", kazanimId).eq("dogrulandi", true).limit(80),
        supabase.from("deneme").select("soru_id").not("soru_id", "is", null).limit(2000),
        supabase.from("ustalik").select("elo").eq("kazanim_id", kazanimId).maybeSingle(),
      ]);
      if (a.error) return setErr("Sorular okunamadı.");
      const picked = pickTest((a.data ?? []) as Q[], new Set((b.data ?? []).map((r: any) => r.soru_id)), (c.data as any)?.elo ?? 1000, 5);
      if (!picked.length) return setErr("Bu konu için henüz test sorusu yok.");
      setQs(picked); t0.current = Date.now();
    })().catch(() => setErr("Sorular okunamadı."));
  }, [kazanimId]);

  function choose(j: number) {
    if (sel !== null || !qs) return;
    const q = qs[i], ok = j === q.cevap.dogru_index, secilen = q.govde.secenekler[j];
    setSel(j);
    res.current.toplam++;
    if (ok) res.current.dogru++;
    else res.current.yanlislar.push({ stem: q.govde.stem, spec: q.govde.spec,
      zayif: q.cevap.tuzaklar.find((t) => t.cevap === secilen)?.ad ?? `Soru: ${q.govde.stem.slice(0, 70)}` });
    apiPost("/deneme", {
      kazanim_id: kazanimId, dogru: ok, ipucu: 0, soru_id: q.id, soru_elo: zorlukToElo(q.zorluk), beklenen_sn: 90,
      sure_sn: Math.min(7200, Math.round((Date.now() - t0.current) / 1000)),
      verilen_cevap: secilen.slice(0, 100), dogru_cevap: q.cevap.deger.slice(0, 100), tuzaklar: q.cevap.tuzaklar.slice(0, 10),
      soru_metni: q.govde.stem.slice(0, 1000), soru_spec: q.govde.spec,
    }).catch(() => {});
  }
  function next() {
    if (!qs) return;
    if (i + 1 < qs.length) { setI(i + 1); setSel(null); t0.current = Date.now(); } else onDone(res.current);
  }

  if (err) return <div style={card}><p>{err}</p><div style={row}><button style={btn} onClick={onClose}>Kapat</button></div></div>;
  if (!qs) return <div style={card}><p>Test hazırlanıyor…</p></div>;
  const q = qs[i];
  return (
    <div style={card}>
      <small>Soru {i + 1}/{qs.length}</small>
      <p style={{ fontSize: 17 }}>{pretty(q.govde.stem)}</p>
      <div style={{ display: "grid", gap: 6 }}>
        {q.govde.secenekler.map((s, j) => {
          const dogru = j === q.cevap.dogru_index;
          const bg = sel === null ? "#fffdf7" : dogru ? "#c9f2d6" : j === sel ? "#f9d0d2" : "#fffdf7";
          return <button key={j} style={{ ...btn, background: bg, textAlign: "left" }} onClick={() => choose(j)}>{"ABCDE"[j]}) {pretty(s)}</button>;
        })}
      </div>
      {sel !== null && <div style={row}><button style={btnP} onClick={next}>{i + 1 < qs.length ? "Sonraki" : "Bitir"}</button></div>}
    </div>
  );
}
