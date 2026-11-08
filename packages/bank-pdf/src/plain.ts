const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };

/** Düz metin ifadeyi yazdırılabilir hâle getirir: x^2 → x², sqrt( → √(, * → · */
export function pretty(s: string): string {
  return s
    .replace(/\^\{?(-?\d+)\}?/g, (_, d: string) => [...d].map((c) => SUP[c]).join(""))
    .replace(/sqrt\(/g, "√(")
    .replace(/\*/g, "·")
    .replace(/\bpi\b/g, "π");
}

export function latexToPlain(s: string): string {
  let t = s;
  for (let i = 0; i < 6; i++) {
    const n = t
      .replace(/\^\{([^{}]*)\}/g, (_, e: string) => (/^-?\d+$/.test(e) ? `^${e}` : `^(${e})`))
      .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)")
      .replace(/\\sqrt\{([^{}]*)\}/g, "√($1)");
    if (n === t) break;
    t = n;
  }
  t = t
    .replace(/\\left|\\right|\\,|\\!/g, "")
    .replace(/\\cdot/g, "·").replace(/\\times/g, "×").replace(/\\pi/g, "π")
    .replace(/\\Delta/g, "Δ").replace(/\\int/g, "∫")
    .replace(/_\{([^{}]*)\}/g, "_$1")
    .replace(/[{}]/g, "").replace(/\\([a-zA-Z]+)/g, "$1").replace(/\s+/g, " ").trim();
  return pretty(t);
}
