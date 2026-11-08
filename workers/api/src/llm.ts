import type { LLM } from "@edershane/teacher-core";

export class GeminiLLM implements LLM {
  constructor(private key: string, private model: string) {}
  async json(system: string, user: string, imageBase64?: string): Promise<string> {
    const parts: unknown[] = [{ text: user }];
    if (imageBase64) parts.unshift({ inlineData: { mimeType: "image/jpeg", data: imageBase64 } });
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": this.key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
      }),
    });
    if (!r.ok) throw new Error(`Gemini ${r.status}`);
    const j: any = await r.json();
    const t = j?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof t !== "string") throw new Error("Gemini boş cevap döndü");
    return t;
  }
}
