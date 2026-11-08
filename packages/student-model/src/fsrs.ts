// FSRS-4.5 yaklaşımı, varsayılan ağırlıklarla. Resmî uygulamayla satır satır karşılaştırılmadı.
export const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031,
  1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5, FACTOR = 19 / 81, DAY = 86_400_000;

export type Grade = 1 | 2 | 3 | 4; // 1 yanlış, 2 zor, 3 iyi, 4 kolay
export type Card = { s: number; d: number; lastMs: number };
export type Scheduled = Card & { dueMs: number; intervalDays: number };

const clampD = (d: number) => Math.min(10, Math.max(1, d));
const d0 = (g: Grade) => clampD(W[4] - (g - 3) * W[5]);
export const retrievability = (days: number, s: number) => Math.pow(1 + (FACTOR * days) / s, DECAY);
export const intervalFor = (s: number, r = 0.9) => (s / FACTOR) * (Math.pow(r, 1 / DECAY) - 1);

/** Soru sonucunu FSRS notuna çevirir. Tam çözümü gören öğrenci "yanlış" sayılır. */
export function gradeOf(dogru: boolean, ipucu: number, sureOrani: number): Grade {
  if (!dogru || ipucu >= 3) return 1;
  if (ipucu === 2) return 2;
  if (ipucu === 1) return 3;
  return sureOrani <= 0.6 ? 4 : sureOrani > 1.5 ? 2 : 3;
}

export function schedule(prev: Card | null, g: Grade, nowMs: number, retention = 0.9): Scheduled {
  let s: number, d: number;
  if (!prev) {
    s = W[g - 1]; d = d0(g);
  } else {
    const r = retrievability(Math.max(0, (nowMs - prev.lastMs) / DAY), prev.s);
    d = clampD(W[7] * d0(3) + (1 - W[7]) * (prev.d - W[6] * (g - 3)));
    if (g === 1) {
      s = Math.min(prev.s, W[11] * Math.pow(prev.d, -W[12]) * (Math.pow(prev.s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14]));
    } else {
      const hard = g === 2 ? W[15] : 1, easy = g === 4 ? W[16] : 1;
      s = prev.s * (1 + Math.exp(W[8]) * (11 - prev.d) * Math.pow(prev.s, -W[9]) * (Math.exp((1 - r) * W[10]) - 1) * hard * easy);
    }
  }
  s = Math.max(0.01, s);
  const iv = Math.min(365, Math.max(1 / 144, intervalFor(s, retention))); // en az 10 dk
  return { s, d, lastMs: nowMs, dueMs: nowMs + iv * DAY, intervalDays: iv };
}
