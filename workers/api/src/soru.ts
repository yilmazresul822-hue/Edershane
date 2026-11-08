import { structureQuestion, type LLM } from "@edershane/teacher-core";

export async function handleYapilandir(body: any, llm: LLM, out: (d: unknown, s?: number) => Response) {
  const text = typeof body?.text === "string" ? body.text.slice(0, 2000) : "";
  // Büyük metne regex uygulamıyoruz (Worker CPU süresini yer); yalnızca uzunluk ve baş kısım kontrol edilir
  const image = typeof body?.image === "string" && body.image.length <= 1_500_000 && /^[A-Za-z0-9+/=]+$/.test(body.image.slice(0, 200))
    ? body.image : undefined;
  if (!text.trim() && !image) return out({ hata: "text ya da image gerekli" }, 400);
  try {
    const r = await structureQuestion(llm, { text, image });
    if (r.ok) return out({ spec: r.spec, ozet: r.ozet, soru_metni: r.soruMetni });
    if (r.unreadable) return out({ okunamadi: r.unreadable });
    if (r.unsupported) return out({ desteklenmiyor: r.unsupported });
    return out({ hata: "Soruyu anlayamadım, metni düzeltip tekrar dene" }, 422);
  } catch (e) {
    console.error(e);
    return out({ hata: "Soru okunamadı, biraz sonra tekrar dene" }, 502);
  }
}
