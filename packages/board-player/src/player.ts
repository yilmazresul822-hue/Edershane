import { Compiler, SceneInit } from "./compiler";
import { PlaybackClock } from "./clock";

export class BoardPlayer {
  readonly clock: PlaybackClock;
  readonly compiler: Compiler;
  onBargeIn?: () => void;

  constructor(init: SceneInit, opts: { drawFigure?: boolean; time?: () => number } = {}) {
    this.clock = new PlaybackClock(opts.time);
    this.compiler = new Compiler(init);
    if (opts.drawFigure) this.compiler.drawFigure(0);
  }
  get ops() { return this.compiler.ops; }
  get reports() { return this.compiler.reports; }

  /** Akışla gelen komutlar (SSE) geldikçe eklenir. */
  append(cmds: unknown[]) { cmds.forEach((c) => this.compiler.compile(c)); }
  play() { this.clock.play(); }
  /** Öğrenci konuşmaya başladı: saat durur, çizim olduğu yerde donar. */
  bargeIn() { this.clock.pause(); this.onBargeIn?.(); }
  /** Öğrenci konuyu değiştirdi: henüz başlamamış çizimleri at. */
  dropFuture() {
    const t = this.clock.now();
    this.compiler.ops = this.compiler.ops.filter((o) => o.start <= t);
  }
  /** Yeni soruya geçerken çağrılır: sütun baştan başlar. */
  newQuestion() { this.compiler.resetColumn(); }
  /** Yeni anlatım turu: görünen her şeyi söndür, çözüm sütununu başa al. */
  clear() {
    const t = this.clock.now();
    for (const o of this.compiler.ops) if (o.end === undefined) o.end = t;
    this.compiler.resetColumn();
  }
}
