import { LLMError, type LLM } from "@edershane/teacher-core";

const BASE = "https://generativelanguage.googleapis.com/v1beta";
type ModelInfo = { name: string; supportedGenerationMethods?: string[] };

// Ayarlı model -> gerçekte çalışan model. Isolate yeniden başlayana kadar hatırlanır.
let working: Record<string, string> = {};
let listed: { at: number; models: ModelInfo[] } | null = null;
export function resetModelCache() { working = {}; listed = null; }

/** Güncel model listesinden kullanılabilir en iyi Flash modellerini sıralar: kararlı > önizleme, lite olmayan > lite, yeni > eski. */
export function rankModels(models: ModelInfo[], method = "generateContent"): string[] {
  const bad = /(image|tts|live|audio|native|robotics|computer|embedding|imagen|veo|gemma|learnlm|aqa|thinking)/;
  return models
    .filter((m) => (m.supportedGenerationMethods ?? []).includes(method))
    .map((m) => m.name.replace(/^models\//, ""))
    .filter((n) => /^gemini-(\d+(\.\d+)?-)?flash/.test(n) && !bad.test(n))
    .map((n) => ({ n, v: parseFloat(/^gemini-(\d+(?:\.\d+)?)-/.exec(n)?.[1] ?? "0"), pre: /preview|exp/.test(n), lite: /lite/.test(n) }))
    .sort((a, b) => Number(a.pre) - Number(b.pre) || Number(a.lite) - Number(b.lite) || b.v - a.v || a.n.length - b.n.length)
    .map((x) => x.n);
}

export async function listModels(key: string): Promise<ModelInfo[]> {
  if (listed && Date.now() - listed.at < 3_600_000) return listed.models;
  try {
    const r = await fetch(`${BASE}/models?pageSize=200`, { headers: { "x-goog-api-key": key } });
    if (!r.ok) return [];
    const models = (((await r.json()) as any)?.models ?? []) as ModelInfo[];
    listed = { at: Date.now(), models };
    return models;
  } catch { return []; }
}

export class GeminiLLM implements LLM {
  constructor(private key: string, private model: string) {}

  private call(model: string, payload: string) {
    return fetch(`${BASE}/models/${model}:generateContent`, {
      method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": this.key }, body: payload,
    });
  }

  async json(system: string, user: string, imageBase64?: string): Promise<string> {
    const parts: unknown[] = [{ text: user }];
    if (imageBase64) parts.unshift({ inlineData: { mimeType: "image/jpeg", data: imageBase64 } });
    const payload = JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
    });

    const first = working[this.model] ?? this.model;
    let r = await this.call(first, payload);
    // Model kapandıysa (404) ya da kotası dolduysa (429): güncel listeden çalışan başka bir modele otomatik geç
    if (!r.ok && (r.status === 404 || r.status === 429)) {
      const detail = (await r.text().catch(() => "")).slice(0, 200);
      console.warn(`Model ${first} kullanılamadı (${r.status}), alternatif aranıyor:`, detail);
      const alts = ["gemini-flash-latest", ...rankModels(await listModels(this.key))]
        .filter((m, i, a) => m !== first && a.indexOf(m) === i).slice(0, 4);
      for (const m of alts) {
        const r2 = await this.call(m, payload);
        if (r2.ok) { working[this.model] = m; console.warn(`Model otomatik değişti: ${first} -> ${m}`); r = r2; break; }
        if (r2.status !== 404 && r2.status !== 429) { r = r2; break; }
      }
    }
    if (!r.ok) {
      const detail = (await r.text().catch(() => "")).slice(0, 300);
      console.error(`Gemini hatası ${r.status} (model: ${first}):`, detail);
      throw new LLMError(r.status, `Gemini ${r.status}`);
    }
    const j: any = await r.json();
    const t = j?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof t !== "string") throw new Error("Gemini boş cevap döndü"); // yeniden denenebilir: normal hata
    return t;
  }
}
