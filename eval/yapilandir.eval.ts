// Gerçek LLM çağırır: npx tsx eval/yapilandir.eval.ts   (GEMINI_API_KEY ortam değişkeni gerekir)
import { readFileSync } from "node:fs";
import { structureQuestion } from "../packages/teacher-core/src/spec";
import { GeminiLLM } from "../workers/api/src/llm";

type Case = { metin: string; beklenen: Record<string, string> };
const cases: Case[] = JSON.parse(readFileSync(new URL("./yapilandir.json", import.meta.url), "utf-8"));
const llm = new GeminiLLM(process.env.GEMINI_API_KEY!, process.env.GEMINI_MODEL ?? "gemini-2.0-flash");
const norm = (s: unknown) => String(s ?? "").replace(/\s+/g, "").toLowerCase();

let ok = 0;
for (const c of cases) {
  const r = await structureQuestion(llm, { text: c.metin });
  const exp: any = c.beklenen;
  const pass = exp.kind === "unsupported"
    ? !r.ok && !!r.unsupported
    : r.ok && Object.entries(exp).every(([k, v]) => norm((r.spec as any)[k]) === norm(v));
  if (pass) ok++; else console.log("HATA:", c.metin, "→", JSON.stringify(r));
}
console.log(`doğru: ${ok}/${cases.length} (%${Math.round((100 * ok) / cases.length)})`);
