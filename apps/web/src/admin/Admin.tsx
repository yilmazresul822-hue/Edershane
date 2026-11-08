import { useEffect, useState } from "react";
import { kavramToText, tooClose, type Taslak } from "@edershane/content-core";
import { supabase } from "../lib/supabase";
import { apiPost } from "../lib/api";
import { btn, btnP, card, field, row } from "../ui";

type Draft = Taslak & { on: boolean };
type Kaynak = { id: number; baslik: string; sahip: string; izin_durumu: string; aktif: boolean };
type Kz = { id: number; kazanim: string };

export function Admin({ onClose }: { onClose(): void }) {
  const [tab, setTab] = useState<"ekle" | "kaynak">("ekle");
  const [text, setText] = useState("");
  const [baslik, setBaslik] = useState("");
  const [tur, setTur] = useState("video-transkript");
  const [sahip, setSahip] = useState("");
  const [izin, setIzin] = useState("kendi");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [warn, setWarn] = useState<string[]>([]);
  const [kz, setKz] = useState<Kz[]>([]);
  const [src, setSrc] = useState<Kaynak[]>([]);
  const [prog, setProg] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const loadSrc = () => supabase.from("kaynak").select("id,baslik,sahip,izin_durumu,aktif").order("id", { ascending: false })
    .then(({ data }) => setSrc((data as Kaynak[]) ?? []));
  useEffect(() => {
    supabase.from("kazanim").select("id,kazanim").order("id").then(({ data }) => setKz((data as Kz[]) ?? []));
    loadSrc();
  }, []);

  const upd = (i: number, p: Partial<Draft>) => setDrafts((d) => d.map((x, n) => (n === i ? { ...x, ...p } : x)));

  async function cikar() {
    setBusy(true); setMsg(""); setDrafts([]); setWarn([]);
    try {
      let bas = 0;
      const all: Draft[] = [], w: string[] = [];
      for (;;) {
        const r = await apiPost("/admin/not-cikar", { transcript: text, parca_bas: bas });
        all.push(...(r.taslaklar as Taslak[]).map((t) => ({ ...t, on: true })));
        w.push(...r.uyarilar);
        setProg(`${Math.min(r.toplam_parca, bas + 6)}/${r.toplam_parca} parça işlendi`);
        if (r.sonraki == null) break;
        bas = r.sonraki;
      }
      setDrafts(all); setWarn(w);
      if (!all.length) setMsg("Not çıkmadı (konu anlatımı bulunamadı ya da hepsi kaynağa çok benzedi).");
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  }

  async function kaydet() {
    const sel = drafts.filter((d) => d.on);
    if (!sel.length) return setMsg("Seçili not yok.");
    if (!baslik.trim() || !sahip.trim()) return setMsg("Kaynak başlığı ve sahibi gerekli.");
    for (const d of sel) { // düzenlenmiş metin kaynağa fazla benzemesin
      if (tooClose(kavramToText(d), text).close) return setMsg(`"${d.baslik}" kaynağa çok benziyor, kendi cümlelerinle yeniden yaz.`);
    }
    setBusy(true); setMsg("");
    try {
      const r = await apiPost("/admin/not-kaydet", {
        kaynak: { baslik: baslik.trim(), tur, sahip: sahip.trim(), izin_durumu: izin },
        notlar: sel.map(({ on, ...n }) => n),
      });
      setMsg(`Kaydedildi: ${r.kaydedilen} not (kaynak #${r.kaynak_id}).`);
      setDrafts([]); loadSrc();
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  }

  async function cikarKaynak(k: Kaynak) {
    if (!window.confirm(`"${k.baslik}" kaynağının notları ve türeyen soruları kapatılsın mı?`)) return;
    const { error } = await supabase.rpc("kaynak_cikar", { kid: k.id });
    setMsg(error ? "Çıkarılamadı: " + error.message : "Kaynak kapatıldı.");
    loadSrc();
  }

  return (
    <div style={{ ...card, maxHeight: "80vh" }}>
      <div style={row}>
        <button style={tab === "ekle" ? btnP : btn} onClick={() => setTab("ekle")}>Not ekle</button>
        <button style={tab === "kaynak" ? btnP : btn} onClick={() => setTab("kaynak")}>Kaynaklar</button>
        <button style={btn} onClick={onClose}>Kapat</button>
      </div>

      {tab === "ekle" && <>
        <input style={{ ...field, marginTop: 8 }} placeholder="Kaynak başlığı" value={baslik} onChange={(e) => setBaslik(e.target.value)} />
        <input style={{ ...field, marginTop: 6 }} placeholder="Sahibi (kimin içeriği?)" value={sahip} onChange={(e) => setSahip(e.target.value)} />
        <div style={row}>
          <select style={field} value={tur} onChange={(e) => setTur(e.target.value)}>
            <option value="video-transkript">Video transkripti</option><option value="not">Kendi notum</option><option value="pdf">PDF metni</option>
          </select>
          <select style={field} value={izin} onChange={(e) => setIzin(e.target.value)}>
            <option value="kendi">İzin: kendi içeriğim</option><option value="izinli">İzin: yazılı izin var</option>
            <option value="kamu">İzin: kamu malı / açık lisans</option><option value="belirsiz">İzin: belirsiz</option>
          </select>
        </div>
        <textarea style={{ ...field, marginTop: 6, minHeight: 120 }} placeholder="Transkripti yapıştır (zaman damgalı olabilir: 00:12:30 metin)" value={text} onChange={(e) => setText(e.target.value)} />
        <div style={row}><button style={btnP} disabled={busy || text.length < 50} onClick={cikar}>{busy ? prog || "Çalışıyor…" : "Notları çıkar"}</button></div>
        {warn.map((w, i) => <small key={i} style={{ display: "block" }}>⚠ {w}</small>)}

        {drafts.map((d, i) => (
          <div key={i} style={{ borderTop: "1px solid #e4e1d4", padding: "8px 0" }}>
            <label><input type="checkbox" checked={d.on} onChange={(e) => upd(i, { on: e.target.checked })} /> Kaydet</label>
            <input style={{ ...field, marginTop: 4 }} value={d.baslik} onChange={(e) => upd(i, { baslik: e.target.value })} />
            <textarea style={{ ...field, marginTop: 4, minHeight: 60 }} value={d.ozet} onChange={(e) => upd(i, { ozet: e.target.value })} />
            <small style={{ display: "block" }}>Yöntem: {d.adimlar.join(" › ") || "-"}</small>
            <small style={{ display: "block" }}>Tuzaklar: {d.tuzaklar.join("; ") || "-"}</small>
            <select style={{ ...field, marginTop: 4 }} value={d.kazanim_id ?? ""} onChange={(e) => upd(i, { kazanim_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Kazanım: etiketsiz</option>
              {kz.map((k) => <option key={k.id} value={k.id}>{k.id}: {k.kazanim.slice(0, 50)}</option>)}
            </select>
          </div>
        ))}
        {drafts.length > 0 && <div style={row}><button style={btnP} disabled={busy} onClick={kaydet}>Seçilenleri kaydet</button></div>}
      </>}

      {tab === "kaynak" && src.map((k) => (
        <div key={k.id} style={{ borderTop: "1px solid #e4e1d4", padding: "8px 0" }}>
          <b>#{k.id} {k.baslik}</b> <small>({k.sahip}, izin: {k.izin_durumu}{k.aktif ? "" : ", KAPALI"})</small>
          {k.aktif && <div style={row}><button style={btn} onClick={() => cikarKaynak(k)}>Çıkar</button></div>}
        </div>
      ))}
      {msg && <p>{msg}</p>}
    </div>
  );
}
