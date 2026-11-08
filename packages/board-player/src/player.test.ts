import { describe, it, expect } from "vitest";
import { Compiler, PlaybackClock, SceneInit } from "./index";

const init: SceneInit = {
  points: { A: { x: 200, y: 400 }, B: { x: 120, y: 260 }, C: { x: 500, y: 400 } },
  segments: [["A", "B"], ["B", "C"], ["A", "C"]],
  bounds: { x: 0, y: 0, w: 1000, h: 700 },
  toScale: true,
  column: { x: 700, y: 100, w: 260, h: 500 },
};
const errors = (c: Compiler) => c.reports.filter((r) => r.level === "error");

describe("derleyici", () => {
  it("geniş açıda dikme: ayak kenarın dışında, kesikli uzantı çizilir", () => {
    const c = new Compiler(init);
    c.compile({ id: "c1", type: "construct_altitude", at_ms: 0, from: "B", onto: ["A", "C"], foot_label: "H" });
    expect(c.points.H.x).toBeCloseTo(120, 6);
    expect(c.points.H.y).toBeCloseTo(400, 6);
    expect(c.ops.some((o) => o.kind === "path" && o.dashed)).toBe(true);
    expect(errors(c)).toEqual([]);
  });
  it("bilinmeyen nokta reddedilir", () => {
    const c = new Compiler(init);
    c.compile({ id: "x", type: "label_point", at_ms: 0, target: "Z", text: "Z" });
    expect(errors(c).length).toBe(1);
    expect(c.ops.length).toBe(0);
  });
  it("şekille çelişen açı etiketi reddedilir", () => {
    const c = new Compiler(init);
    c.compile({ id: "m", type: "mark_angle", at_ms: 0, vertex: "A", rays: ["B", "C"], label: "80°" });
    expect(errors(c).length).toBe(1);
    expect(c.ops.length).toBe(0);
  });
  it("doğru açı etiketi kabul edilir", () => {
    const c = new Compiler(init);
    c.compile({ id: "m", type: "mark_angle", at_ms: 0, vertex: "A", rays: ["B", "C"], label: "120°" });
    expect(errors(c)).toEqual([]);
  });
  it("erase önceki komutun çizimlerini siler", () => {
    const c = new Compiler(init);
    c.compile({ id: "l", type: "label_point", at_ms: 0, target: "A", text: "A" });
    c.compile({ id: "e", type: "erase", at_ms: 3000, target: ["l"] });
    expect(c.ops[0].end).toBe(3000);
  });
  it("şema dışı komut düşer", () => {
    const c = new Compiler(init);
    c.compile({ id: "q", type: "teleport", at_ms: 0 });
    expect(errors(c).length).toBe(1);
  });
});

describe("saat", () => {
  it("duraklatınca zaman donar, devam edince kaldığı yerden sürer", () => {
    let t = 0;
    const clk = new PlaybackClock(() => t);
    clk.play(); t = 500; clk.pause(); t = 9000;
    expect(clk.now()).toBe(500);
    clk.play(); t = 9100;
    expect(clk.now()).toBe(600);
  });
});
