export type AboneDurum = "yukleniyor" | "aktif" | "veli_bekliyor" | "bitti";
export function abonelikDurumu(row: { durum: string; bitis: string | null; manuel_aktif: boolean } | null, now = Date.now()): AboneDurum {
  if (!row) return "bitti";
  if (row.manuel_aktif) return "aktif";
  if (row.durum === "bitti" && !row.bitis) return "veli_bekliyor";
  if ((row.durum === "deneme" || row.durum === "aktif") && row.bitis && Date.parse(row.bitis) > now) return "aktif";
  return "bitti";
}
