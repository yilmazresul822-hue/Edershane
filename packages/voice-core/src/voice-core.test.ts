import { describe, it, expect } from "vitest";
import { SpeechDetector, DialogMachine, isEcho, resolveCommands, SentenceSync } from "./index";

const feed = (d: SpeechDetector, rms: number, n: number) => { for (let i = 0; i < n; i++) d.push(rms); };

describe("VAD", () => {
  it("sürekli sesi algılar, kısa tıkırtıyı yok sayar", () => {
    const ev: string[] = [];
    const d = new SpeechDetector({ onEvent: (e) => ev.push(e) });
    feed(d, 0.003, 50); feed(d, 0.1, 3); feed(d, 0.003, 30);
    expect(ev).toEqual([]);
    feed(d, 0.1, 15);
    expect(ev).toEqual(["start"]);
    feed(d, 0.003, 30);
    expect(ev).toEqual(["start", "end"]);
  });
});

const mk = () => {
  const log: string[] = [];
  const m = new DialogMachine({
    interrupt: () => log.push("interrupt"),
    resume: () => log.push("resume"),
    student: (t) => log.push("student:" + t),
  });
  return { m, log };
};
const SPOKEN = "Önce dikme ayağını bulalım";

describe("yankı", () => {
  it("öğretmenin kendi cümlesi yankı sayılır, öğrencinin sözü sayılmaz", () => {
    expect(isEcho("önce dikme ayağını", SPOKEN)).toBe(true);
    expect(isEcho("bu açı neden 90 derece", SPOKEN)).toBe(false);
    expect(isEcho("evet", "evet bulalım")).toBe(false);
  });
});

describe("diyalog", () => {
  it("VAD ile araya girme: sesi durdurur, öğrenci cümlesini teslim eder", () => {
    const { m, log } = mk();
    m.teacherSpeaking(SPOKEN);
    m.vadStart(1000);
    expect(m.state).toBe("listening");
    m.sttFinal("bu açı neden 90 derece", 1500);
    expect(log).toEqual(["interrupt"]);
    m.vadEnd(1700);
    expect(log).toEqual(["interrupt", "student:bu açı neden 90 derece"]);
    expect(m.state).toBe("thinking");
  });
  it("yanlış alarm (öksürük): öğretmen kaldığı cümleden devam eder", () => {
    const { m, log } = mk();
    m.teacherSpeaking(SPOKEN);
    m.vadStart(0); m.vadEnd(300);
    m.tick(1000);
    expect(log).toEqual(["interrupt"]);
    m.tick(1900);
    expect(log).toEqual(["interrupt", "resume"]);
    expect(m.state).toBe("speaking");
  });
  it("yankıyı araya girme sanmaz", () => {
    const { m, log } = mk();
    m.teacherSpeaking(SPOKEN);
    m.sttInterim("önce dikme ayağını", 100);
    expect(log).toEqual([]);
    expect(m.state).toBe("speaking");
  });
  it("yalnızca STT ile araya girme (VAD yoksa)", () => {
    const { m, log } = mk();
    m.teacherSpeaking(SPOKEN);
    m.sttInterim("bir dakika dur bir", 100);
    expect(log).toEqual(["interrupt"]);
  });
  it("final gelmese de sessizlikten sonra interim ile commit eder", () => {
    const { m, log } = mk();
    m.vadStart(0);
    m.sttInterim("hocam şunu anlamadım", 500);
    m.vadEnd(600);
    m.tick(1000);
    expect(log).toEqual([]);
    m.tick(1600);
    expect(log).toEqual(["student:hocam şunu anlamadım"]);
  });
});

describe("zaman çizelgesi", () => {
  const S = [{ id: "s1", text: "Merhaba" }, { id: "s2", text: "Şimdi dikme indirelim" }];
  it("speech_ref ofsetini mutlak saate çevirir", () => {
    const r = resolveCommands(S, [
      { id: "a", at_ms: 500, speech_ref: "s2" },
      { id: "b", at_ms: 100, speech_ref: "yok" },
    ]);
    expect(r.starts).toEqual([0, 950]);
    expect(r.cmds[0].at_ms).toBe(1450);
    expect(r.unresolved).toEqual(["b"]);
  });
  it("base kaydırması uygulanır", () => {
    expect(resolveCommands(S, [], { base: 1000 }).starts).toEqual([1000, 1950]);
  });
  it("cümle uzarsa saat sonraki cümlenin başında bekler, erken biterse ileri atlar", () => {
    const clock = { t: 0, playing: false, now() { return this.t; }, seek(m: number) { this.t = m; }, play() { this.playing = true; }, pause() { this.playing = false; } };
    const sync = new SentenceSync(clock, [0, 3000, 6000]);
    sync.onSentenceStart(0);
    clock.t = 3500; sync.tick();
    expect(clock.t).toBe(2999);
    expect(clock.playing).toBe(false);
    sync.onSentenceStart(1);
    expect(clock.t).toBe(3000);
    expect(clock.playing).toBe(true);
    clock.t = 3500; sync.onSentenceStart(2);
    expect(clock.t).toBe(6000);
  });
});
