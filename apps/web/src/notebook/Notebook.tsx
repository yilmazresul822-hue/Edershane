import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { SolverSpec } from "@edershane/teacher-core";
import { btn, btnP, card, row } from "../ui";

type Item = { id: number; kazanim_id: number; hata_tipi: string | null; soru_metni: string | null; soru_spec: SolverSpec | null };
const TIP: Record<string, string> = { kavram: "kavram", islem: "işlem", dikkat: "dikkat", sure: "süre" };

export function Notebook({ onRetry, onBooklet, onClose }: {
  onRetry(i: { id: number; spec: SolverSpec; text: string }): void;
  onBooklet(): Promise<void>; onClose(): void;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("yanlis_defteri").select("id,kazanim_id,hata_tipi,soru_metni,soru_spec")
      .eq("cozuldu", false).order("zaman", { ascending: false }).limit(50)
      .then(({ data, error }) => { if (error) setMsg("Defter okunamadı."); setItems((data as Item[]) ?? []); });
  }, []);

  async function booklet() {
    setBusy(true); setMsg("");
    try { await onBooklet(); } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  }

  return (
    <div style={card}>
      <b>Yanlış defteri</b>
      {items === null && <p>Yükleniyor…</p>}
      {items?.length === 0 && <p>Defter boş. Çözemediğin sorular burada birikir.</p>}
      {items?.map((i) => (
        <div key={i.id} style={{ borderTop: "1px solid #e4e1d4", padding: "8px 0" }}>
          <div>{i.soru_metni ?? "(soru metni kayıtlı değil)"}</div>
          <small>{i.hata_tipi ? `hata: ${TIP[i.hata_tipi] ?? i.hata_tipi}` : ""}</small>
          {i.soru_spec && <div style={row}><button style={btn} onClick={() => onRetry({ id: i.id, spec: i.soru_spec!, text: i.soru_metni ?? "" })}>Tekrar çözelim</button></div>}
        </div>
      ))}
      {msg && <p>{msg}</p>}
      <div style={row}>
        <button style={btnP} disabled={busy || !items?.length} onClick={booklet}>{busy ? "Hazırlanıyor…" : "PDF soru bankası oluştur"}</button>
        <button style={btn} onClick={onClose}>Kapat</button>
      </div>
    </div>
  );
}
