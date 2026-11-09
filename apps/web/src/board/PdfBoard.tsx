import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Excalidraw, convertToExcalidrawElements, viewportCoordsToSceneCoords } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { BoardPlayer } from "@edershane/board-player";
import { AiLayer } from "../teacher/AiLayer";
import { LassoOverlay, type Selection } from "./LassoOverlay";
import { btn, btnP } from "../ui";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
const SCALE = 2, GAP = 28, MAX_PAGES = 40, PAGE_W = 595, PAGE_H = 842;

export type StartSpec = { kind: "pdf"; file: File } | { kind: "sayfali" } | { kind: "sonsuz" };
type Pg = { y0: number; w: number; h: number; pdf?: any; bmp?: ImageBitmap; id?: string };
export type BoardHandle = {
  openFile(): void;
  freeOrigin(): { x: number; y: number };
  focus(x: number, y: number): void;
};
type Props = {
  player: BoardPlayer | null;
  selecting: boolean;
  start: StartSpec;
  onQuestion(cropJpeg: string, text: string, at: { x: number; y: number }): void;
};

function toJpeg(src: HTMLCanvasElement, max = 900) {
  const k = Math.min(1, max / Math.max(src.width, src.height));
  const o = document.createElement("canvas");
  o.width = Math.max(1, Math.round(src.width * k)); o.height = Math.max(1, Math.round(src.height * k));
  o.getContext("2d")!.drawImage(src, 0, 0, o.width, o.height);
  return o.toDataURL("image/jpeg", 0.75);
}

async function renderPage(p: Pg): Promise<HTMLCanvasElement> {
  const cv = document.createElement("canvas");
  cv.width = Math.round(p.w * SCALE); cv.height = Math.round(p.h * SCALE);
  const ctx = cv.getContext("2d")!;
  if (p.pdf) await p.pdf.render({ canvasContext: ctx, viewport: p.pdf.getViewport({ scale: SCALE }) }).promise;
  else if (p.bmp) ctx.drawImage(p.bmp, 0, 0, cv.width, cv.height);
  return cv;
}

/** Çizgili defter sayfası (krem kâğıt, mavi çizgiler, kırmızı kenar boşluğu çizgisi). */
async function ruledPage(): Promise<ImageBitmap> {
  const c = document.createElement("canvas");
  c.width = PAGE_W * SCALE; c.height = PAGE_H * SCALE;
  const x = c.getContext("2d")!;
  x.scale(SCALE, SCALE);
  x.fillStyle = "#fbf6e8"; x.fillRect(0, 0, PAGE_W, PAGE_H);
  x.strokeStyle = "#b9d3e6"; x.lineWidth = 1;
  for (let y = 70; y < PAGE_H - 30; y += 28) { x.beginPath(); x.moveTo(0, y); x.lineTo(PAGE_W, y); x.stroke(); }
  x.strokeStyle = "#e29a9a"; x.beginPath(); x.moveTo(76, 0); x.lineTo(76, PAGE_H); x.stroke();
  return createImageBitmap(c);
}

