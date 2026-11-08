import { useEffect, useRef, useState } from "react";
import { BoardPlayer } from "@edershane/board-player";
import { kazanimFor, type SolverSpec } from "@edershane/teacher-core";
import { Solver, toCtx, type SolverResult } from "../solver/client";
import { sceneFromFigure } from "../solver/scene";
import { TeacherSession, type Script } from "../voice/session";
import { makeAsk } from "../teacher/api";
import { API_URL, apiPost, getToken } from "../lib/api";
import { supabase } from "../lib/supabase";
import { olc } from "../lib/olc";
import type { BoardHandle } from "../board/PdfBoard";
import { btn, btnP, card, field, row } from "../ui";

export type SolveInput =
  | { kind: "selection"; crop: string; text: string; at: { x: number; y: number } }
  | { kind: "notebook"; id: number; spec: SolverSpec; text: string; at: { x: number; y: number } }
  | { kind: "spec"; spec: SolverSpec; text: string; at: { x: number; y: number } };
type Draft = { spec: SolverSpec; ozet: string; soruMetni: string };
type Phase = "reading" | "confirm" | "solving" | "teaching" | "problem" | "done";

type Props = {
  input: SolveInput; solver: Solver; board: BoardHandle | null;
  onPlayer(p: BoardPlayer | null): void; onReadDone(): void; onNext(): void; onClose(): void;
};

