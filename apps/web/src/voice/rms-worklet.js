// AudioWorklet: ~20 ms'lik pencerelerde RMS (ses şiddeti) hesaplayıp ana iş parçacığına gönderir
class RmsProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sum = 0; this.n = 0;
    this.target = Math.round(sampleRate * 0.02);
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) { this.sum += ch[i] * ch[i]; this.n++; }
    if (this.n >= this.target) {
      this.port.postMessage(Math.sqrt(this.sum / this.n));
      this.sum = 0; this.n = 0;
    }
    return true;
  }
}
registerProcessor("rms-processor", RmsProcessor);
