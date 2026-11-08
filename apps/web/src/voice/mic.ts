import workletUrl from "./rms-worklet.js?url";

export async function startMic(onRms: (rms: number) => void, deviceId?: string) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true, noiseSuppression: true, autoGainControl: true,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    },
  });
  const ctx = new AudioContext();
  await ctx.audioWorklet.addModule(workletUrl);
  const src = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, "rms-processor");
  node.port.onmessage = (e) => onRms(e.data as number);
  // Bazı tarayıcılar çıkışı bağlı olmayan düğümü işlemez: sıfır kazançlı hedefe bağla
  const mute = ctx.createGain(); mute.gain.value = 0;
  src.connect(node); node.connect(mute); mute.connect(ctx.destination);
  return { stop() { stream.getTracks().forEach((t) => t.stop()); void ctx.close(); } };
}
