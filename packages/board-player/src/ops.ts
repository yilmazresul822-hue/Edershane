import type { Vec, Box } from "@edershane/geometry-core";

export type Color = "ink" | "yellow" | "green" | "red" | "blue";
type OpBase = {
  cmdId: string;
  start: number;   // ms, konuşma saatine göre
  dur: number;     // animasyon süresi
  end?: number;    // erase komutu gelince dolar, 300 ms solarak kaybolur
};
export type Op = OpBase & (
  | { kind: "path"; pts: Vec[]; color: Color; dashed?: boolean; width?: number; arrowHead?: boolean; alpha?: number }
  | { kind: "text"; text: string; box: Box; size: number; color: Color }
  | { kind: "ring"; at: Vec; r: number; color: Color }
  | { kind: "laser"; at: Vec }
);
