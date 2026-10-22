// On-device spectral subtraction with a conservative, automatically estimated
// noise profile. A broadband floor is estimated from quiet frames; narrow vocal
// harmonics are excluded from that estimate. Time/frequency smoothing avoids
// isolated, rapidly opening frequency bins ("musical noise").
// Background: https://manual.audacityteam.org/man/noise_reduction.html

export type NoiseReductionResult = {
  samples: Float32Array;
  hasVoice: boolean;
};

class FourierTransform {
  private readonly reverse: Uint32Array;
  private readonly cosine: Float64Array;
  private readonly sine: Float64Array;

  constructor(private readonly size: number) {
    this.reverse = new Uint32Array(size);
    this.cosine = new Float64Array(size / 2);
    this.sine = new Float64Array(size / 2);
    for (let i = 1; i < size; i++) {
      this.reverse[i] = (this.reverse[i >> 1] >> 1) | ((i & 1) * (size / 2));
    }
    for (let i = 0; i < size / 2; i++) {
      this.cosine[i] = Math.cos(2 * Math.PI * i / size);
      this.sine[i] = Math.sin(2 * Math.PI * i / size);
    }
  }

  run(real: Float64Array, imaginary: Float64Array, inverse = false): void {
    const { size, reverse, cosine, sine } = this;
    for (let i = 0; i < size; i++) {
      const j = reverse[i];
      if (j > i) {
        [real[i], real[j]] = [real[j], real[i]];
        [imaginary[i], imaginary[j]] = [imaginary[j], imaginary[i]];
      }
    }
    for (let width = 2; width <= size; width *= 2) {
      const half = width / 2;
      const step = size / width;
      for (let start = 0; start < size; start += width) {
        for (let j = 0; j < half; j++) {
          const a = start + j;
          const b = a + half;
          const c = cosine[j * step];
          const s = sine[j * step] * (inverse ? 1 : -1);
          const re = c * real[b] - s * imaginary[b];
          const im = s * real[b] + c * imaginary[b];
          real[b] = real[a] - re;
          imaginary[b] = imaginary[a] - im;
          real[a] += re;
          imaginary[a] += im;
        }
      }
    }
    if (inverse) {
      for (let i = 0; i < size; i++) {
        real[i] /= size;
        imaginary[i] /= size;
      }
    }
  }
}

export function reduceSteadyNoise(input: Float32Array, sampleRate: number): NoiseReductionResult {
  const output = new Float32Array(input.length);
  if (input.length < 128) return { samples: input.slice(), hasVoice: false };
  const size = Math.min(sampleRate <= 24000 ? 1024 : 2048, 2 ** Math.floor(Math.log2(input.length)));
  const hop = size / 2;
  const bins = size / 2 + 1;
  const fft = new FourierTransform(size);
  const real = new Float64Array(size);
  const imaginary = new Float64Array(size);
  const window = Float64Array.from({ length: size }, (_, i) => Math.sin(Math.PI * (i + 0.5) / size));
  const analyse = (start: number) => {
    for (let i = 0; i < size; i++) real[i] = (input[start + i] ?? 0) * window[i];
    imaginary.fill(0);
    fft.run(real, imaginary);
  };

  // Full windows only: padding must not be mistaken for a quiet room sample.
  const frames: { start: number; power: number }[] = [];
  for (let start = 0; start + size <= input.length; start += hop) {
    let power = 0;
    for (let i = start; i < start + size; i++) power += input[i] * input[i];
    if (power > 1e-12) frames.push({ start, power });
  }
  if (frames.length === 0) return { samples: output, hasVoice: false };
  frames.sort((a, b) => a.power - b.power);
  const quietCount = Math.min(frames.length, Math.max(16, Math.ceil(frames.length * 0.2)));
  const profileCount = Math.min(48, quietCount);
  const profile = new Float64Array(bins);
  for (let frame = 0; frame < profileCount; frame++) {
    analyse(frames[Math.floor(frame * quietCount / profileCount)].start);
    for (let k = 0; k < bins; k++) {
      profile[k] += (real[k] * real[k] + imaginary[k] * imaginary[k]) / profileCount;
    }
  }

  // A sustained note may occupy even the quietest frames. Cap each noise bin
  // at the nearby broadband floor, so its harmonics cannot enter the profile.
  const noise = new Float64Array(bins);
  let totalNoise = 0;
  for (let k = 0; k < bins; k++) {
    const neighbours = Array.from(profile.subarray(Math.max(0, k - 12), Math.min(bins, k + 13)));
    neighbours.sort((a, b) => a - b);
    noise[k] = Math.min(profile[k], neighbours[Math.floor(neighbours.length * 0.3)]);
    totalNoise += noise[k];
  }

  const smoothedPower = noise.slice();
  const gains = new Float64Array(bins).fill(0.08);
  const mask = new Float64Array(bins);
  let voiceFrames = 0;
  // Square-root Hann at 50% overlap sums back to unity. The padded first frame
  // protects the first syllable; no samples or timing are trimmed from the take.
  for (let start = -hop; start < input.length; start += hop) {
    analyse(start);
    let totalPower = 0;
    for (let k = 0; k < bins; k++) {
      const power = real[k] * real[k] + imaginary[k] * imaginary[k];
      totalPower += power;
      smoothedPower[k] = 0.65 * smoothedPower[k] + 0.35 * power;
      const desired = Math.max(0.08, 1 - 1.4 * noise[k] / Math.max(smoothedPower[k], 1e-20));
      gains[k] += (desired - gains[k]) * (desired > gains[k] ? 0.9 : 0.25);
    }
    if (totalPower > Math.max(1e-12, totalNoise * 3)) voiceFrames++;
    for (let k = 0; k < bins; k++) {
      mask[k] = 0.2 * gains[Math.max(0, k - 1)] + 0.6 * gains[k] + 0.2 * gains[Math.min(bins - 1, k + 1)];
      real[k] *= mask[k];
      imaginary[k] *= mask[k];
      if (k > 0 && k < bins - 1) {
        real[size - k] *= mask[k];
        imaginary[size - k] *= mask[k];
      }
    }
    fft.run(real, imaginary, true);
    for (let i = Math.max(0, -start); i < size && start + i < input.length; i++) {
      output[start + i] += real[i] * window[i];
    }
  }
  return { samples: output, hasVoice: voiceFrames >= Math.min(3, frames.length) };
}
