export const expected = (rs: number, rq: number) => 1 / (1 + Math.pow(10, (rq - rs) / 400));
/** Başlangıçta hızlı, sonra yavaş öğrenen K. */
export const kFactor = (n: number) => (n < 10 ? 40 : n < 30 ? 24 : 16);

/** Doğru cevap, kullanılan ipucuna göre kısmi puan alır (0..3). Bu katsayılar benim kalibrasyonum, beta'da ayarlanacak. */
export function eloScore(dogru: boolean, ipucu: number): number {
  if (!dogru) return 0;
  return [1, 0.7, 0.4, 0.1][Math.min(3, Math.max(0, ipucu))];
}

export function eloUpdate(rs: number, rq: number, score: number, n: number) {
  const e = expected(rs, rq);
  return { student: rs + kFactor(n) * (score - e), question: rq - 8 * (score - e) };
}
