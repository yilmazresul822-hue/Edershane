import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { btn, card, row } from "../ui";

const TIP: Record<string, string> = { kavram: "kavram", islem: "işlem", dikkat: "dikkat", sure: "süre" };

export function Rapor({ uid, veli, onClose }: { uid: string; veli: boolean; onClose(): void }) {
  const [kids, setKids] = useState<{ id: string; ad: string }[]>([]);
  const [target, setTarget] = useState(veli ? "" : uid);
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!veli) return;
    supabase.rpc("cocuklarim").then(({ data }) => { const k = (data as any[]) ?? []; setKids(k); setTarget(k[0]?.id ?? ""); });
  }, [veli]);
  useEffect(() => {
    if (!target) return;
    setD(null); setErr("");
    supabase.rpc("haftalik_rapor", { ogr: target, gun: 7 }).then(({ data, error }) => (error ? setErr("Rapor alınamadı.") : setD(data)));
  }, [target]);

  async function indir() {
    const { data, error } = await supabase.rpc("verilerim");
    if (error) return setErr("Veriler alınamadı.");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = "verilerim.json"; a.click();
  }
  async function sil() {
    if (!window.confirm("Hesabın ve tüm verilerin kalıcı olarak silinecek. Emin misin?")) return;
    const { error } = await supabase.rpc("hesabimi_sil");
    if (error) return setErr("Silinemedi: " + error.message);
    await supabase.auth.signOut();
  }

  const oran = d && d.toplam ? Math.round((100 * d.dogru) / d.toplam) : 0;
  return (
    <div style={card}>
      <b>Son 7 gün</b>
      {veli && kids.length === 0 && <p>Hesabınıza bağlı öğrenci yok. Bağlama için yöneticiyle iletişime geçin.</p>}
      {veli && kids.length > 1 && (
        <select style={{ marginLeft: 8 }} value={target} onChange={(e) => setTarget(e.target.value)}>{kids.map((k) => <option key={k.id} value={k.id}>{k.ad}</option>)}</select>
      )}
      {err && <p>{err}</p>}
      {d && (d.toplam === 0 ? <p>Bu hafta çözülen soru yok.</p> : <>
        <p><b>{d.ad}</b>: {d.toplam} soru, %{oran} doğru, ortalama {d.ort_sure_sn} sn, {d.calisilan_gun} gün çalıştı.</p>
        {Object.keys(d.hata_tipleri).length > 0 && <p>Yanlışların türü (tahmini): {Object.entries(d.hata_tipleri).map(([k, v]) => `${TIP[k] ?? k} ${v}`).join(", ")}</p>}
        {d.kazanimlar.map((k: any, i: number) => <div key={i}><small>{k.kazanim}: {k.dogru}/{k.deneme}</small></div>)}
        <p>Tekrar vakti gelen konu: {d.tekrar_vakti}. Defterde çözülmemiş soru: {d.defter_acik}.</p>
      </>)}
      <div style={row}>
        <button style={btn} onClick={onClose}>Kapat</button>
        {!veli && <><button style={btn} onClick={indir}>Verilerimi indir</button><button style={btn} onClick={sil}>Hesabımı sil</button></>}
      </div>
    </div>
  );
}
