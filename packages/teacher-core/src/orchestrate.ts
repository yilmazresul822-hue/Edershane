import { buildSystemPrompt, buildUserPrompt, type TeachInput } from "./prompt";
import { checkScript, type Script } from "./script";

/** Yapay zeka servisine ulaşma hatası (model kapandı, anahtar yanlış, kota doldu...). Yeniden denemek işe yaramaz. */
export class LLMError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = "LLMError"; }
}
export function llmMessage(e: unknown): string {
  const st = e instanceof LLMError ? e.status : 0;
  if (st === 404) return "Yapay zeka modeli bulunamadı (model adı eski olabilir).";
  if (st === 400 || st === 401 || st === 403) return "Yapay zeka anahtarı geçersiz ya da yetkisiz.";
  if (st === 429) return "Yapay zeka kullanım sınırı doldu, biraz bekleyip tekrar dene.";
  return `Yapay zeka servisi hata verdi (${st || "bağlantı"}).`;
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
