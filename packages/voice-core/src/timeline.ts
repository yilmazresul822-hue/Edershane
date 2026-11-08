export type Sentence = { id: string; text: string };
export type RawCommand = { id: string; at_ms: number; speech_ref?: string; [k: string]: unknown };

export const DEFAULT_MS_PER_CHAR = 65;
export const estimateMs = (text: string, msPerChar = DEFAULT_MS_PER_CHAR) =>
  Math.max(700, text.length * msPerChar);

/**
 * speech_ref varsa at_ms = o cümlenin başına göre ofset,
 * yoksa betiğin başına göre ofset. Sonuç: mutlak saat (ms).
 */
export function resolveCommands(
  sentences: Sentence[], commands: RawCommand[],
  opts: { base?: number; msPerChar?: number; gapMs?: number } = {}
) {
  const base = opts.base ?? 0;
  const gap = opts.gapMs ?? 250;
  const starts: number[] = [];
  const byId: Record<string, number> = {};
  let t = base;
  sentences.forEach((s, i) => {
    starts.push(t);
    byId[s.id] = i;
    t += estimateMs(s.text, opts.msPerChar) + gap;
  });
  const unresolved: string[] = [];
  const cmds = commands.map((c) => {
    if (c.speech_ref === undefined) return { ...c, at_ms: base + c.at_ms };
    const i = byId[c.speech_ref];
    if (i === undefined) { unresolved.push(c.id); return { ...c, at_ms: base + c.at_ms }; }
    return { ...c, at_ms: Math.round(starts[i] + c.at_ms) };
  });
  return { starts, cmds, unresolved, endMs: t };
}

export type ClockLike = {
  now(): number; seek(ms: number): void; play(): void; pause(): void; readonly playing: boolean;
};

/** TTS cümle olaylarıyla tahta saatini eşitler. */
export class SentenceSync {
  private idx = -1;
  constructor(private clock: ClockLike, private starts: number[]) {}

  onSentenceStart(i: number, rewind = true) {
    this.idx = i;
    if (rewind || this.clock.now() < this.starts[i]) this.clock.seek(this.starts[i]);
    this.clock.play();
  }
  /** Her ~50 ms çağrılır: cümle tahminden uzun sürdüyse saat sonraki cümlenin başında bekler. */
  tick() {
    const next = this.starts[this.idx + 1];
    if (this.idx >= 0 && next !== undefined && this.clock.playing && this.clock.now() >= next) {
      this.clock.seek(next - 1);
      this.clock.pause();
    }
  }
}
