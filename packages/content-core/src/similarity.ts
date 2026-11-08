const tok = (s: string) =>
  s.toLocaleLowerCase("tr-TR").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);

/** Adayın n'li kelime dizilerinin kaçı kaynakta da geçiyor? (0..1) */
export function overlapRatio(candidate: string, source: string, n = 4): number {
  const c = tok(candidate), s = tok(source);
  const set = new Set<string>();
  for (let i = 0; i + n <= s.length; i++) set.add(s.slice(i, i + n).join(" "));
  let hit = 0, tot = 0;
  for (let i = 0; i + n <= c.length; i++) { tot++; if (set.has(c.slice(i, i + n).join(" "))) hit++; }
  return tot ? hit / tot : 0;
}

/** En uzun ortak ardışık kelime dizisinin uzunluğu. */
export function longestCommonRun(a: string, b: string): number {
  const x = tok(a), y = tok(b);
  let best = 0;
  let prev: number[] = new Array(y.length + 1).fill(0);
  for (let i = 1; i <= x.length; i++) {
    const cur: number[] = new Array(y.length + 1).fill(0);
    for (let j = 1; j <= y.length; j++) {
      if (x[i - 1] === y[j - 1]) { cur[j] = prev[j - 1] + 1; if (cur[j] > best) best = cur[j]; }
    }
    prev = cur;
  }
  return best;
}

/** Eşikler sezgisel: beta'da gerçek notlarla ayarlanmalı. */
export function tooClose(candidate: string, source: string) {
  const o = overlapRatio(candidate, source), r = longestCommonRun(candidate, source);
  return { o, r, close: o > 0.2 || r >= 8 };
}
