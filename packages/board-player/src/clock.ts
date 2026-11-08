/** Duraklatılabilir oynatma saati. Barge-in = pause(), devam = play(). */
export class PlaybackClock {
  private base = 0;
  private startedAt: number | null = null;
  constructor(private time: () => number = () => performance.now()) {}

  get playing() { return this.startedAt !== null; }
  now(): number { return this.base + (this.startedAt === null ? 0 : this.time() - this.startedAt); }
  play() { if (this.startedAt === null) this.startedAt = this.time(); }
  pause() { if (this.startedAt !== null) { this.base = this.now(); this.startedAt = null; } }
  seek(ms: number) { this.base = ms; if (this.startedAt !== null) this.startedAt = this.time(); }
  /** Ses saatiyle eşitleme: fark toleransı aşarsa saati ses saatine çeker. */
  sync(audioMs: number, tolerance = 120) { if (Math.abs(this.now() - audioMs) > tolerance) this.seek(audioMs); }
}
