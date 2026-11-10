import type { PenId } from "./pens";

/** Kalem sürtünme sesi: gürültü → band filtresi → ses seviyesi → STEREO konum. Konum ekranın x'ine göre sağ/sol hoparlöre kayar. */
export type Timbre = { type: BiquadFilterType; freq: number; q: number; gain: number; jitter: number };
export const TIMBRE: Record<PenId, Timbre> = {
  pencil:      { type: "bandpass", freq: 4200, q: 0.8, gain: 1.0, jitter: 0.22 },   // kuru, ince tırmalama
  fountain:    { type: "bandpass", freq: 2300, q: 0.55, gain: 0.5, jitter: 0.08 },  // yumuşak süzülme
  ballpoint:   { type: "bandpass", freq: 3000, q: 1.2, gain: 0.7, jitter: 0.15 },   // hafif cızırtı
  marker:      { type: "bandpass", freq: 1500, q: 0.6, gain: 0.75, jitter: 0.1 },   // keçe sürtünmesi
  highlighter: { type: "lowpass",  freq: 1100, q: 0.4, gain: 0.55, jitter: 0.05 },  // yumuşak, dolgun
};

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** x (piksel) → -0.92..0.92 stereo konumu */
export const panFor = (x: number, width: number) => clamp((x / Math.max(1, width)) * 2 - 1, -0.92, 0.92);
/** hız (piksel/ms) → ses seviyesi; durunca sessiz, hızlanınca artar, üst sınırlı */
export const gainFor = (id: PenId, speed: number) => (speed <= 0.01 ? 0 : clamp(0.012 + Math.min(speed, 3) * 0.045, 0, 0.2) * TIMBRE[id].gain);

export function noiseBuffer(ctx: BaseAudioContext, seconds = 2): AudioBuffer {
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = (w * 0.6 + last * 6); } // beyaz + biraz pembe
  return b;
}

export type PenGraph = {
  src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode; pan: StereoPannerNode;
  setPan(v: number): void; setGain(v: number, at?: number): void; setFreq(v: number): void;
};

/** Ses grafiği (gerçek ya da OfflineAudioContext ile çalışır: test edilebilsin diye ayrı). */
export function buildGraph(ctx: BaseAudioContext, id: PenId): PenGraph {
  const t = TIMBRE[id];
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx); src.loop = true;
  const filter = ctx.createBiquadFilter(); filter.type = t.type; filter.frequency.value = t.freq; filter.Q.value = t.q;
  const gain = ctx.createGain(); gain.gain.value = 0;
  const pan = ctx.createStereoPanner();
  src.connect(filter); filter.connect(gain); gain.connect(pan); pan.connect(ctx.destination);
  return {
    src, filter, gain, pan,
    setPan: (v) => { pan.pan.value = v; },
    setGain: (v, at) => gain.gain.setTargetAtTime(v, at ?? ctx.currentTime, 0.025),
    setFreq: (v) => { filter.frequency.value = v; },
  };
}

/** Kalem kağıda değince ve kalkarken kısa "tık". */
export function tick(ctx: BaseAudioContext, panV: number, loud = 0.12) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx, 0.05);
  const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1800; f.Q.value = 0.9;
  const g = ctx.createGain(); const p = ctx.createStereoPanner(); p.pan.value = panV;
  const t0 = ctx.currentTime;
  g.gain.setValueAtTime(loud, t0); g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.045);
  src.connect(f); f.connect(g); g.connect(p); p.connect(ctx.destination);
  src.start(t0); src.stop(t0 + 0.06);
}

export class PenSound {
  private ctx: AudioContext | null = null;
  private g: PenGraph | null = null;
  private id: PenId = "pencil";
  enabled = true;

  /** Kullanıcı dokunuşunda çağır (tarayıcılar sesi ancak o zaman açar). */
  begin(id: PenId, x: number, width: number) {
    if (!this.enabled) return;
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (this.ctx.state === "suspended") void this.ctx.resume();
      this.end(true);
      this.id = id;
      this.g = buildGraph(this.ctx, id);
      this.g.setPan(panFor(x, width));
      this.g.src.start();
      tick(this.ctx, panFor(x, width), 0.1);
    } catch { /* ses yoksa çizim devam eder */ }
  }
  move(x: number, width: number, speed: number) {
    if (!this.g || !this.ctx) return;
    const t = TIMBRE[this.id];
    this.g.setPan(panFor(x, width));
    this.g.setGain(gainFor(this.id, speed));
    this.g.setFreq(t.freq * (1 + (Math.random() - 0.5) * t.jitter * 2)); // tırmalama tane tane değişsin
  }
  end(silent = false) {
    if (!this.g || !this.ctx) return;
    const g = this.g; this.g = null;
    g.setGain(0);
    if (!silent) tick(this.ctx, g.pan.pan.value, 0.06);
    setTimeout(() => { try { g.src.stop(); } catch { /* zaten durdu */ } }, 150);
  }
}
