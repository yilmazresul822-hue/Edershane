import { describe, it, expect } from "vitest";
import worker, { type Env } from "./index";

type Call = { url: string; method: string; body: any };
const env: Env = {
  ALLOWED_ORIGIN: "https://x.test", GEMINI_MODEL: "g", EMBED_MODEL: "e", GEMINI_API_KEY: "k",
  SUPABASE_URL: "https://sb.test", SUPABASE_ANON_KEY: "anon", NOTSUZ_ANLAT: "0",
};

/** Sahte ağ: Supabase + Gemini. state ile davranış değiştirilir. */
function mockNet(st: { admin?: boolean; sub?: boolean; token?: boolean; geminiText?: string; notes?: any[]; ustalik?: any[] } = {}) {
  const calls: Call[] = [];
  const real = globalThis.fetch;
  const vec = Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0));
  globalThis.fetch = (async (input: any, init: any = {}) => {
    const url = String(input), method = init.method ?? "GET";
    const body = init.body ? (() => { try { return JSON.parse(init.body); } catch { return init.body; } })() : undefined;
    calls.push({ url, method, body });
    const j = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status });
    if (url.endsWith("/auth/v1/user")) return st.token === false ? j({}, 401) : j({ id: "u1" });
    if (url.includes("/rest/v1/abonelik")) return j(st.sub === false ? [] : [{ durum: "aktif", bitis: "2999-01-01T00:00:00Z", manuel_aktif: false }]);
    if (url.includes("/rpc/is_admin")) return j(!!st.admin);
    if (url.includes("/rpc/not_ara")) return j(st.notes ?? []);
    if (url.includes("/rest/v1/ustalik") && method === "GET") return j(st.ustalik ?? []);
    if (url.includes("/rest/v1/kaynak") && method === "POST") return j([{ id: 7 }], 201);
    if (url.includes("/rest/v1/")) return new Response(null, { status: 201 });
    if (url.includes(":embedContent")) return j({ embedding: { values: vec } });
    if (url.includes(":generateContent")) return j({ candidates: [{ content: { parts: [{ text: st.geminiText ?? "{}" }] } }] });
    return j({}, 404);
  }) as any;
  return { calls, restore: () => { globalThis.fetch = real; } };
}

const post = (path: string, body: unknown, auth = true) =>
  worker.fetch(new Request("https://api.test" + path, {
    method: "POST", headers: { "content-type": "application/json", ...(auth ? { authorization: "Bearer t" } : {}) },
    body: JSON.stringify(body),
  }), env);

const denemeBody = { kazanim_id: 1, dogru: false, sure_sn: 30, ipucu: 0, verilen_cevap: "3", dogru_cevap: "5",
  soru_metni: "2x+1=11", soru_spec: { kind: "equation", eq: "2*x+1=11" } };

describe("yetki", () => {
  it("giriş yoksa 401, abonelik yoksa 402, admin değilse 403", async () => {
    let n = mockNet();
    expect((await post("/deneme", denemeBody, false)).status).toBe(401);
    n.restore();
    n = mockNet({ sub: false });
    expect((await post("/deneme", denemeBody)).status).toBe(402);
    n.restore();
    n = mockNet({ admin: false });
    expect((await post("/admin/not-cikar", { transcript: "x".repeat(60) })).status).toBe(403);
    n.restore();
  });
  it("bilinmeyen yol 404; GET reddedilir", async () => {
    const n = mockNet();
    expect((await post("/yok", {})).status).toBe(404);
    n.restore();
  });
});

describe("hata dayanıklılığı", () => {
  it("beklenmeyen hata JSON + CORS başlığıyla döner (tarayıcıda 'failed to fetch' olmaz)", async () => {
    const real = globalThis.fetch;
    globalThis.fetch = (async () => { throw new Error("ağ koptu"); }) as any;
    const r = await post("/deneme", denemeBody);
    globalThis.fetch = real;
    expect(r.status).toBe(500);
    expect(r.headers.get("access-control-allow-origin")).toBe("https://x.test");
    expect(((await r.json()) as any).hata).toContain("geçici");
  });
  it("Vercel önizleme adresi kabul edilir, yabancı adres edilmez", async () => {
    const n = mockNet();
    const ask = (origin: string) => worker.fetch(new Request("https://api.test/yok", { method: "POST", headers: { origin } }), env);
    expect((await ask("https://edershane-git-main-x.vercel.app")).headers.get("access-control-allow-origin")).toBe("https://edershane-git-main-x.vercel.app");
    expect((await ask("https://kotu-site.com")).headers.get("access-control-allow-origin")).toBe("https://x.test");
    n.restore();
  });
});

