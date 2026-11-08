export class Speaker {
  onStart?: (i: number) => void;
  onEnd?: (i: number) => void;
  onDone?: () => void;
  hasTurkishVoice = true;
  private token = 0;
  private keep: SpeechSynthesisUtterance[] = []; // Chrome'da GC'ye karşı referans tut
  private voice: SpeechSynthesisVoice | null = null;

  constructor() {
    this.pick();
    speechSynthesis.addEventListener("voiceschanged", () => this.pick());
  }
  private pick() {
    const all = speechSynthesis.getVoices();
    const tr = all.filter((v) => v.lang.toLowerCase().startsWith("tr"));
    // Yerel ses: olayları daha güvenilir ve gecikmesi düşük
    this.voice = tr.find((v) => v.localService) ?? tr[0] ?? null;
    this.hasTurkishVoice = !!this.voice || all.length === 0;
  }

  /** texts[from..] cümlelerini sırayla okur; olaylardaki indeks texts'teki indekstir. */
  speak(texts: string[], from = 0) {
    this.cancel();
    const my = this.token;
    for (let i = from; i < texts.length; i++) {
      const u = new SpeechSynthesisUtterance(texts[i]);
      u.lang = "tr-TR"; u.rate = 1;
      if (this.voice) u.voice = this.voice;
      u.onstart = () => { if (my === this.token) this.onStart?.(i); };
      u.onend = () => {
        if (my !== this.token) return;
        this.onEnd?.(i);
        if (i === texts.length - 1) this.onDone?.();
      };
      this.keep.push(u);
      speechSynthesis.speak(u);
    }
  }
  cancel() { this.token++; this.keep = []; speechSynthesis.cancel(); }
}
