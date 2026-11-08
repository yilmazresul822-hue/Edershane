import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Excalidraw, convertToExcalidrawElements, viewportCoordsToSceneCoords } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { BoardPlayer } from "@edershane/board-player";
import { AiLayer } from "../teacher/AiLayer";
import { LassoOverlay, type Selection } from "./LassoOverlay";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
const SCALE = 2, GAP = 24, MAX_PAGES = 40;

type Pg = { y0: number; w: number; h: number; pdf?: any; bmp?: ImageBitmap };
export type BoardHandle = {
  openFile(): void;
  freeOrigin(): { x: number; y: number };
  focus(x: number, y: number): void;
};
type Props = {
  player: BoardPlayer | null;
  selecting: boolean;
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

export const PdfBoard = forwardRef<BoardHandle, Props>(function PdfBoard({ player, selecting, onQuestion }, ref) {
  const api = useRef<any>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const fileIn = useRef<HTMLInputElement>(null);
  const pages = useRef<Pg[]>([]);
  const right = useRef(0);
  const [msg, setMsg] = useState("");

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

  async function loadFile(file: File) {
    try {
      setMsg("Açılıyor…");
      const list: Pg[] = [];
      if (file.type === "application/pdf") {
        const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
        let y = 0;
        for (let i = 1; i <= Math.min(doc.numPages, MAX_PAGES); i++) {
          const pdf = await doc.getPage(i);
          const vp = pdf.getViewport({ scale: 1 });
          list.push({ y0: y, w: vp.width, h: vp.height, pdf });
          y += vp.height + GAP;
        }
        if (doc.numPages > MAX_PAGES) setMsg(`İlk ${MAX_PAGES} sayfa açıldı.`);
      } else if (file.type.startsWith("image/")) {
        const bmp = await createImageBitmap(file);
        list.push({ y0: 0, w: 1000, h: (bmp.height * 1000) / bmp.width, bmp });
      } else return setMsg("Yalnızca PDF veya resim açılır.");

      const tag = `f${Date.now()}`;
      const files: any[] = [], skel: any[] = [];
      for (const [i, p] of list.entries()) {
        const cv = await renderPage(p);
        files.push({ id: `${tag}_${i}`, mimeType: "image/jpeg", dataURL: cv.toDataURL("image/jpeg", 0.85), created: Date.now() });
        cv.width = cv.height = 0; // belleği hemen bırak
        skel.push({ type: "image", fileId: `${tag}_${i}`, x: 0, y: p.y0, width: p.w, height: p.h, locked: true, status: "saved" });
      }
      api.current.addFiles(files);
      const els = convertToExcalidrawElements(skel as any);
      api.current.updateScene({ elements: els });
      pages.current = list;
      right.current = Math.max(...list.map((p) => p.w)) + 60;
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
    <div ref={wrap} style={{ position: "fixed", inset: 0 }}>
      <Excalidraw excalidrawAPI={(a: any) => (api.current = a)} />
      {player && <AiLayer player={player} getView={getView} />}
      {selecting && <LassoOverlay onSelect={handleSelect} />}
      <input ref={fileIn} type="file" accept="application/pdf,image/*" hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void loadFile(f); }} />
      {msg && <div style={{ position: "absolute", top: 56, left: 8, zIndex: 10, background: "#fffdf7", padding: "6px 10px", borderRadius: 8, fontFamily: "system-ui", fontSize: 14 }}>{msg}</div>}
    </div>
  );
});