export const PdfBoard = forwardRef<BoardHandle, Props>(function PdfBoard({ player, selecting, start, onQuestion }, ref) {
  const api = useRef<any>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const fileIn = useRef<HTMLInputElement>(null);
  const pages = useRef<Pg[]>([]);
  const right = useRef(0);
  const started = useRef(false);
  const initial = useRef({ appState: { viewBackgroundColor: "#f3f1ea", gridModeEnabled: start.kind === "sonsuz" } });
  const [msg, setMsg] = useState("");
  const [count, setCount] = useState(0);
  const [cur, setCur] = useState(0);
  const [flip, setFlip] = useState({ n: 0, dir: 1 });
  const spiral = start.kind !== "sonsuz";

  useImperativeHandle(ref, () => ({
    openFile: () => fileIn.current?.click(),
    freeOrigin: () => ({ x: right.current, y: 0 }),
    // Excalidraw: ekran = (sahne + scroll) × zoom
    focus: (x, y) => {
      const z = api.current?.getAppState().zoom.value ?? 1;
      api.current?.updateScene({ appState: { scrollX: 24 / z - x, scrollY: 24 / z - y } });
    },
  }));

  const getView = () => {
    const s = api.current.getAppState();
    return { scrollX: s.scrollX, scrollY: s.scrollY, zoom: s.zoom.value };
  };

  function onApi(a: any) {
    api.current = a;
    if (started.current || !a) return;
    started.current = true;
    if (start.kind === "pdf") void loadFile(start.file);
    else if (start.kind === "sayfali") void newPage(true);
  }

  /** Sayfaları sahneye ekler (replace: mevcut sahneyi baştan kurar). */
  async function addPages(list: Pg[], replace: boolean) {
    const base = replace ? [] : pages.current;
    let y = base.length ? base[base.length - 1].y0 + base[base.length - 1].h + GAP : 0;
    const tag = `f${Date.now()}`;
    const files: any[] = [], skel: any[] = [];
    for (const [i, p] of list.entries()) {
      p.y0 = y; y += p.h + GAP;
      const cv = await renderPage(p);
      files.push({ id: `${tag}_${i}`, mimeType: "image/jpeg", dataURL: cv.toDataURL("image/jpeg", 0.85), created: Date.now() });
      cv.width = cv.height = 0; // belleği hemen bırak
      skel.push({ type: "image", fileId: `${tag}_${i}`, x: 0, y: p.y0, width: p.w, height: p.h, locked: true, status: "saved" });
    }
    api.current.addFiles(files);
    const els = convertToExcalidrawElements(skel as any);
    list.forEach((p, i) => (p.id = els[i].id));
    const existing = replace ? [] : api.current.getSceneElements();
    api.current.updateScene({ elements: [...existing, ...els] });
    pages.current = [...base, ...list];
    right.current = Math.max(...pages.current.map((p) => p.w)) + 60;
    setCount(pages.current.length);
    return els;
  }

  function scrollToPage(i: number) {
    const p = pages.current[i];
    const el = p && api.current.getSceneElements().find((e: any) => e.id === p.id);
    if (el) api.current.scrollToContent([el], { fitToViewport: true });
  }

  async function newPage(first = false) {
    try {
      const bmp = await ruledPage();
      await addPages([{ y0: 0, w: PAGE_W, h: PAGE_H, bmp }], first);
      const idx = pages.current.length - 1;
      if (first) { setCur(0); scrollToPage(0); } else go(idx);
    } catch (e) { console.error(e); setMsg("Sayfa eklenemedi."); }
  }

  /** Sayfa çevirme: kâğıt yaprağı döner, ortasında sahne yeni sayfaya kayar. */
  function go(i: number) {
    const n = pages.current.length;
    if (i < 0 || i >= n || i === cur) return;
    setFlip((f) => ({ n: f.n + 1, dir: i > cur ? 1 : -1 }));
    setTimeout(() => { scrollToPage(i); setCur(i); }, 380);
  }

  async function loadFile(file: File) {
    try {
      setMsg("Açılıyor…");
      const list: Pg[] = [];
      if (file.type === "application/pdf") {
        const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
        for (let i = 1; i <= Math.min(doc.numPages, MAX_PAGES); i++) {
          const pdf = await doc.getPage(i);
          const vp = pdf.getViewport({ scale: 1 });
          list.push({ y0: 0, w: vp.width, h: vp.height, pdf });
        }
        if (doc.numPages > MAX_PAGES) setMsg(`İlk ${MAX_PAGES} sayfa açıldı.`);
      } else if (file.type.startsWith("image/")) {
        const bmp = await createImageBitmap(file);
        list.push({ y0: 0, w: 1000, h: (bmp.height * 1000) / bmp.width, bmp });
      } else return setMsg("Yalnızca PDF veya resim açılır.");

      const els = await addPages(list, true);
      setCur(0);
      api.current.scrollToContent(els.slice(0, 1), { fitToViewport: true });
      setMsg((m) => (m === "Açılıyor…" ? "" : m));
    } catch (e) { console.error(e); setMsg("Dosya açılamadı."); }
  }

  async function handleSelect(sel: Selection) {
    const list = pages.current;
    if (!list.length) return setMsg("Önce bir PDF veya resim aç.");
    try {
      const st = api.current.getAppState();
      const r = wrap.current!.getBoundingClientRect();
      const toScene = (x: number, y: number) => viewportCoordsToSceneCoords({ clientX: r.left + x, clientY: r.top + y }, st);
      const a = toScene(sel.bbox.x, sel.bbox.y), b = toScene(sel.bbox.x + sel.bbox.w, sel.bbox.y + sel.bbox.h);
      const cy = (a.y + b.y) / 2;
      const p = list.find((q) => cy >= q.y0 && cy <= q.y0 + q.h) ??
        list.reduce((m, q) => (Math.abs(cy - (q.y0 + q.h / 2)) < Math.abs(cy - (m.y0 + m.h / 2)) ? q : m));
      const x0 = Math.max(0, a.x), y0 = Math.max(0, a.y - p.y0), x1 = Math.min(p.w, b.x), y1 = Math.min(p.h, b.y - p.y0);
      if (x1 - x0 < 10 || y1 - y0 < 10) return setMsg("Seçim sayfanın dışında kaldı.");

      const full = await renderPage(p);
      const crop = document.createElement("canvas");
      crop.width = Math.round((x1 - x0) * SCALE); crop.height = Math.round((y1 - y0) * SCALE);
      crop.getContext("2d")!.drawImage(full, x0 * SCALE, y0 * SCALE, crop.width, crop.height, 0, 0, crop.width, crop.height);
      full.width = full.height = 0;

      let text = "";
      if (p.pdf) { // Kademe 1: metin katmanı, OCR gerekmez
        const vp = p.pdf.getViewport({ scale: 1 });
        const tc = await p.pdf.getTextContent();
        text = tc.items.filter((it: any) => {
          if (!("str" in it)) return false;
          const [tx, ty] = vp.convertToViewportPoint(it.transform[4], it.transform[5]);
          return tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1;
        }).map((it: any) => it.str).join(" ").replace(/\s+/g, " ").trim();
      }
      setMsg("");
      onQuestion(toJpeg(crop), text, { x: right.current, y: a.y });
    } catch (e) { console.error(e); setMsg("Seçim okunamadı."); }
  }

  return (
    <div ref={wrap} style={{ position: "fixed", inset: 0, left: spiral ? 26 : 0 }}>
      <Excalidraw excalidrawAPI={onApi} initialData={initial.current} />
      {player && <AiLayer player={player} getView={getView} />}
      {selecting && <LassoOverlay onSelect={handleSelect} />}
      {flip.n > 0 && <div className="p-leafstage"><div key={flip.n} className={"p-leaf " + (flip.dir > 0 ? "fwd" : "back")} /></div>}
      {count > 0 && (
        <div className="p-pages">
          <button style={btn} disabled={cur === 0} onClick={() => go(cur - 1)}>▲</button>
          <b style={{ font: "800 19px var(--cond)" }}>{cur + 1}/{count}</b>
          <button style={btn} disabled={cur >= count - 1} onClick={() => go(cur + 1)}>▼</button>
          <button style={btnP} onClick={() => void newPage(false)}>+ Sayfa</button>
        </div>
      )}
      <input ref={fileIn} type="file" accept="application/pdf,image/*" hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void loadFile(f); }} />
      {msg && <div style={{ position: "absolute", top: 56, left: 8, zIndex: 10, background: "#f7e04b", padding: "6px 12px", fontWeight: 600, fontSize: 15, boxShadow: "0 3px 8px rgba(0,0,0,.3)" }}>{msg}</div>}
      {spiral && <div className="p-spiral" style={{ left: -26 }} />}
    </div>
  );
});
