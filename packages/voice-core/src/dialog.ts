export type State = "idle" | "listening" | "thinking" | "speaking";
export type Actions = {
  interrupt(): void;          // sesi ve çizimi durdur
  resume(): void;             // yanlış alarm: yarım kalan cümleden devam
  student(text: string): void; // öğrenci cümlesi hazır
};

export function words(s: string): string[] {
  return s.toLocaleLowerCase("tr-TR").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
}

/** Duyulan metin, öğretmenin söylediği cümlenin yankısı mı? (en az 2 kelime) */
export function isEcho(heard: string, spoken: string): boolean {
  const h = words(heard);
  if (h.length < 2) return false;
  const s = new Set(words(spoken));
  return h.filter((w) => s.has(w)).length / h.length >= 0.6;
}

export class DialogMachine {
  state: State = "idle";
  private finals: string[] = [];
  private interim = "";
  private voice = false;
  private lastVoiceAt = 0;
  private spoken = "";
  private wasSpeaking = false;

  constructor(private act: Actions, private o = { settleMs: 900, noiseMs: 1500 }) {}

  private text() { return [...this.finals, this.interim].join(" ").trim(); }
  private clear() { this.finals = []; this.interim = ""; }

  private enterListening(now: number) {
    this.wasSpeaking = this.state === "speaking";
    if (this.wasSpeaking) {
      this.act.interrupt();
      // Araya girmeden önce biriken yankı metnini at
      this.finals = this.finals.filter((f) => !isEcho(f, this.spoken));
      if (isEcho(this.interim, this.spoken)) this.interim = "";
    }
    this.state = "listening";
    this.lastVoiceAt = now;
  }

  /** TTS bir cümleye başladı. */
  teacherSpeaking(sentence: string) {
    if (this.state === "listening") return; // öğrenci konuşuyor, bayat olay
    this.state = "speaking";
    this.spoken = sentence;
    this.clear();
  }
  teacherDone() { if (this.state === "speaking") this.state = "idle"; }
  /** Cevap alınamadı (ağ hatası vb.) */
  fail() { if (this.state === "thinking") this.state = "idle"; }

  vadStart(now: number) {
    this.voice = true;
    if (this.state === "thinking") return; // MVP: cevap beklerken araya girme yok
    if (this.state !== "listening") this.enterListening(now);
    this.lastVoiceAt = now;
  }
  vadEnd(now: number) {
    this.voice = false;
    this.lastVoiceAt = now;
    this.tryCommit(now);
  }
  /** VAD çalışmazsa (ör. Android'de mikrofon çakışması) STT tek başına da araya girmeyi yakalar. */
  sttInterim(t: string, now: number) {
    this.interim = t;
    if (this.state === "speaking" && words(t).length >= 2 && !isEcho(t, this.spoken)) this.enterListening(now);
    if (this.state === "listening" && !this.voice) this.lastVoiceAt = now;
  }
  sttFinal(t: string, now: number) {
    this.finals.push(t);
    this.interim = "";
    this.tryCommit(now);
  }
  tick(now: number) {
    if (this.state !== "listening" || this.voice) return;
    if (this.text()) this.tryCommit(now);
    else if (now - this.lastVoiceAt >= this.o.noiseMs) this.fallBack();
  }

  private tryCommit(now: number) {
    if (this.state !== "listening" || this.voice) return;
    const t = this.text();
    if (!t) return;
    if (this.interim === "" || now - this.lastVoiceAt >= this.o.settleMs) this.commit(t);
  }
  private commit(t: string) {
    this.clear();
    if (isEcho(t, this.spoken)) return this.fallBack();
    this.state = "thinking";
    this.act.student(t);
  }
  private fallBack() {
    this.clear();
    if (this.wasSpeaking) { this.state = "speaking"; this.act.resume(); }
    else this.state = "idle";
  }
}
