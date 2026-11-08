import {
  Vec, Box, Obstacles, add, sub, mul, unit, dist, midpoint,
  altitude, angleDeg, rightAngleMarker, placeLabel,
} from "@edershane/geometry-core";
import { Command, validateCommand } from "@edershane/command-schema";
import type { Op, Color } from "./ops";

export type SceneInit = {
  points: Record<string, Vec>;
  segments: [string, string][];
  bounds: Box;
  /** Şekil ölçeğe uygun mu? Değilse etiket-açı karşılaştırması yapılmaz. */
  toScale: boolean;
  /** Çözüm sütunu (kilitli boş alan) */
  column?: Box;
};
export type Report = { cmdId: string; level: "error" | "warn"; msg: string };

const FS = 22;      // etiket yazı boyutu
const COL_FS = 26;  // çözüm sütunu yazı boyutu

function latexToPlain(s: string): string {
  return s
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)")
    .replace(/\\sqrt\{([^{}]*)\}/g, "√($1)")
    .replace(/\^\{([^{}]*)\}/g, "^$1")
    .replace(/\\cdot/g, "·").replace(/\\times/g, "×").replace(/\\pi/g, "π")
    .replace(/\\left|\\right/g, "").replace(/[{}]/g, "");
}

export class Compiler {
  points: Record<string, Vec>;
  ops: Op[] = [];
  reports: Report[] = [];
  private obstacles: Obstacles;
  private cursorY: number;

  constructor(private init: SceneInit) {
    this.points = { ...init.points };
    this.obstacles = {
      segments: init.segments.map(([a, b]) => [init.points[a], init.points[b]] as [Vec, Vec]),
      boxes: [],
      bounds: init.bounds,
    };
    this.cursorY = init.column?.y ?? 0;
  }

  resetColumn() { this.cursorY = this.init.column?.y ?? 0; }

  /** Temiz kopya modu: şeklin kenarlarını sırayla çizer. */
  drawFigure(start: number) {
    this.init.segments.forEach(([a, b], i) =>
      this.ops.push(this.path("figure", start + i * 350, 600, [this.points[a], this.points[b]], "ink")));
  }

  compile(raw: unknown): Op[] {
    const v = validateCommand(raw);
    if (!v.ok) {
      this.reports.push({ cmdId: (raw as any)?.id ?? "?", level: "error", msg: v.error });
      return [];
    }
    const before = this.ops.length;
    try {
      this.build(v.cmd);
    } catch (e) {
      this.report(v.cmd.id, "error", (e as Error).message);
      this.ops.length = before;
    }
    return this.ops.slice(before);
  }

  // ---- yardımcılar ----
  private report(cmdId: string, level: Report["level"], msg: string) { this.reports.push({ cmdId, level, msg }); }
  private P(ref: string): Vec {
    const p = this.points[ref];
    if (!p) throw new Error(`Bilinmeyen nokta: ${ref}`);
    return p;
  }
  private path(cmdId: string, start: number, dur: number, pts: Vec[], color: Color,
    extra: { dashed?: boolean; width?: number; arrowHead?: boolean; alpha?: number } = {}): Op {
    return { cmdId, start, dur, kind: "path", pts, color, ...extra };
  }
  private addSegs(...s: [Vec, Vec][]) { this.obstacles.segments.push(...s); }

  private label(cmdId: string, text: string, anchor: Vec, start: number, gap = 8) {
    const size = { w: Math.max(18, text.length * FS * 0.5 + 6), h: FS * 1.1 };
    const r = placeLabel(anchor, size, this.obstacles, gap);
    if (!r.ok) this.report(cmdId, "warn", `"${text}" etiketi çakışmasız yer bulamadı`);
    this.obstacles.boxes.push(r.box);
    const op: Op = { cmdId, start, dur: Math.max(200, text.length * 55), kind: "text", text, box: r.box, size: FS, color: "ink" };
    this.ops.push(op);
    return { op, box: r.box };
  }

  private rightMarker(cmdId: string, start: number, v: Vec, p1: Vec, p2: Vec) {
    const size = Math.min(14, 0.35 * Math.min(dist(v, p1), dist(v, p2)));
    const m = rightAngleMarker(v, p1, p2, size);
    this.addSegs([m[0], m[1]], [m[1], m[2]]);
    this.ops.push(this.path(cmdId, start, 300, m, "ink"));
  }

