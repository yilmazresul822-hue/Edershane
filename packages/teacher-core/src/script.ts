import { validateCommand, type Command } from "@edershane/command-schema";

export type Sentence = { id: string; text: string };
export type Script = { sentences: Sentence[]; commands: Command[] };
export type Level = 1 | 2 | 3;
export type CheckCtx = {
  points: string[]; level: Level; answer?: string; soft?: boolean;
  /** İzin verilen komut türleri (verilmezse hepsi) */
  allow?: string[];
};
export type CheckResult =
  | { ok: true; script: Script; dropped: string[] }
  | { ok: false; errors: string[] };

const norm = (s: string) =>
  s.toLocaleLowerCase("tr-TR").replace(/\s+/g, "").replace(/[.,;:!?]/g, "");

/** Nihai cevap metinde geçiyor mu? Çoklu cevap "a|b" biçiminde; sayısal cevaplarda tam sayı eşleşmesi ("5" ≠ "15"). */
export function leaks(text: string, answer?: string): boolean {
  return (answer ?? "").split("|").some((a) => leaks1(text, a));
}
function leaks1(text: string, answer?: string): boolean {
  const a = (answer ?? "").trim();
  if (!a) return false;
  if (/^-?\d+([.,]\d+)?$/.test(a)) {
    const re = new RegExp(`(^|[^\\d.,])${a.replace(/[.,]/g, "[.,]")}([^\\d]|$)`);
    return re.test(text);
  }
  return norm(text).includes(norm(a));
}

function refsOf(c: Command): string[] {
  switch (c.type) {
    case "construct_altitude": return [c.from, ...c.onto];
    case "mark_angle": return [c.vertex, ...c.rays];
    case "label_point": case "point_to": return [c.target];
    case "label_segment": return [...c.segment];
    case "highlight": return [...c.target];
    case "annotate": return [c.near];
    case "write_latex": return c.near ? [c.near] : [];
    default: return [];
  }
}

export function checkScript(raw: unknown, ctx: CheckCtx): CheckResult {
  const errors: string[] = [];
  const dropped: string[] = [];
  if (typeof raw !== "object" || raw === null) return { ok: false, errors: ["Cevap bir nesne değil"] };
  const r = raw as Record<string, any>;

  // --- cümleler (burada hata her zaman ölümcül) ---
  if (!Array.isArray(r.sentences) || r.sentences.length < 1 || r.sentences.length > 12)
    return { ok: false, errors: ["sentences 1-12 elemanlı dizi olmalı"] };
  const ids = new Set<string>();
  const sentences: Sentence[] = [];
  for (const s of r.sentences) {
    if (typeof s?.id !== "string" || !/^s\d+$/.test(s.id) || ids.has(s.id))
      errors.push(`cümle id geçersiz veya tekrarlı: ${String(s?.id)}`);
    else if (typeof s.text !== "string" || !s.text.trim() || s.text.length > 220)
      errors.push(`${s.id}: metin boş veya 220 karakterden uzun`);
    else if (ctx.level < 3 && leaks(s.text, ctx.answer))
      errors.push(`${s.id}: nihai cevabı söylüyor, seviye ${ctx.level}'de yasak`);
    else { ids.add(s.id); sentences.push({ id: s.id, text: s.text.trim() }); }
  }
  if (errors.length) return { ok: false, errors };

  // --- komutlar ---
  const rawCmds: unknown[] = r.commands === undefined ? [] : r.commands;
  if (!Array.isArray(rawCmds) || rawCmds.length > 24) return { ok: false, errors: ["commands en fazla 24 elemanlı dizi olmalı"] };

  const known = new Set(ctx.points);
  const cmdIds = new Set<string>();
  const commands: Command[] = [];
  let latexCount = 0;

  for (const rc of rawCmds) {
    const bad = (m: string) => (ctx.soft ? dropped.push(m) : errors.push(m));
    const v = validateCommand(rc);
    if (!v.ok) { bad(v.error); continue; }
    const c = v.cmd;
    if (ctx.allow && !ctx.allow.includes(c.type)) { bad(`${c.id}: bu fazda ${c.type} kullanılamaz`); continue; }
    if (cmdIds.has(c.id)) { bad(`${c.id}: komut id tekrarlı`); continue; }
    if (c.speech_ref !== undefined && !ids.has(c.speech_ref)) { bad(`${c.id}: speech_ref bulunamadı (${c.speech_ref})`); continue; }
    const unknown = refsOf(c).find((p) => !known.has(p));
    if (unknown) { bad(`${c.id}: bilinmeyen nokta ${unknown}`); continue; }

    if (c.type === "write_latex") {
      if (c.zone === "free_space_near" && !c.near) { bad(`${c.id}: free_space_near için near gerekli`); continue; }
      if (ctx.level === 1) { bad(`${c.id}: seviye 1'de write_latex yasak`); continue; }
      if (ctx.level === 2 && latexCount >= 2) { bad(`${c.id}: seviye 2'de en fazla 2 formül`); continue; }
      if (ctx.level < 3 && leaks(c.latex, ctx.answer)) { bad(`${c.id}: formül nihai cevabı veriyor`); continue; }
      latexCount++;
    }
    if (c.type === "erase" && !c.target.every((t) => cmdIds.has(t))) { bad(`${c.id}: erase var olmayan komutu gösteriyor`); continue; }

    if (c.type === "construct_altitude") known.add(c.foot_label ?? "H");
    cmdIds.add(c.id);
    commands.push(c);
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, script: { sentences, commands }, dropped };
}
