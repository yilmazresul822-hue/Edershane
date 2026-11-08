export type VadEvent = "start" | "end";
export type DetectorOptions = {
  frameMs?: number;   // RMS çerçeve süresi (20)
  startMs?: number;   // bu kadar sürekli yüksek ses → başladı (200)
  endMs?: number;     // bu kadar sessizlik → bitti (500)
  ratio?: number;     // eşik = gürültü tabanı × oran (3)
  minRms?: number;    // mutlak alt eşik (0.012)
  onEvent: (e: VadEvent) => void;
};

export class SpeechDetector {
  floor = 0.004;
  active = false;
  /** Öğretmen konuşurken true: eşik yükselir, yankıdan yanlış tetikleme azalır. */
  strict = false;
  private above = 0;
  private below = 0;
  constructor(private o: DetectorOptions) {}

  get threshold() {
    const base = Math.max(this.floor * (this.o.ratio ?? 3), this.o.minRms ?? 0.012);
    return base * (this.strict ? 1.6 : 1);
  }

  push(rms: number) {
    const f = this.o.frameMs ?? 20;
    const loud = rms > this.threshold;
    if (!this.active) {
      if (!loud) this.floor = Math.min(0.05, this.floor * 0.98 + rms * 0.02);
      this.above = loud ? this.above + f : 0;
      if (this.above >= (this.o.startMs ?? 200)) {
        this.active = true; this.above = 0; this.below = 0;
        this.o.onEvent("start");
      }
    } else {
      this.below = loud ? 0 : this.below + f;
      if (this.below >= (this.o.endMs ?? 500)) {
        this.active = false; this.below = 0;
        this.o.onEvent("end");
      }
    }
  }
}
