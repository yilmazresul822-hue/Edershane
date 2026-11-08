import { supabase } from "./supabase";
export const API_URL = import.meta.env.VITE_API_URL as string;
export const getToken = async () => (await supabase.auth.getSession()).data.session?.access_token ?? "";

export async function apiPost(path: string, body: unknown): Promise<any> {
  let r: Response;
  try {
    r = await fetch(API_URL + path, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${await getToken()}` },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error("ağ hatası:", path, e);
    throw new Error("Sunucuya ulaşılamadı. İnterneti kontrol et; sürerse birkaç saniye sonra tekrar dene.");
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.hata ?? `HTTP ${r.status}`);
  return j;
}
