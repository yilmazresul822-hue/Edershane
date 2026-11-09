import { buildSystemPrompt, buildUserPrompt, type TeachInput } from "./prompt";
import { checkScript, type Script } from "./script";

/** Yapay zeka servisine ulaşma hatası (model kapandı, anahtar yanlış, kota doldu...). Yeniden denemek işe yaramaz. */
export class LLMError extends Error {
  constructor(public status: number, message: string, public detail = "") { super(message); this.name = "LLMError"; }
}
/** Kullanıcıya gösterilecek açıklama. Google'ın kendi cümlesi sona eklenir (anahtar içermez). */
export function llmMessage(e: unknown): string {
  const st = e instanceof LLMError ? e.status : 0;
  const d = e instanceof LLMError ? e.detail : "";
  const tail = d ? ` Google diyor ki: "${d}"` : "";
  if (/api key/i.test(d) || st === 401) return "Yapay zeka anahtarı Google tarafından reddedildi." + tail;
  if (st === 404) return "Yapay zeka modeli bulunamadı." + tail;
  if (st === 403) return "Yapay zeka erişimi reddedildi (anahtar kısıtlı ya da bölge desteklenmiyor olabilir)." + tail;
  if (st === 400) return "Yapay zekaya gönderilen istek reddedildi." + tail;
  if (st === 429) return "Yapay zeka kullanım sınırı doldu, biraz bekleyip tekrar dene." + tail;
  return `Yapay zeka servisi hata verdi (${st || "bağlantı"}).` + tail;
}

export interface LLM { json(system: string, user: string, imageBase64?: string): Promise<string>; }
export type TeachResult = { script: Script; tries: number; dropped: string[]; fallback: boolean };

export const FALLBACK: Script = {
  sentences: [{ id: "s1", text: "Bir an takıldım. Aynı şeyi tekrar söyler misin?" }],
  commands: [],
};

export function parseJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(t); } catch { /* süslü parantez arasını dene */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("JSON bulunamadı");
  return JSON.parse(t.slice(a, b + 1));
}

/** LLM'e sor, doğrula, gerekirse hata listesiyle yeniden yazdır. Son denemede hatalı komutlar atılır. */
export async function teach(llm: LLM, input: TeachInput, maxTries = 3): Promise<TeachResult> {
  const system = buildSystemPrompt(input.level);
  let user = buildUserPrompt(input);
  let last: string[] = [];
  for (let i = 1; i <= maxTries; i++) {
    let raw: unknown;
    try {
      raw = parseJson(await llm.json(system, user));
    } catch (e) {
      if (e instanceof LLMError) throw e;
      last = [`JSON okunamadı: ${(e as Error).message}`];
      user = buildUserPrompt(input, last);
      continue;
    }
    const res = checkScript(raw, { points: input.points, level: input.level, answer: input.answer, soft: i === maxTries });
    if (res.ok) return { script: res.script, tries: i, dropped: res.dropped, fallback: false };
    last = res.errors;
    user = buildUserPrompt(input, last);
  }
  return { script: FALLBACK, tries: maxTries, dropped: last, fallback: true };
}
