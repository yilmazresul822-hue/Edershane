import type { BoardPlayer } from "@edershane/board-player";
import {
  DialogMachine, SentenceSync, SpeechDetector, resolveCommands, DEFAULT_MS_PER_CHAR,
  type Sentence, type RawCommand,
} from "@edershane/voice-core";
import { startMic } from "./mic";
import { Listener } from "./stt";
import { Speaker } from "./tts";

export type Script = { sentences: Sentence[]; commands: RawCommand[] };

export class TeacherSession {
  readonly speaker = new Speaker();
  onHeard?: (text: string) => void;
  onLatency?: (ms: number) => void;
  private listener = new Listener();
  private mic: { stop(): void } | null = null;
  private timer = 0;
  private sentences: Sentence[] = [];
  private sync: SentenceSync | null = null;
  private current = -1;
  private noRewind = false;
  private msPerChar = DEFAULT_MS_PER_CHAR;
  private sentStart = 0;
  private studentEndedAt = 0;
  private detector: SpeechDetector;
  private machine: DialogMachine;

  constructor(private player: BoardPlayer, private ask: (text?: string) => Promise<Script>) {
    this.machine = new DialogMachine({
      interrupt: () => { this.speaker.cancel(); this.player.bargeIn(); },
      resume: () => {
        this.noRewind = true; // çizim geri sarmasın, kaldığı yerden sürsün
        this.speaker.speak(this.sentences.map((s) => s.text), Math.max(0, this.current));
      },
      student: (text) => void this.handleStudent(text),
    });
    this.detector = new SpeechDetector({
      onEvent: (e) => {
        const now = performance.now();
        if (e === "start") this.machine.vadStart(now);
        else { this.studentEndedAt = now; this.machine.vadEnd(now); }
      },
    });
    this.speaker.onStart = (i) => {
      this.current = i;
      this.sentStart = performance.now();
      if (this.studentEndedAt) {
        const ms = Math.round(this.sentStart - this.studentEndedAt);
        console.info("Gecikme (öğrenci bitti → ilk ses):", ms, "ms");
        this.onLatency?.(ms);
        this.studentEndedAt = 0;
      }
      this.machine.teacherSpeaking(this.sentences[i].text);
      this.sync?.onSentenceStart(i, !this.noRewind);
      this.noRewind = false;
    };
    this.speaker.onEnd = (i) => {
      const chars = this.sentences[i].text.length;
      if (chars > 8) this.msPerChar = 0.7 * this.msPerChar + 0.3 * ((performance.now() - this.sentStart) / chars);
    };
    this.speaker.onDone = () => this.machine.teacherDone();
  }

  get state() { return this.machine.state; }

  async start(useMic = true) {
    if (useMic) {
      if (!Listener.supported) throw new Error("Bu tarayıcı konuşma tanımayı desteklemiyor (Chrome veya Edge kullanın).");
      this.mic = await startMic((rms) => {
        this.detector.strict = this.machine.state === "speaking";
        this.detector.push(rms);
      });
      this.listener.onInterim = (t) => this.machine.sttInterim(t, performance.now());
      this.listener.onFinal = (t) => this.machine.sttFinal(t, performance.now());
      this.listener.start();
    }
    this.timer = window.setInterval(() => {
      this.machine.tick(performance.now());
      this.sync?.tick();
    }, 50);
  }

  stop() {
    clearInterval(this.timer);
    this.listener.stop(); this.mic?.stop(); this.speaker.cancel();
  }

  /** Yeni bir betik: çizimler öncekilerin devamına eklenir, saat yeni cümlelere bağlanır. */
  say(script: Script) {
    this.player.dropFuture();
    const base = this.player.clock.now() + 300;
    const r = resolveCommands(script.sentences, script.commands, { base, msPerChar: this.msPerChar });
    r.unresolved.forEach((id) => console.warn("speech_ref bulunamadı:", id));
    this.sentences = script.sentences;
    this.current = -1;
    this.sync = new SentenceSync(this.player.clock, r.starts);
    this.player.append(r.cmds);
    this.speaker.speak(script.sentences.map((s) => s.text));
  }

  /** Yazılı soru: sesi ve çizimi durdurur, öğrencinin metnini öğretmene iletir. */
  typed(text: string) { this.speaker.cancel(); this.player.bargeIn(); return this.handleStudent(text); }

  private async handleStudent(text: string) {
    this.onHeard?.(text);
    try { this.say(await this.ask(text)); }
    catch (e) { console.error(e); this.machine.fail(); }
  }
}
