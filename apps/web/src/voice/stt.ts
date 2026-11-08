export class Listener {
  onInterim?: (t: string) => void;
  onFinal?: (t: string) => void;
  onError?: (e: string) => void;
  private rec: any = null;
  private want = false;

  static get supported() {
    const w = window as any;
    return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
  }
  start() { this.want = true; this.spawn(); }
  stop() { this.want = false; this.rec?.abort(); this.rec = null; }

  private spawn() {
    const w = window as any;
    const R = w.SpeechRecognition || w.webkitSpeechRecognition;
    const rec = new R();
    rec.lang = "tr-TR"; rec.continuous = true; rec.interimResults = true;
    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0].transcript as string;
        if (r.isFinal) this.onFinal?.(t); else this.onInterim?.(t);
      }
    };
    rec.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") { this.want = false; this.onError?.(e.error); }
    };
    // Tarayıcı oturumu kendiliğinden kapatır (≈60 sn): yeniden başlat
    rec.onend = () => { if (this.want) setTimeout(() => this.want && this.spawn(), 250); };
    this.rec = rec;
    try { rec.start(); } catch { /* zaten başlamış */ }
  }
}
