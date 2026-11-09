import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { BoardPlayer } from "@edershane/board-player";
import type { SolverSpec } from "@edershane/teacher-core";
import { PdfBoard, type BoardHandle, type StartSpec } from "./board/PdfBoard";
import { Start } from "./Start";
import { SolvePanel, type SolveInput } from "./modes/SolvePanel";
import { LessonPanel } from "./modes/LessonPanel";
import { Notebook } from "./notebook/Notebook";
import { Admin } from "./admin/Admin";
import { Rapor } from "./report/Rapor";
import { Solver } from "./solver/client";
import { supabase } from "./lib/supabase";
import { getToken } from "./lib/api";
import { olc } from "./lib/olc";
import { abonelikDurumu, type AboneDurum } from "./lib/abonelik";
import { makeBooklet, download } from "./bank/booklet";
import { btn, btnP, card, row } from "./ui";

type Panel = "closed" | "menu" | "pick" | "solve" | "notebook" | "lesson" | "admin" | "rapor";
export type DeepLink = { spec: SolverSpec; text: string } | { notebook: true };

export function Main({ session, deepLink }: { session: Session; deepLink?: DeepLink }) {
  const board = useRef<BoardHandle>(null);
  const solver = useMemo(() => new Solver(), []);
  const [screen, setScreen] = useState<"start" | "board">(deepLink ? "board" : "start");
  const [startSpec, setStartSpec] = useState<StartSpec>({ kind: "sonsuz" });
  const [boardKey, setBoardKey] = useState(0);
  const [panel, setPanel] = useState<Panel>("closed");
  const [input, setInput] = useState<SolveInput | null>(null);
  const [player, setPlayer] = useState<BoardPlayer | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [sub, setSub] = useState<AboneDurum>("yukleniyor");
  const [rol, setRol] = useState<string>("ogrenci");
  const warmed = useRef(false);

  useEffect(() => {
    supabase.from("abonelik").select("durum,bitis,manuel_aktif").maybeSingle().then(({ data }) => setSub(abonelikDurumu(data as any)));
    supabase.from("profiles").select("rol").maybeSingle().then(({ data }) => setRol((data as any)?.rol ?? "ogrenci"));
    if (deepLink) {
      if ("notebook" in deepLink) setPanel("notebook");
      else { setInput({ kind: "spec", spec: deepLink.spec, text: deepLink.text, at: { x: 0, y: 0 } }); setPanel("solve"); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => { setPanel("closed"); setInput(null); setSelecting(false); };
  const pick = () => { setInput(null); setPanel("pick"); setSelecting(true); };
  const warm = () => {
    if (warmed.current) return;
    warmed.current = true;
    const t = performance.now();
    solver.warmup().then(() => olc("pyodide_ms", Math.round(performance.now() - t))).catch(() => { warmed.current = false; });
  };
  const solveSpec = (spec: SolverSpec, text: string) => {
    setInput({ kind: "spec", spec, text, at: board.current?.freeOrigin() ?? { x: 0, y: 0 } });
    setPanel("solve");
  };
  const begin = (spec: StartSpec) => { setPlayer(null); setStartSpec(spec); setBoardKey((k) => k + 1); setScreen("board"); };
  const home = () => { close(); setPlayer(null); setScreen("start"); };

  if (rol === "veli") {
    return <div><Rapor uid={session.user.id} veli onClose={() => supabase.auth.signOut()} /></div>;
  }

  const banner = sub === "veli_bekliyor" ? "Hesabın veli onayı bekliyor."
    : sub === "bitti" ? "Deneme süren bitti. Devam için abonelik gerekli." : "";
  const ok = sub === "aktif";
  const ad = (session.user.user_metadata?.ad as string | undefined) ?? "";

  return (
    <>
      {screen === "start" && (
        <Start ad={ad}
          onPdf={(file) => begin({ kind: "pdf", file })}
          onNotebook={(kind) => begin({ kind })}
          onWrongBook={() => setPanel("notebook")}
          onReport={() => setPanel("rapor")}
          onAdmin={rol === "admin" ? () => setPanel("admin") : undefined}
          onSignOut={() => supabase.auth.signOut()} />
      )}

      {screen === "board" && (
        <PdfBoard key={boardKey} ref={board} player={player} selecting={selecting} start={startSpec}
          onQuestion={(crop, text, at) => { if (panel === "pick") { setInput({ kind: "selection", crop, text, at }); setPanel("solve"); } }} />
      )}

      {screen === "board" && panel === "closed" && (
        <div style={{ position: "fixed", zIndex: 10, left: 8, right: 8, bottom: "calc(64px + env(safe-area-inset-bottom, 0px))", display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <button style={btn} onClick={home}>Ana ekran</button>
          <button style={btn} onClick={() => board.current?.openFile()}>Aç</button>
          <button style={btnP} onClick={() => { warm(); setPanel("menu"); }}>Kalem (YZ Öğretmen)</button>
          <button style={btn} onClick={() => setPanel("notebook")}>Defter</button>
          <button style={btn} onClick={() => setPanel("rapor")}>Rapor</button>
          {rol === "admin" && <button style={btn} onClick={() => setPanel("admin")}>Yönetici</button>}
        </div>
      )}

      {panel === "menu" && (
        <div style={card}>
          <b>YZ Öğretmen</b>
          {banner && <p>{banner}</p>}
          <div style={row}>
            <button style={btnP} disabled={!ok} onClick={pick}>Soru çözüm</button>
            <button style={btnP} disabled={!ok} onClick={() => setPanel("lesson")}>Konu anlatım</button>
            <button style={btn} onClick={close}>Kapat</button>
          </div>
        </div>
      )}

      {panel === "pick" && <div style={card}><p>Soruyu daire içine al.</p><div style={row}><button style={btn} onClick={close}>Vazgeç</button></div></div>}

      {panel === "solve" && input && (
        <SolvePanel input={input} solver={solver} board={board.current} onPlayer={setPlayer}
          onReadDone={() => setSelecting(false)} onNext={pick} onClose={close} />
      )}

      {panel === "lesson" && <LessonPanel board={board.current} onPlayer={setPlayer} onSolve={solveSpec} onClose={close} />}
      {panel === "admin" && <Admin onClose={close} />}
      {panel === "rapor" && <Rapor uid={session.user.id} veli={false} onClose={close} />}

      {panel === "notebook" && (
        <Notebook onClose={close}
          onRetry={(i) => { setInput({ kind: "notebook", id: i.id, spec: i.spec, text: i.text, at: board.current?.freeOrigin() ?? { x: 0, y: 0 } }); setPanel("solve"); }}
          onBooklet={async () => {
            download(await makeBooklet({
              supabaseUrl: import.meta.env.VITE_SUPABASE_URL, anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              getToken, baseUrl: location.origin, ogrenciAdi: ad || "Öğrenci",
            }));
          }} />
      )}
    </>
  );
}
