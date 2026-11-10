import { useEffect, useRef } from "react";
import { StrokeRenderer, drawPath, penSpec, strokeToCanvas, type PenId, type Pt, type Rendered } from "./pens";
import type { PenSound } from "./sound";

export type PenChoice = { id: PenId; color: string; size: number };
type View = { scrollX: number; scrollY: number; zoom: number };

/** Dokulu kalemlerle çizim katmanı. Çizgi bitince resme çevrilip Excalidraw'a eklenir (öğrenci taşıyabilir, silebilir). */
export function InkLayer({ pen, getView, sound, onCommit }: {
  pen: PenChoice; getView: () => View; sound: Pick<PenSound, "begin" | "move" | "end">; onCommit: (r: Rendered) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const st = useRef({ drawing: false, pts: [] as Pt[], seed: 1, sr: null as StrokeRenderer | null, lastPenAt: -1e9, lx: 0, ly: 0, lt: 0 });
  const penRef = useRef(pen); penRef.current = pen;

  useEffect(() => {
    const c = ref.current!;
    const fit = () => { const d = window.devicePixelRatio || 1; c.width = Math.max(1, c.clientWidth * d); c.height = Math.max(1, c.clientHeight * d); };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(c);
    return () => ro.disconnect();
  }, []);

  const ctxFor = () => {
    const c = ref.current!, ctx = c.getContext("2d")!, v = getView(), k = v.zoom * (window.devicePixelRatio || 1);
    ctx.setTransform(k, 0, 0, k, v.scrollX * k, v.scrollY * k);
    return { ctx, k };
  };
  const clear = () => { const c = ref.current!, ctx = c.getContext("2d")!; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); };
  const toScene = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect(), v = getView();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    return { x: sx / v.zoom - v.scrollX, y: sy / v.zoom - v.scrollY, sx, sy, w: r.width };
  };

  function down(e: React.PointerEvent) {
    const s = st.current, now = performance.now();
    if (e.pointerType === "touch" && now - s.lastPenAt < 3000) return;   // avuç içi reddi: kalem kullanılıyorsa parmağı yok say
    if (e.pointerType === "pen") s.lastPenAt = now;
    if (e.button !== undefined && e.button > 0) return;
    ref.current!.setPointerCapture(e.pointerId);
    const p = toScene(e);
    s.drawing = true; s.pts = []; s.seed = (Math.random() * 1e9) | 0; s.lx = p.sx; s.ly = p.sy; s.lt = e.timeStamp;
    clear();
    const { ctx, k } = ctxFor();
    const spec = penSpec(penRef.current.id);
    s.sr = spec.mode === "incremental" ? new StrokeRenderer(ctx, spec, penRef.current.color, penRef.current.size, s.seed, k) : null;
    const pt: Pt = { x: p.x, y: p.y, t: e.timeStamp, p: e.pointerType === "pen" ? e.pressure : undefined };
    s.pts.push(pt);
    if (s.sr) s.sr.add(pt); else drawPath(ctx, spec, penRef.current.color, penRef.current.size, s.pts);
    sound.begin(penRef.current.id, p.sx, p.w);
  }

  function move(e: React.PointerEvent) {
    const s = st.current;
    if (!s.drawing) return;
    const spec = penSpec(penRef.current.id);
    const evs: PointerEvent[] = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [];
    const list = evs.length ? evs : [e.nativeEvent as PointerEvent];
    let ctxk = ctxFor();
    for (const ev of list) {
      const p = toScene(ev);
      const dt = Math.max(1, ev.timeStamp - s.lt);
      const speed = Math.hypot(p.sx - s.lx, p.sy - s.ly) / dt;
      s.lx = p.sx; s.ly = p.sy; s.lt = ev.timeStamp;
      const pt: Pt = { x: p.x, y: p.y, t: ev.timeStamp, p: ev.pointerType === "pen" ? ev.pressure : undefined };
      s.pts.push(pt);
      if (s.sr) s.sr.add(pt);
      sound.move(p.sx, p.w, speed);
    }
    if (!s.sr) { clear(); ctxk = ctxFor(); drawPath(ctxk.ctx, spec, penRef.current.color, penRef.current.size, s.pts); } // fosforlu/keçeli: yolu baştan çiz
  }

  function up() {
    const s = st.current;
    if (!s.drawing) return;
    s.drawing = false;
    sound.end();
    const r = strokeToCanvas(penSpec(penRef.current.id), penRef.current.color, penRef.current.size, s.pts, s.seed);
    clear();
    s.sr = null;
    if (r) onCommit(r);
  }

  return <canvas ref={ref} data-testid="ink" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none", zIndex: 3, cursor: "crosshair" }}
    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />;
}
