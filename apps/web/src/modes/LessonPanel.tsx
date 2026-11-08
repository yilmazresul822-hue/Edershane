import { useEffect, useRef, useState } from "react";
import { BoardPlayer } from "@edershane/board-player";
import { LessonMachine, matchKazanim, type KazanimRow } from "@edershane/teacher-core";
import { TeacherSession, type Script } from "../voice/session";
import { apiPost } from "../lib/api";
import { supabase } from "../lib/supabase";
import { olc } from "../lib/olc";
import type { BoardHandle } from "../board/PdfBoard";
import { TestRunner, type TestResult } from "./TestRunner";
import { btn, btnP, card, field, row } from "../ui";

type Props = {
  board: BoardHandle | null;
  onPlayer(p: BoardPlayer | null): void;
  onSolve(spec: any, text: string): void;
  onClose(): void;
};
type Phase = "topic" | "chat" | "test" | "result";

export function LessonPanel({ board, onPlayer, onSolve, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("topic");
  const [list, setList] = useState<KazanimRow[] | null>(null);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<KazanimRow | null>(null);
  const [caption, setCaption] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [typed, setTyped] = useState("");
  const [can, setCan] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const session = useRef<TeacherSession | null>(null);
  const machine = useRef(new LessonMachine());
  const history = useRef<{ role: "student" | "teacher"; text: string }[]>([]);
  const sentences = useRef<{ id: string; text: string }[]>([]);
  const weak = useRef<string[]>([]);
  const player = useRef<BoardPlayer | null>(null);

  const stop = () => { session.current?.stop(); session.current = null; };
  useEffect(() => {
    supabase.from("kazanim").select("id,sinav,ders,konu,alt_konu,kazanim").order("id").limit(500)
      .then(({ data }) => setList((data as KazanimRow[]) ?? []));
    return () => { stop(); onPlayer(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function begin(k: KazanimRow, zayif?: string[]) {
    stop(); setPicked(k); setPhase("chat"); setErr(""); setNote(""); setCaption(""); setCan(false);
    const m = (machine.current = new LessonMachine());
    if (zayif) m.tekrarAnlat();
    weak.current = zayif ?? [];
    history.current = []; sentences.current = [];

    const at = board?.freeOrigin() ?? { x: 0, y: 0 };
    const p = (player.current = new BoardPlayer({
      points: {}, segments: [], bounds: { x: at.x, y: at.y, w: 1000, h: 700 }, toScale: true,
      column: { x: at.x + 40, y: at.y + 60, w: 920, h: 560 },
    }));
    onPlayer(p); board?.focus(at.x, at.y);

    const ask = async (text?: string): Promise<Script> => {
      const faz = text ? m.student(text) : m.faz === "anlatim" ? "anlatim" : "yoklama";
      const r = await apiPost("/konu/anlat", {
        kazanim_id: k.id, konu: k.kazanim, faz, history: history.current.slice(-12), studentSaid: text?.slice(0, 480),
        zayif: weak.current.length ? weak.current : undefined,
      });
      const script = r.script as Script;
      if (text) history.current.push({ role: "student", text: text.slice(0, 480) });
      history.current.push({ role: "teacher", text: script.sentences.map((s) => s.text).join(" ").slice(0, 480) });
      sentences.current = script.sentences;
      if (r.notsuz) { olc("notsuz_konu", 1, { kazanim: k.id }); setNote("Bu konu için ders notu yok; anlatım yapılamadı."); }
      else { setNote(""); m.teacher(); setCan(m.canTest); }
      p.clear();
      return script;
    };

    const s = new TeacherSession(p, ask);
    session.current = s;
    s.onLatency = (ms) => olc("gecikme_ms", ms);
    const orig = s.speaker.onStart;
    s.speaker.onStart = (i) => { orig?.(i); setCaption(sentences.current[i]?.text ?? ""); };
    try {
      try { await s.start(true); } catch { await s.start(false); setNote("Mikrofon kullanılamadı: aşağıdan yazarak cevap ver."); }
      p.play();
      s.say(await ask(undefined));
    } catch (e) { setErr((e as Error).message); }
  }

  function send() { const t = typed.trim(); if (t && session.current) { setTyped(""); void session.current.typed(t); } }
  function anladim() {
    if (!machine.current.anladim()) return;
    stop(); player.current?.clear(); setPhase("test");
  }
  function finished(r: TestResult) {
    machine.current.testBitti();
    weak.current = [...new Set(r.yanlislar.map((y) => y.zayif))].slice(0, 5);
    setResult(r); setPhase("result");
  }

  if (phase === "topic") {
    const hits = list ? matchKazanim(q, list) : [];
    return (
      <div style={card}>
        <b>Hangi konuyu çalışalım?</b>
        <input style={{ ...field, marginTop: 8 }} placeholder="Örn. ikinci dereceden denklemler" value={q} onChange={(e) => setQ(e.target.value)} />
        {list === null && <p>Konular yükleniyor…</p>}
        {q.trim() && hits.length === 0 && list && (
          <p>Bu konu için içerik bulamadım. Mevcut konular: {[...new Set(list.map((k) => k.alt_konu))].slice(0, 8).join(", ")}</p>
        )}
        <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
          {hits.map((k) => <button key={k.id} style={btn} onClick={() => begin(k)}>{k.ders}: {k.alt_konu}</button>)}
        </div>
        <div style={row}><button style={btn} onClick={onClose}>Kapat</button></div>
      </div>
    );
  }

  if (phase === "test" && picked) return <TestRunner kazanimId={picked.id} onDone={finished} onClose={onClose} />;

  if (phase === "result" && result && picked) {
    const oran = result.toplam ? result.dogru / result.toplam : 0;
    return (
      <div style={card}>
        <b>{result.dogru}/{result.toplam} doğru</b>
        <p>{oran >= 0.8 ? "Konu oturmuş görünüyor." : oran >= 0.6 ? "Fena değil, yanlışlara bakalım." : "Konuyu bir kez daha, zayıf noktalara odaklanarak anlatayım."}</p>
        {result.yanlislar.map((y, n) => (
          <div key={n} style={{ borderTop: "1px solid #e4e1d4", padding: "6px 0" }}>
            <div>{y.stem}</div>
            <div style={row}><button style={btn} onClick={() => onSolve(y.spec, y.stem)}>Tekrar çözelim</button></div>
          </div>
        ))}
        <div style={row}>
          {oran < 0.6 && <button style={btnP} onClick={() => begin(picked, weak.current)}>Tekrar anlat</button>}
          <button style={btn} onClick={onClose}>Bitir</button>
        </div>
      </div>
    );
  }

  return (
    <div style={card}>
      <small>{picked?.alt_konu}</small>
      <div style={{ minHeight: 44, fontSize: 17 }}>{err || caption || "Öğretmen hazırlanıyor…"}</div>
      {note && <small>{note}</small>}
      <div style={{ ...row, flexWrap: "nowrap" }}>
        <input style={field} value={typed} placeholder="Yazarak cevap ver…" onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button style={btn} onClick={send}>Gönder</button>
      </div>
      <div style={row}>
        {can && <button style={btnP} onClick={anladim}>Anladım, teste geç</button>}
        <button style={btn} onClick={onClose}>Çık</button>
      </div>
    </div>
  );
}
