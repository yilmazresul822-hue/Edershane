export type Cue = { sn: number; text: string };
export type Chunk = { baslangicSn: number; bitisSn: number; text: string };

// "[00:12:30] metin", "12:30 metin", "1:02:03 metin"; zaman damgasız satırlar öncekine eklenir
const TS = /^\s*\[?(?:(\d{1,2}):)?(\d{1,3}):(\d{2})\]?\s*[-–]?\s*(.*)$/;

export function parseTranscript(raw: string): Cue[] {
  const cues: Cue[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const m = TS.exec(t);
    if (m) {
      const sn = (m[1] ? Number(m[1]) * 3600 : 0) + Number(m[2]) * 60 + Number(m[3]);
      cues.push({ sn, text: m[4] });
    } else if (cues.length) cues[cues.length - 1].text += " " + t;
    else cues.push({ sn: 0, text: t });
  }
  return cues.map((c) => ({ sn: c.sn, text: c.text.trim() })).filter((c) => c.text);
}

function splitLong(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const parts: string[] = [];
  let cur = "";
  for (const s of text.match(/[^.!?]+[.!?]*\s*/g) ?? [text]) {
    for (let i = 0; i < s.length; i += max) {
      const piece = s.slice(i, i + max);
      if (cur && cur.length + piece.length > max) { parts.push(cur.trim()); cur = ""; }
      cur += piece;
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

/** Ardışık satırları ~maxChars karakter ve en çok maxSn saniyelik parçalara toplar. */
export function chunkCues(cues: Cue[], maxChars = 1800, maxSn = 420): Chunk[] {
  const out: Chunk[] = [];
  let cur: Chunk | null = null;
  for (const c of cues) {
    for (const piece of splitLong(c.text, maxChars)) {
      if (cur && (cur.text.length + 1 + piece.length > maxChars || c.sn - cur.baslangicSn > maxSn)) {
        out.push(cur);
        cur = null;
      }
      if (!cur) cur = { baslangicSn: c.sn, bitisSn: c.sn, text: piece };
      else { cur.text += " " + piece; cur.bitisSn = c.sn; }
    }
  }
  if (cur) out.push(cur);
  return out;
}

export const mmss = (sn: number) =>
  `${Math.floor(sn / 60)}:${String(Math.floor(sn % 60)).padStart(2, "0")}`;
