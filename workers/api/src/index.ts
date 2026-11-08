import { teach, type TeachInput } from "@edershane/teacher-core";
import { GeminiLLM } from "./llm";
import { handleDeneme } from "./deneme";
import { handleNotCikar, handleNotKaydet, isAdmin, getNotes } from "./kutuphane";
import { handleYapilandir } from "./soru";
import { handleKonu } from "./konu";

export interface Env {
  ALLOWED_ORIGIN: string; GEMINI_MODEL: string; EMBED_MODEL: string; GEMINI_API_KEY: string;
  SUPABASE_URL: string; SUPABASE_ANON_KEY: string; NOTSUZ_ANLAT?: string;
}

const ROUTES = ["/ogretmen/anlat", "/deneme", "/admin/not-cikar", "/admin/not-kaydet", "/soru/yapilandir", "/konu/anlat"];
const REF = /^[A-Za-z][A-Za-z0-9_]*$/;
const hits = new Map<string, number[]>();
/** Not: isolate başına bellek içi, kaba bir koruma. Gerçek sınır için KV/Durable Object gerekir. */
function limited(uid: string, max = 30, windowMs = 60_000) {
  if (hits.size > 5000) hits.clear();
  const n = Date.now();
  const a = (hits.get(uid) ?? []).filter((t) => n - t < windowMs);
  a.push(n); hits.set(uid, a);
  return a.length > max;
}

async function auth(req: Request, env: Env) {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) return null;
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY } });
  if (!r.ok) return null;
  const u: any = await r.json();
  return typeof u?.id === "string" ? { uid: u.id as string, token } : null;
}

async function subscribed(uid: string, token: string, env: Env) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/abonelik?ogrenci_id=eq.${uid}&select=durum,bitis,manuel_aktif`,
    { headers: { authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY } });
  if (!r.ok) return false;
  const a = ((await r.json()) as any[])[0];
  if (!a) return false;
  if (a.manuel_aktif) return true;
  return (a.durum === "deneme" || a.durum === "aktif") && !!a.bitis && new Date(a.bitis) > new Date();
}

function parseInput(b: any): TeachInput | string {
  const s = (v: unknown, max: number) => typeof v === "string" && v.length <= max;
  const arr = (v: unknown, max: number) => Array.isArray(v) && v.length <= max;
  if (typeof b !== "object" || !b) return "gövde yok";
  if (!s(b.question, 2000) || !b.question) return "question geçersiz";
  if (!arr(b.points, 40) || !b.points.every((p: unknown) => typeof p === "string" && REF.test(p))) return "points geçersiz";
  if (!arr(b.facts, 20) || !b.facts.every((f: unknown) => s(f, 200))) return "facts geçersiz";
  if (!arr(b.steps, 20) || !b.steps.every((x: any) => s(x?.latex, 200) && s(x?.note, 300))) return "steps geçersiz";
  if (![1, 2, 3].includes(b.level)) return "level geçersiz";
  if (!arr(b.history, 10) || !b.history.every((h: any) => ["student", "teacher"].includes(h?.role) && s(h?.text, 500))) return "history geçersiz";
  if (b.studentSaid !== undefined && !s(b.studentSaid, 500)) return "studentSaid geçersiz";
  if (b.answer !== undefined && !s(b.answer, 100)) return "answer geçersiz";
  return { question: b.question, points: b.points, facts: b.facts, steps: b.steps, level: b.level,
    history: b.history, studentSaid: b.studentSaid, answer: b.answer };
}

function corsFor(origin: string, env: Env) {
  const list = (env.ALLOWED_ORIGIN ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  // Vercel'in bu projeye ait önizleme adresleri de (edershane-xyz.vercel.app) kabul edilir
  const ok = list.includes(origin) || /^https:\/\/edershane[a-z0-9-]*\.vercel\.app$/.test(origin);
  return {
    "access-control-allow-origin": ok ? origin : (list[0] ?? ""),
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    vary: "origin",
  };
}

async function handle(req: Request, env: Env, out: (d: unknown, s?: number) => Response): Promise<Response> {
  const url = new URL(req.url);
  if (req.method !== "POST" || !ROUTES.includes(url.pathname)) return out({ hata: "bulunamadı" }, 404);

  const user = await auth(req, env);
  if (!user) return out({ hata: "giriş gerekli" }, 401);
  if (limited(user.uid)) return out({ hata: "çok fazla istek, biraz bekle" }, 429);

  if (url.pathname.startsWith("/admin/")) {
    if (!(await isAdmin(user.token, env))) return out({ hata: "yetkisiz" }, 403);
  } else if (!(await subscribed(user.uid, user.token, env))) return out({ hata: "abonelik gerekli" }, 402);

  let body: unknown;
  try { body = await req.json(); } catch { return out({ hata: "JSON okunamadı" }, 400); }
  const llm = new GeminiLLM(env.GEMINI_API_KEY, env.GEMINI_MODEL);

  if (url.pathname === "/soru/yapilandir") return handleYapilandir(body, llm, out);
  if (url.pathname === "/konu/anlat") return handleKonu(body, user, llm, env, out);
  if (url.pathname === "/deneme") return handleDeneme(body, user, env, out);
  if (url.pathname === "/admin/not-cikar") return handleNotCikar(body, user, llm, env, out);
  if (url.pathname === "/admin/not-kaydet") return handleNotKaydet(body, user, env, out);

  const input = parseInput(body);
  if (typeof input === "string") return out({ hata: input }, 400);
  const notes = await getNotes([input.question, input.studentSaid].filter(Boolean).join(" "), user.token, env);
  const r = await teach(llm, { ...input, notes });
  return out({ script: r.script, tries: r.tries, fallback: r.fallback, not_sayisi: notes.length });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cors = corsFor(req.headers.get("origin") ?? "", env);
    const out = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { ...cors, "content-type": "application/json" } });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      return await handle(req, env, out);
    } catch (e) {
      // Yakalanmayan hata tarayıcıda "failed to fetch" olarak görünürdü; artık okunur bir cevap dönüyor
      console.error("worker hatası:", e);
      return out({ hata: "Sunucuda geçici bir hata oldu, birkaç saniye sonra tekrar dene." }, 500);
    }
  },
};