  // ---- komutlar ----
  private build(c: Command) {
    let t = c.at_ms;
    switch (c.type) {
      case "construct_altitude": {
        const p = this.P(c.from), a = this.P(c.onto[0]), b = this.P(c.onto[1]);
        const alt = altitude(p, a, b);
        if (dist(p, alt.foot) < 1e-6) throw new Error("Dikme uzunluğu sıfır: köşe kenarın üzerinde");
        const name = c.foot_label ?? "H";
        this.points[name] = alt.foot;
        if (alt.extension) {
          this.ops.push(this.path(c.id, t, 500, [...alt.extension], "ink", { dashed: true }));
          this.addSegs(alt.extension);
          t += 500;
        }
        this.ops.push(this.path(c.id, t, 600, [p, alt.foot], "blue"));
        this.addSegs([p, alt.foot]);
        t += 600;
        const far = dist(alt.foot, a) > dist(alt.foot, b) ? a : b;
        this.rightMarker(c.id, t, alt.foot, p, far);
        t += 300;
        this.label(c.id, name, alt.foot, t);
        break;
      }
      case "mark_angle": {
        const v = this.P(c.vertex), p1 = this.P(c.rays[0]), p2 = this.P(c.rays[1]);
        const ang = angleDeg(v, p1, p2);
        if (ang > 179) throw new Error("Düz açı işaretlenemez");
        const m = c.label?.match(/^(\d+(?:[.,]\d+)?)\s*°$/);
        if (m && this.init.toScale) {
          const n = parseFloat(m[1].replace(",", "."));
          if (Math.abs(n - ang) > 2) throw new Error(`Etiket ${n}° ama şekilde hesaplanan ${ang.toFixed(1)}°`);
        }
        if (Math.abs(ang - 90) < 0.5) { this.rightMarker(c.id, t, v, p1, p2); break; }
        const r = Math.min(26, 0.35 * Math.min(dist(v, p1), dist(v, p2)));
        const a1 = Math.atan2(p1.y - v.y, p1.x - v.x);
        let d = Math.atan2(p2.y - v.y, p2.x - v.x) - a1;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        const arc: Vec[] = Array.from({ length: 17 }, (_, i) => ({
          x: v.x + r * Math.cos(a1 + (d * i) / 16), y: v.y + r * Math.sin(a1 + (d * i) / 16),
        }));
        this.ops.push(this.path(c.id, t, 400, arc, "red"));
        for (let i = 0; i < 16; i++) this.addSegs([arc[i], arc[i + 1]]);
        const dir = unit(add(unit(sub(p1, v)), unit(sub(p2, v))));
        this.label(c.id, c.label ?? `${Math.round(ang)}°`, add(v, mul(dir, r + 16)), t + 400);
        break;
      }
      case "label_point":
        this.label(c.id, c.text, this.P(c.target), t);
        break;
      case "label_segment": {
        const a = this.P(c.segment[0]), b = this.P(c.segment[1]);
        this.label(c.id, c.text, midpoint(a, b), t);
        break;
      }
      case "highlight": {
        const color = (c.color ?? "yellow") as Color;
        if (c.target.length === 1) {
          this.ops.push({ cmdId: c.id, start: t, dur: 400, kind: "ring", at: this.P(c.target[0]), r: 14, color });
        } else {
          for (let i = 0; i < c.target.length - 1; i++) {
            this.ops.push(this.path(c.id, t, 500, [this.P(c.target[i]), this.P(c.target[i + 1])], color, { width: 9, alpha: 0.35 }));
            t += 500;
          }
        }
        break;
      }
      case "annotate": {
        const anchor = this.P(c.near);
        const { op, box } = this.label(c.id, c.text, anchor, t, 40);
        if (c.arrow) {
          const s: Vec = {
            x: Math.max(box.x, Math.min(anchor.x, box.x + box.w)),
            y: Math.max(box.y, Math.min(anchor.y, box.y + box.h)),
          };
          if (dist(s, anchor) > 14) {
            const e = sub(anchor, mul(unit(sub(anchor, s)), 8));
            this.ops.push(this.path(c.id, t + op.dur, 400, [s, e], "red", { arrowHead: true }));
            this.addSegs([s, e]);
          }
        }
        break;
      }
      case "write_latex": {
        const text = latexToPlain(c.latex);
        const w = text.length * COL_FS * 0.5 + 6;
        let box: Box;
        if (c.zone === "free_space_near" && c.near) {
          const r = placeLabel(this.P(c.near), { w, h: COL_FS * 1.1 }, this.obstacles, 30);
          if (!r.ok) this.report(c.id, "warn", "yazı için boş yer bulunamadı");
          box = r.box;
        } else {
          const col = this.init.column;
          if (!col) throw new Error("Çözüm sütunu tanımlı değil");
          if (this.cursorY + COL_FS * 1.4 > col.y + col.h) throw new Error("Çözüm sütunu doldu, yeni sayfa gerekli");
          if (w > col.w) this.report(c.id, "warn", "satır sütundan geniş");
          box = { x: col.x, y: this.cursorY, w, h: COL_FS * 1.1 };
          this.cursorY += COL_FS * 1.4;
        }
        this.obstacles.boxes.push(box);
        this.ops.push({ cmdId: c.id, start: t, dur: Math.max(300, text.length * 55), kind: "text", text, box, size: COL_FS, color: "ink" });
        break;
      }
      case "point_to":
        this.ops.push({ cmdId: c.id, start: t, dur: 1200, kind: "laser", at: this.P(c.target) });
        break;
      case "erase": {
        let n = 0;
        for (const o of this.ops) if (c.target.includes(o.cmdId) && o.end === undefined) { o.end = c.at_ms; n++; }
        if (!n) this.report(c.id, "warn", "silinecek komut bulunamadı");
        break;
      }
      case "plot_function":
        this.report(c.id, "warn", "plot_function henüz desteklenmiyor");
        break;
      case "pause":
        break; // zamanlama at_ms ile verilir
    }
  }
}
