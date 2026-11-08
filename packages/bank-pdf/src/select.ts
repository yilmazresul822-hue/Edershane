export type PoolQ = { id: string; kazanim_id: number };

/** Yanlışı çok olan kazanıma daha çok soru verir; daha önce görülenleri atlar. */
export function pickQuestions(
  mistakes: Record<number, number>, pool: Record<number, PoolQ[]>, seen: Set<string>, max = 30, perMax = 8,
): PoolQ[] {
  const ks = Object.keys(mistakes).map(Number).filter((k) => mistakes[k] > 0).sort((a, b) => mistakes[b] - mistakes[a]);
  const total = ks.reduce((s, k) => s + mistakes[k], 0);
  const avail = new Map(ks.map((k) => [k, (pool[k] ?? []).filter((q) => !seen.has(q.id))]));
  const got = new Map(ks.map((k) => [k, [] as PoolQ[]]));
  let n = 0;
  const take = (k: number, c: number) => {
    const a = avail.get(k)!, g = got.get(k)!;
    while (c-- > 0 && a.length && n < max && g.length < perMax) { g.push(a.shift()!); n++; }
  };
  for (const k of ks) take(k, Math.min(perMax, Math.max(1, Math.round((max * mistakes[k]) / total))));
  for (let r = 0; n < max && r < perMax; r++) for (const k of ks) take(k, 1); // artan yeri sırayla doldur
  return ks.flatMap((k) => got.get(k)!);
}
