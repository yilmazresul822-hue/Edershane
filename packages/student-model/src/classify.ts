export type HataTipi = "kavram" | "islem" | "dikkat" | "sure";
export type Siniflama = { tip: HataTipi; guven: "dusuk" | "orta"; neden: string };
export type Tuzak = { cevap: string; ad: string }; // ör. {cevap:"3", ad:"apsis-ordinat karıştırma"}

const num = (s?: string) => {
  if (s == null) return null;
  const t = s.replace(/\s/g, "").replace(",", ".").replace(/[°%]$/, "");
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
};
const digits = (n: number) => String(Math.abs(n)).replace(".", "");
const nrm = (s: string) => s.replace(/\s/g, "").toLocaleLowerCase("tr-TR");

/** Yalnızca SON CEVABA bakar: sonuçlar tahmindir. Adım denetimi gelince kesinleşecek. */
export function classifyError(o: {
  given?: string; correct: string; sureSn?: number; beklenenSn?: number; tuzaklar?: Tuzak[];
}): Siniflama {
  const given = (o.given ?? "").trim();
  const slow = (k: number) => !!o.sureSn && !!o.beklenenSn && o.sureSn > k * o.beklenenSn;

  for (const t of o.tuzaklar ?? [])
    if (given && nrm(t.cevap) === nrm(given)) return { tip: "kavram", guven: "orta", neden: `Bilinen tuzak: ${t.ad}` };
  if (!given) {
    return slow(1.5)
      ? { tip: "sure", guven: "orta", neden: "Cevap boş, süre aşıldı" }
      : { tip: "kavram", guven: "dusuk", neden: "Cevap boş: başlangıç noktası bulunamamış olabilir" };
  }
  const g = num(given), c = num(o.correct);
  if (g !== null && c !== null && g !== c) {
    if (g === -c) return { tip: "dikkat", guven: "orta", neden: "İşaret hatası" };
    const gd = digits(g), cd = digits(c);
    if (gd.length === cd.length && gd !== cd && [...gd].sort().join("") === [...cd].sort().join(""))
      return { tip: "dikkat", guven: "orta", neden: "Rakamlar yer değiştirmiş" };
    if (c !== 0 && [10, 100, 0.1, 0.01].some((k) => Math.abs(g - c * k) < 1e-9 * Math.max(1, Math.abs(c * k))))
      return { tip: "dikkat", guven: "orta", neden: "Onluk basamak kayması" };
    if (Math.abs(Math.abs(g - c) - 1) < 1e-9)
      return { tip: "islem", guven: "dusuk", neden: "Cevap doğrudan 1 farklı" };
  }
  if (slow(2)) return { tip: "sure", guven: "dusuk", neden: "Beklenenin iki katından uzun sürdü" };
  return { tip: "kavram", guven: "dusuk", neden: "Bilinen hata kalıplarına uymuyor, adım denetimiyle netleşir" };
}
