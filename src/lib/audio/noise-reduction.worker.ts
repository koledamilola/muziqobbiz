import { reduceSteadyNoise } from "./noise-reduction";

self.onmessage = (event: MessageEvent<{ samples: Float32Array; sampleRate: number }>) => {
  const result = reduceSteadyNoise(event.data.samples, event.data.sampleRate);
  self.postMessage(result, { transfer: [result.samples.buffer] });
};