export function SolvePanel({ input, solver, board, onPlayer, onReadDone, onNext, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("reading");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [edit, setEdit] = useState("");
  const [problem, setProblem] = useState("");
  const [caption, setCaption] = useState("");
  const [note, setNote] = useState("");
  const [typed, setTyped] = useState("");
  const [level, setLevel] = useState<1 | 2 | 3>(1);
  const [doneMsg, setDoneMsg] = useState("");
  const session = useRef<TeacherSession | null>(null);
  const levelRef = useRef<1 | 2 | 3>(1);
  const cur = useRef<{ d: Draft; res: Extract<SolverResult, { ok: true }> } | null>(null);
  const t0 = useRef(0);
  const sentences = useRef<{ id: string; text: string }[]>([]);

  const stop = () => { session.current?.stop(); session.current = null; };
  const fail = (m: string) => { setProblem(m); setPhase("problem"); };
  const kaynak = input.kind === "selection" && input.text ? "pdf_metin" : "gorsel";

  useEffect(() => {
    let dead = false;
    (async () => {
      if (input.kind !== "selection") {
        onReadDone();
        return run({ spec: input.spec, ozet: "Hazır soru", soruMetni: input.text });
      }
      try {
        const r = await apiPost("/soru/yapilandir", { text: input.text, image: input.crop.split(",")[1] });
        if (dead) return;
        onReadDone();
        got(r);
      } catch (e) { if (!dead) { onReadDone(); fail((e as Error).message); } }
    })();
    return () => { dead = true; stop(); onPlayer(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  function got(r: any) {
    if (r.okunamadi) {
      olc("okuma_basarisiz", 1, { kaynak, neden: String(r.okunamadi).slice(0, 120) });
      return fail("Soruyu net okuyamadım (" + r.okunamadi + "). Soruyu biraz daha yakından, yalnızca soru metnini içine alacak şekilde yeniden seç.");
    }
    if (r.desteklenmiyor) { olc("desteklenmiyor", 1, { neden: String(r.desteklenmiyor).slice(0, 120) }); return fail(r.desteklenmiyor); }
    setDraft({ spec: r.spec, ozet: r.ozet, soruMetni: r.soru_metni });
    setEdit(r.soru_metni);
    setPhase("confirm");
  }

  async function reread() {
    olc("okuma_dogru", 0, { kaynak });
    setPhase("reading");
    try { got(await apiPost("/soru/yapilandir", { text: edit })); } catch (e) { fail((e as Error).message); }
  }

  async function run(d: Draft) {
    setPhase("solving");
    try {
      const res = await solver.solve(d.spec);
      if (!res.ok) { olc("cozucu_hata", 1, { kind: d.spec.kind, hata: res.error.slice(0, 120) }); return fail(res.error); }
      cur.current = { d, res };
      levelRef.current = 1; setLevel(1); t0.current = Date.now();

      const at = input.at ?? board?.freeOrigin() ?? { x: 0, y: 0 };
      const player = new BoardPlayer(sceneFromFigure(res.figure, at), { drawFigure: !!res.figure });
      onPlayer(player);
      board?.focus(at.x, at.y);

      const base = makeAsk({ apiUrl: API_URL, getToken, getCtx: () => toCtx(d.soruMetni, res, levelRef.current) });
      const ask = async (t?: string): Promise<Script> => { const s = await base(t); sentences.current = s.sentences; return s; };
      const s = new TeacherSession(player, ask);
      session.current = s;
      s.onLatency = (ms) => olc("gecikme_ms", ms);
      const onStart = s.speaker.onStart;
      s.speaker.onStart = (i) => { onStart?.(i); setCaption(sentences.current[i]?.text ?? ""); };
      try { await s.start(true); }
      catch { await s.start(false); setNote("Mikrofon kullanılamadı: aşağıdan yazarak soru sorabilirsin."); }

      setPhase("teaching");
      player.play();
      const script = await ask(undefined);
      setTimeout(() => { if (session.current === s) s.say(script); }, res.figure ? 2300 : 200);
    } catch (e) { fail((e as Error).message); }
  }

  const harder = () => {
    const next = Math.min(3, levelRef.current + 1) as 1 | 2 | 3;
    levelRef.current = next; setLevel(next);
    void session.current?.typed(next === 2 ? "Takıldım, kısmi çözüm göster." : "Tam çözümü adım adım göster.");
  };
  const send = () => { const t = typed.trim(); if (t) { setTyped(""); void session.current?.typed(t); } };

  async function finish(dogru: boolean) {
    const c = cur.current; if (!c) return;
    const lv = levelRef.current;
    stop();
    try {
      await apiPost("/deneme", {
        kazanim_id: kazanimFor(c.d.spec, c.res.facts), dogru,
        sure_sn: Math.min(7200, Math.round((Date.now() - t0.current) / 1000)),
        ipucu: lv === 1 ? 0 : lv === 2 ? 2 : 3,
        dogru_cevap: c.res.answer.slice(0, 100), soru_metni: c.d.soruMetni.slice(0, 1000), soru_spec: c.d.spec,
        tekrar: input.kind !== "selection",
      });
      if (dogru && input.kind === "notebook") await supabase.from("yanlis_defteri").update({ cozuldu: true }).eq("id", input.id);
      setDoneMsg(dogru ? "Kaydedildi. Güzel iş!" : input.kind === "notebook" ? "Defterde kaldı, sonra tekrar bakarız." : "Yanlış defterine eklendi.");
    } catch (e) { setDoneMsg("Kaydedilemedi: " + (e as Error).message); }
    olc("sonuc", dogru ? 1 : 0, { seviye: lv });
    setPhase("done");
  }

  // Öğrenci ve biz, sunucuya tam olarak ne gönderildiğini görebilelim
  const preview = input.kind === "selection"
    ? <img src={input.crop} alt="Seçtiğin bölge" style={{ maxWidth: "100%", maxHeight: 110, display: "block", border: "1px solid #c9c6b8", borderRadius: 6, marginBottom: 6 }} />
    : null;

  return (
    <div style={card}>
      {(phase === "confirm" || phase === "problem" || phase === "reading") && preview}
      {phase === "reading" && <p>Soru okunuyor…</p>}

      {phase === "confirm" && draft && <>
        <b>Anladığım:</b> {draft.ozet}
        <textarea style={{ ...field, marginTop: 8, minHeight: 70 }} value={edit} onChange={(e) => setEdit(e.target.value)} />
        <div style={row}>
          <button style={btnP} onClick={() => { if (edit.trim() === draft.soruMetni) olc("okuma_dogru", 1, { kaynak }); void run(draft); }}>Doğru, çöz</button>
          <button style={btn} onClick={reread} disabled={edit.trim() === draft.soruMetni}>Metni düzelttim, yeniden oku</button>
          <button style={btn} onClick={onClose}>İptal</button>
        </div>
      </>}

      {phase === "solving" && <p>Çözülüyor… İlk seferde çözücü indirilir, birkaç saniye sürebilir.</p>}

      {phase === "problem" && <>
        <p>{problem}</p>
        <div style={row}>
          {draft && <button style={btn} onClick={() => setPhase("confirm")}>Soruyu düzelt</button>}
          <button style={btn} onClick={onNext}>Başka soru seç</button>
          <button style={btn} onClick={onClose}>Kapat</button>
        </div>
      </>}

      {phase === "teaching" && <>
        <div style={{ minHeight: 44, fontSize: 17 }}>{caption || "Öğretmen hazırlanıyor…"}</div>
        {note && <small>{note}</small>}
        <div style={{ ...row, flexWrap: "nowrap" }}>
          <input style={field} value={typed} placeholder="Yazarak sor…" onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
          <button style={btn} onClick={send}>Gönder</button>
        </div>
        <div style={row}>
          {level < 3 && <button style={btn} onClick={harder}>{level === 1 ? "Biraz daha ipucu" : "Tam çözümü göster"}</button>}
          <button style={btnP} onClick={() => finish(true)}>Çözdüm ✓</button>
          <button style={btn} onClick={() => finish(false)}>Anlamadım ✗</button>
        </div>
      </>}

      {phase === "done" && <>
        <p>{doneMsg}</p>
        <div style={row}>
          <button style={btnP} onClick={onNext}>Başka soru seç</button>
          <button style={btn} onClick={onClose}>Kapat</button>
        </div>
      </>}
    </div>
  );
}