describe("/deneme", () => {
  it("yanlış cevap: ustalık + deneme + yanlış defteri (soru metniyle) yazılır", async () => {
    const n = mockNet();
    const r = await post("/deneme", denemeBody);
    expect(r.status).toBe(200);
    const j: any = await r.json();
    expect(j.hata.tip).toBe("kavram");
    const w = n.calls.filter((c) => c.method === "POST" && c.url.includes("/rest/v1/"));
    expect(w.map((c) => c.url.split("/rest/v1/")[1].split("?")[0])).toEqual(["ustalik", "deneme", "yanlis_defteri"]);
    expect(w[2].body.soru_metni).toBe("2x+1=11");
    expect(w[1].body.kazanim_id).toBe(1);
    n.restore();
  });
  it("tekrar çözümde yanlış deftere yeniden eklenmez", async () => {
    const n = mockNet();
    await post("/deneme", { ...denemeBody, tekrar: true });
    expect(n.calls.some((c) => c.url.includes("yanlis_defteri"))).toBe(false);
    n.restore();
  });
  it("doğru cevap: hata yok, Elo yükselir", async () => {
    const n = mockNet();
    const j: any = await (await post("/deneme", { ...denemeBody, dogru: true })).json();
    expect(j.hata).toBeNull();
    expect(j.elo).toBeGreaterThan(1000);
    n.restore();
  });
  it("geçersiz alan 400", async () => {
    const n = mockNet();
    expect((await post("/deneme", { ...denemeBody, sure_sn: -1 })).status).toBe(400);
    n.restore();
  });
});

describe("/soru/yapilandir", () => {
  it("desteklenmeyen soruyu bildirir; geçerli soruyu spec'e çevirir", async () => {
    let n = mockNet({ geminiText: JSON.stringify({ kind: "unsupported", neden: "Çember soruları henüz yok" }) });
    const a: any = await (await post("/soru/yapilandir", { text: "çember..." })).json();
    expect(a.desteklenmiyor).toContain("Çember");
    n.restore();
    n = mockNet({ geminiText: JSON.stringify({ kind: "equation", eq: "2*x+3=7", ozet: "x'i bul", soru_metni: "2x+3=7 ise x?" }) });
    const b: any = await (await post("/soru/yapilandir", { text: "2x+3=7" })).json();
    expect(b.spec.eq).toBe("2*x+3=7");
    n.restore();
  });
  it("okunamayan görsel 'okunamadi' döner (desteklenmiyor değil)", async () => {
    const n = mockNet({ geminiText: JSON.stringify({ kind: "unreadable", neden: "sayı net değil" }) });
    const j: any = await (await post("/soru/yapilandir", { text: "", image: "AAAA" })).json();
    expect(j.okunamadi).toContain("net değil");
    expect(j.desteklenmiyor).toBeUndefined();
    n.restore();
  });
  it("metin ve görsel yoksa 400", async () => {
    const n = mockNet();
    expect((await post("/soru/yapilandir", {})).status).toBe(400);
    n.restore();
  });
});

describe("/ogretmen/anlat ve /konu/anlat", () => {
  const body = { question: "2x+3=7", points: [], facts: [], steps: [{ latex: "x=2", note: "sonuç" }], level: 3, history: [], answer: "x=2" };
  it("geçerli betik döner", async () => {
    const script = { sentences: [{ id: "s1", text: "Önce sabiti karşıya atalım." }], commands: [] };
    const n = mockNet({ geminiText: JSON.stringify(script) });
    const j: any = await (await post("/ogretmen/anlat", body)).json();
    expect(j.script.sentences[0].id).toBe("s1");
    expect(j.fallback).toBe(false);
    n.restore();
  });
  it("notu olmayan konuda uydurmaz, 'notum yok' der", async () => {
    const n = mockNet({ notes: [] });
    const j: any = await (await post("/konu/anlat", { kazanim_id: 2, konu: "İkinci dereceden denklem", faz: "anlatim", history: [] })).json();
    expect(j.notsuz).toBe(true);
    expect(j.script.sentences[0].text).toContain("notum yok");
    expect(n.calls.some((c) => c.url.includes(":generateContent"))).toBe(false);
    n.restore();
  });
  it("yoklama fazı not gerektirmez", async () => {
    const script = { sentences: [{ id: "s1", text: "Merhaba, bu konuda ne biliyorsun?" }], commands: [] };
    const n = mockNet({ geminiText: JSON.stringify(script) });
    const j: any = await (await post("/konu/anlat", { kazanim_id: 2, konu: "İkinci dereceden denklem", faz: "yoklama", history: [] })).json();
    expect(j.script.sentences.length).toBe(1);
    n.restore();
  });
});

describe("/admin/not-kaydet", () => {
  it("izin durumu geçersizse 400; geçerliyse kaynak + not kaydeder", async () => {
    let n = mockNet({ admin: true });
    const note = { baslik: "Birinci derece", ozet: "Bilinmeyen yalnız bırakılır, sonra katsayıya bölünür." };
    expect((await post("/admin/not-kaydet", { kaynak: { baslik: "a", tur: "not", sahip: "ben", izin_durumu: "x" }, notlar: [note] })).status).toBe(400);
    n.restore();
    n = mockNet({ admin: true });
    const r = await post("/admin/not-kaydet", { kaynak: { baslik: "a", tur: "not", sahip: "ben", izin_durumu: "kendi" }, notlar: [note] });
    expect(r.status).toBe(200);
    expect(n.calls.some((c) => c.url.includes("kavram_notu") && c.body[0].embedding.length === 768)).toBe(true);
    n.restore();
  });
});
