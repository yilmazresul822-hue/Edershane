export const LETTERS = "ABCDE";

export function wrap(text: string, maxW: number, measure: (s: string) => number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const w of para.split(/\s+/).filter(Boolean)) {
      const t = line ? line + " " + w : w;
      if (measure(t) <= maxW || !line) line = t; else { out.push(line); line = w; }
    }
    out.push(line);
  }
  return out;
}

export const keyCells = (qs: { dogruIndex: number }[]) => qs.map((q, i) => `${i + 1}-${LETTERS[q.dogruIndex]}`);
