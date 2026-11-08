import { useEffect, useRef } from "react";
import type { BoardPlayer, Op } from "@edershane/board-player";

const COLORS = { ink: "#1b1f3b", yellow: "#ffd400", green: "#2fbf71", red: "#e5484d", blue: "#2f6fed" };
type View = { scrollX: number; scrollY: number; zoom: number };
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const jitter = (s: string) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return (h % 1000) / 1000; };
const penTip = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = "#ff5a36";
  ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill(); ctx.restore();
};

function drawOp(ctx: CanvasRenderingContext2D, op: Op, t: number) {
  if (t < op.start) return;
  let alpha = 1;
  if (op.end !== undefined) {
    if (t >= op.end + 300) return;
    if (t > op.end) alpha = 1 - (t - op.end) / 300;
  }
  const raw = (t - op.start) / op.dur;
  const p = clamp(raw);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = ctx.lineJoin = "round";

  if (op.kind === "path") {
    ctx.globalAlpha *= op.alpha ?? 1;
    ctx.strokeStyle = COLORS[op.color];
    ctx.lineWidth = op.width ?? 3;
    if (op.dashed) ctx.setLineDash([8, 6]);
    const lens = op.pts.slice(1).map((q, i) => Math.hypot(q.x - op.pts[i].x, q.y - op.pts[i].y));
    let remain = lens.reduce((a, b) => a + b, 0) * ease(p);
    let cur = op.pts[0], prev = op.pts[0];
    ctx.beginPath(); ctx.moveTo(cur.x, cur.y);
    for (let i = 0; i < lens.length; i++) {
      const a = op.pts[i], b = op.pts[i + 1];
      if (remain >= lens[i]) { ctx.lineTo(b.x, b.y); prev = a; cur = b; remain -= lens[i]; }
      else { const f = lens[i] ? remain / lens[i] : 0; prev = a; cur = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }; ctx.lineTo(cur.x, cur.y); break; }
    }
    ctx.stroke();
    if (op.arrowHead && p >= 1) {
      const ang = Math.atan2(cur.y - prev.y, cur.x - prev.x);
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(cur.x, cur.y);
        ctx.lineTo(cur.x - 10 * Math.cos(ang + s * 0.45), cur.y - 10 * Math.sin(ang + s * 0.45)); ctx.stroke();
      }
    }
    if (p < 1) penTip(ctx, cur.x, cur.y);
  } else if (op.kind === "text") {
    ctx.font = `500 ${op.size}px Caveat, "Segoe Print", cursive`;
    ctx.fillStyle = COLORS[op.color];
    ctx.textBaseline = "alphabetic";
    const n = op.text.length * p;
    const baseY = op.box.y + op.box.h * 0.8;
    let tipX = op.box.x;
    for (let i = 0; i < Math.ceil(n); i++) {
      const q = Math.min(1, n - i);
      const x = op.box.x + ctx.measureText(op.text.slice(0, i)).width;
      ctx.save();
      ctx.globalAlpha = alpha * q;
      ctx.translate(x, baseY + (1 - q) * 4);
      ctx.rotate((jitter(op.cmdId + i) - 0.5) * 0.08);
      ctx.fillText(op.text[i], 0, 0);
      ctx.restore();
      tipX = x + ctx.measureText(op.text[i]).width;
    }
    if (p > 0 && p < 1) penTip(ctx, tipX, baseY - op.size * 0.3);
  } else if (op.kind === "ring") {
    ctx.strokeStyle = COLORS[op.color]; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(op.at.x, op.at.y, op.r, -Math.PI / 2, -Math.PI / 2 + p * 2 * Math.PI); ctx.stroke();
  } else if (op.kind === "laser" && raw <= 1) {
    ctx.fillStyle = "#ff2d2d"; ctx.shadowColor = "#ff2d2d"; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(op.at.x, op.at.y, 6 + 3 * Math.sin(t / 90), 0, 7); ctx.fill();
  }
  ctx.restore();
}

export function AiLayer({ player, getView }: { player: BoardPlayer; getView: () => View }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr;
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(c);
    document.fonts?.load("500 24px Caveat");
    let raf = 0;
    const frame = () => {
      const dpr = window.devicePixelRatio || 1;
      const v = getView();
      const k = v.zoom * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.setTransform(k, 0, 0, k, v.scrollX * k, v.scrollY * k); // sahne → ekran
      const t = player.clock.now();
      for (const op of player.ops) drawOp(ctx, op, t);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [player, getView]);

  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 4 }} />;
}
