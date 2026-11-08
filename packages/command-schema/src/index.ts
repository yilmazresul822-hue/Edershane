export type Ref = string;
type Base = { id: string; at_ms: number; speech_ref?: string };
export type Command = Base & (
  | { type: "construct_altitude"; from: Ref; onto: [Ref, Ref]; foot_label?: string }
  | { type: "mark_angle"; vertex: Ref; rays: [Ref, Ref]; label?: string }
  | { type: "label_point"; target: Ref; text: string }
  | { type: "label_segment"; segment: [Ref, Ref]; text: string }
  | { type: "highlight"; target: Ref[]; color?: "yellow" | "green" | "red" | "blue" }
  | { type: "annotate"; near: Ref; text: string; arrow?: boolean }
  | { type: "write_latex"; latex: string; zone: "solution_column" | "free_space_near"; near?: Ref }
  | { type: "plot_function"; expr: string; x_range?: [number, number] }
  | { type: "point_to"; target: Ref }
  | { type: "erase"; target: string[] }
  | { type: "pause"; ms: number }
);

export type Result = { ok: true; cmd: Command } | { ok: false; error: string };

const REF = /^[A-Za-z][A-Za-z0-9_]*$/;
const isRef = (v: unknown): v is string => typeof v === "string" && REF.test(v);
const isRefs = (v: unknown, min: number, max = 99) =>
  Array.isArray(v) && v.length >= min && v.length <= max && v.every(isRef);
const isStr = (v: unknown, max: number) => typeof v === "string" && v.length > 0 && v.length <= max;

/** 2B deki JSON Schema ile aynı kurallar, tip güvenli çalışma anı doğrulaması. */
export function validateCommand(raw: unknown): Result {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "Komut nesne değil" };
  const c = raw as Record<string, any>;
  if (typeof c.id !== "string" || !c.id) return { ok: false, error: "id eksik" };
  const bad = (m: string): Result => ({ ok: false, error: `${c.id}: ${m}` });
  if (!Number.isInteger(c.at_ms) || c.at_ms < 0) return bad("at_ms geçersiz");

  switch (c.type) {
    case "construct_altitude":
      if (!isRef(c.from) || !isRefs(c.onto, 2, 2)) return bad("from/onto geçersiz");
      if (c.foot_label !== undefined && !isStr(c.foot_label, 3)) return bad("foot_label geçersiz");
      break;
    case "mark_angle":
      if (!isRef(c.vertex) || !isRefs(c.rays, 2, 2)) return bad("vertex/rays geçersiz");
      if (c.label !== undefined && !isStr(c.label, 12)) return bad("label geçersiz");
      break;
    case "label_point":
      if (!isRef(c.target) || !isStr(c.text, 16)) return bad("target/text geçersiz");
      break;
    case "label_segment":
      if (!isRefs(c.segment, 2, 2) || !isStr(c.text, 16)) return bad("segment/text geçersiz");
      break;
    case "highlight":
      if (!isRefs(c.target, 1)) return bad("target geçersiz");
      if (c.color !== undefined && !["yellow", "green", "red", "blue"].includes(c.color)) return bad("color geçersiz");
      break;
    case "annotate":
      if (!isRef(c.near) || !isStr(c.text, 60)) return bad("near/text geçersiz");
      break;
    case "write_latex":
      if (!isStr(c.latex, 200) || !["solution_column", "free_space_near"].includes(c.zone)) return bad("latex/zone geçersiz");
      if (c.near !== undefined && !isRef(c.near)) return bad("near geçersiz");
      break;
    case "plot_function":
      if (!isStr(c.expr, 120)) return bad("expr geçersiz");
      break;
    case "point_to":
      if (!isRef(c.target)) return bad("target geçersiz");
      break;
    case "erase":
      if (!Array.isArray(c.target) || !c.target.every((x: unknown) => typeof x === "string")) return bad("target geçersiz");
      break;
    case "pause":
      if (!Number.isInteger(c.ms) || c.ms < 0 || c.ms > 5000) return bad("ms geçersiz");
      break;
    default:
      return bad(`bilinmeyen tür: ${String(c.type)}`);
  }
  return { ok: true, cmd: c as Command };
}
