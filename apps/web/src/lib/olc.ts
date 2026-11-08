import { supabase } from "./supabase";

/** Ölçüm kaydı: asla akışı bozmaz, kişisel veri taşımaz (soru metni, ses yok). */
export function olc(tur: string, deger?: number, meta?: Record<string, unknown>) {
  void supabase.from("olcum").insert({ tur, deger: deger ?? null, meta: meta ?? null }).then(() => {}, () => {});
}
