import type { NoiseReductionResult } from "./noise-reduction";

// Transfer the mono buffer, keeping the expensive transforms off the UI thread.
// https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects
export function reduceNoiseInWorker(samples: Float32Array, sampleRate: number, signal?: AbortSignal): Promise<NoiseReductionResult> {
  return new Promise((resolve, reject) => {
    let worker: Worker | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      worker?.terminate();
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    };
    const fail = () => {
      cleanup();
      const error = new Error("Noise reduction could not finish. Try again, or turn noise reduction off for this browser.");
      error.name = "NoiseReductionError";
      reject(error);
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Audio processing cancelled", "AbortError"));
    };
    if (signal?.aborted) { abort(); return; }
    try {
      worker = new Worker(new URL("./noise-reduction.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<NoiseReductionResult>) => {
        cleanup();
        resolve(event.data);
      };
      worker.onerror = fail;
      worker.onmessageerror = fail;
      signal?.addEventListener("abort", abort, { once: true });
      timeout = setTimeout(fail, 60000);
      worker.postMessage({ samples, sampleRate }, [samples.buffer]);
    } catch {
      fail();
    }
  });
}
