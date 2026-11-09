import { LLMError, llmMessage, lessonTurn, type LLM } from "@edershane/teacher-core";
import { getNotes } from "./kutuphane";
import type { Env } from "./index";

type Out = (d: unknown, s?: number) => Response;
const s = (v: unknown, max: number) => typeof v === "string" && v.length <= max;

const NOTSUZ = {
  sentences: [
    { id: "s1", text: "Bu konu için henüz ders notum yok, o yüzden uydurmak istemem." },
    { id: "s2", text: "Başka bir konu seçebilir ya da soru çözüm modunu kullanabilirsin." },
  ],
  commands: [],
};

export async function handleKonu(body: any, user: { uid: string; token: string }, llm: LLM, env: Env, out: Out) {
  if (typeof body !== "object" || !body) return out({ hata: "gövde yok" }, 400);
  if (!Number.isInteger(body.kazanim_id) || body.kazanim_id < 1) return out({ hata: "kazanim_id geçersiz" }, 400);
  if (!s(body.konu, 200) || body.konu.length < 3) return out({ hata: "konu geçersiz" }, 400);
  if (!["yoklama", "anlatim"].includes(body.faz)) return out({ hata: "faz geçersiz" }, 400);
  if (!Array.isArray(body.history) || body.history.length > 12 ||
      !body.history.every((h: any) => ["student", "teacher"].includes(h?.role) && s(h?.text, 500))) return out({ hata: "history geçersiz" }, 400);
  if (body.studentSaid !== undefined && !s(body.studentSaid, 500)) return out({ hata: "studentSaid geçersiz" }, 400);
  if (body.zayif !== undefined && !(Array.isArray(body.zayif) && body.zayif.length <= 5 && body.zayif.every((z: unknown) => s(z, 100))))
    return out({ hata: "zayif geçersiz" }, 400);

  const notes = body.faz === "anlatim"
    ? await getNotes(`${body.konu} ${body.studentSaid ?? ""}`.trim(), user.token, env, body.kazanim_id) : [];
  const notsuz = body.faz === "anlatim" && notes.length === 0;
  if (notsuz && env.NOTSUZ_ANLAT !== "1") return out({ script: NOTSUZ, notsuz: true, fallback: false });

  try {
    const r = await lessonTurn(llm, { konu: body.konu, faz: body.faz, history: body.history, studentSaid: body.studentSaid, notes, zayif: body.zayif });
    return out({ script: r.script, notsuz, fallback: r.fallback });
  } catch (e) {
    console.error(e);
    return out({ hata: e instanceof LLMError ? llmMessage(e) : "öğretmen şu an cevap veremiyor" }, 502);
  }
}
