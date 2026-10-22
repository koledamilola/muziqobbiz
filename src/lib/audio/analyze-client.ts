import type { AnalysisResult } from "./analysis";

// RhythmExtractor2013 requires 44.1 kHz. Limit work to a 45-second excerpt on
// phones; only the analysis copy is shortened, never the saved vocal.
export async function analyzeTake(buffer: AudioBuffer, knownBpm: number | null, onProgress: (message: string) => void, signal: AbortSignal): Promise<AnalysisResult> {
  onProgress("Preparing audio on this device…");
  const duration = Math.min(buffer.duration, 45);
  const context = new OfflineAudioContext(1, Math.max(1, Math.ceil(duration * 44100)), 44100);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start(0, 0, duration);
  const mono = await context.startRendering();
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  const samples = mono.getChannelData(0).slice();
  return new Promise((resolve, reject) => {
    const worker = new Worker("/workers/analyze.js", { type: "module" });
    const cleanup = () => {
      worker.terminate();
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
    };
    const abort = () => { cleanup(); reject(new DOMException("Cancelled", "AbortError")); };
    const fail = () => { cleanup(); reject(new Error("Analysis could not finish. Retry or set the values yourself.")); };
    const timeout = setTimeout(fail, 90000);
    worker.onmessage = ({ data }) => {
      if (data.type === "progress") onProgress(data.message);
      else if (data.type === "result") { cleanup(); resolve(data.result); }
      else fail();
    };
    worker.onerror = fail;
    worker.onmessageerror = fail;
    signal.addEventListener("abort", abort, { once: true });
    worker.postMessage({ samples, knownBpm }, [samples.buffer]);
  });
}
