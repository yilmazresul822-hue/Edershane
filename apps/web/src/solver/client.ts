import type { Ctx } from "../teacher/api";

export type SolverRequest =
  | { kind: "equation"; eq: string; var?: string }
  | { kind: "derivative"; expr: string; var?: string }
  | { kind: "integral"; expr: string; var?: string; a?: string; b?: string }
  | { kind: "triangle"; a: number | string; b: number | string; c: number | string; ask?: "angles" | "area" | "altitude"; vertex?: "A" | "B" | "C" };
export type Figure = { points: Record<string, { x: number; y: number }>; segments: [string, string][] };
export type SolverResult =
  | { ok: true; steps: { latex: string; note: string }[]; facts: string[]; answer: string; figure?: Figure }
  | { ok: false; error: string };

export class Solver {
  private w: Worker | null = null;
  private seq = 0;
  private warm = false;
  private pending = new Map<number, { ok: (r: SolverResult) => void; err: (e: Error) => void }>();

  private worker() {
    if (this.w) return this.w;
    const w = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e) => {
      const p = this.pending.get(e.data.id);
      if (!p) return;
      this.pending.delete(e.data.id);
      if (e.data.error) p.err(new Error(e.data.error)); else { this.warm = true; p.ok(e.data.res); }
    };
    return (this.w = w);
  }

  /** İlk çağrıda Pyodide + SymPy indirilir (büyük, tarayıcı önbelleğine alınır). Önceden ısıtmak için çağırın. */
  warmup() { return this.solve({ kind: "ping" } as any); }

  solve(req: SolverRequest, timeoutMs = this.warm ? 10_000 : 120_000): Promise<SolverResult> {
    return new Promise((ok, err) => {
      const id = ++this.seq;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.w?.terminate(); this.w = null; this.warm = false; // takılan çözücüyü öldür
        err(new Error("Çözücü zaman aşımına uğradı"));
      }, timeoutMs);
      this.pending.set(id, { ok: (r) => { clearTimeout(timer); ok(r); }, err: (e) => { clearTimeout(timer); err(e); } });
      this.worker().postMessage({ id, req });
    });
  }
}

/** Çözücü çıktısını /ogretmen/anlat gövdesine çevirir. */
export function toCtx(question: string, r: Extract<SolverResult, { ok: true }>, level: 1 | 2 | 3): Ctx {
  return { question, points: r.figure ? Object.keys(r.figure.points) : [], facts: r.facts,
    steps: r.steps.map((s) => ({ latex: s.latex, note: s.note })), answer: r.answer || undefined, level };
}
