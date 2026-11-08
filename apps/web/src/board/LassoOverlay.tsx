import { useEffect, useRef } from "react";

export type Pt = { x: number; y: number };
export type Selection = { bbox: { x: number; y: number; w: number; h: number }; path: Pt[] };

export function LassoOverlay({ onSelect }: { onSelect: (s: Selection) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const path = useRef<Pt[]>([]);
  const drawing = useRef(false);
  const done = useRef<{ path: Pt[]; t0: number } | null>(null);

  useEffect(() => {
    const c = ref.current!;
    const fit = () => { c.width = c.clientWidth; c.height = c.clientHeight; };
    fit();
    let raf = 0;
    const ctx = c.getContext("2d")!;
    const loop = (now: number) => {
      ctx.clearRect(0, 0, c.width, c.height);
      const p = done.current?.path ?? path.current;
      if (p.length > 1) {
        const pulse = done.current ? 0.5 + 0.5 * Math.sin((now - done.current.t0) / 120) : 1;
        if (done.current) { // seçilmeyen alan kararır
          ctx.fillStyle = "rgba(0,0,0,0.35)";
          ctx.beginPath();
          ctx.rect(0, 0, c.width, c.height);
          p.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
          ctx.closePath();
          ctx.fill("evenodd");
        }
        ctx.lineJoin = ctx.lineCap = "round";
        ctx.shadowColor = "#4da3ff";
        ctx.shadowBlur = 12 + 14 * pulse;
        ctx.strokeStyle = "#8fc7ff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        p.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        if (done.current) ctx.closePath();
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const pos = (e: React.PointerEvent): Pt => {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <canvas
      ref={ref}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none", zIndex: 5 }}
      onPointerDown={(e) => {
        ref.current!.setPointerCapture(e.pointerId);
        drawing.current = true; done.current = null; path.current = [pos(e)];
      }}
      onPointerMove={(e) => { if (drawing.current) path.current.push(pos(e)); }}
      onPointerUp={() => {
        drawing.current = false;
        const p = path.current;
        if (p.length < 8) { path.current = []; return; } // yanlışlıkla dokunuş
        const xs = p.map((q) => q.x), ys = p.map((q) => q.y);
        const x = Math.min(...xs), y = Math.min(...ys);
        const bbox = { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
        done.current = { path: [...p], t0: performance.now() };
        onSelect({ bbox, path: [...p] });
      }}
    />
  );
}
