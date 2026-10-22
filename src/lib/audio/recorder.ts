// Stage 2.1 & 2.2 — Browser vocal recorder utilities, vocal clarity DSP, and Web Audio decoding.
// Docs consulted:
// - MDN MediaRecorder: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
// - MDN MediaTrackConstraints: https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints
// - MDN BaseAudioContext.decodeAudioData: https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData
// - MDN BiquadFilterNode / DynamicsCompressorNode: https://developer.mozilla.org/en-US/docs/Web/API/BiquadFilterNode
// - MDN processed capture: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamDestination

export const MAX_RECORDING_SECONDS = 180; // 3 minutes max length
export const DEFAULT_WAVEFORM_BARS = 64;
export const TARGET_VOCAL_PEAK = 0.89; // ~ -1.0 dBFS target loudness
export const MAX_AUTO_GAIN_BOOST = 8.0; // Up to +18 dB boost for quiet wired-headset mics
export const DEFAULT_MIC_BOOST = 1.8; // Default live input gain boost for wired headset mics

// Chrome and Android record audio/webm (Opus); iOS Safari records audio/mp4 (AAC).
export const SUPPORTED_RECORDING_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
] as const;

// Browser echoCancellation and autoGainControl are built for speakerphone calls
// and aggressively pump or hollow out singing. We keep them OFF and use our own
// musical Web Audio vocal chain + smooth noise reduction instead.
export function buildVocalAudioConstraints(options?: {
  noiseSuppression?: boolean;
}): MediaTrackConstraints {
  return {
    channelCount: 1,
    echoCancellation: false,
    noiseSuppression: Boolean(options?.noiseSuppression),
    autoGainControl: false,
  };
}

export function createVocalCaptureGraph(
  context: AudioContext,
  microphoneStream: MediaStream,
  micBoost: number,
): {
  inputGain: GainNode;
  analyser: AnalyserNode;
  recordingStream: MediaStream;
  nodes: AudioNode[];
} {
  const source = context.createMediaStreamSource(microphoneStream);
  const highPass = context.createBiquadFilter();
  highPass.type = "highpass";
  highPass.frequency.setValueAtTime(85, context.currentTime);
  highPass.Q.setValueAtTime(0.707, context.currentTime);

  const inputGain = context.createGain();
  inputGain.gain.setValueAtTime(micBoost, context.currentTime);

  const presence = context.createBiquadFilter();
  presence.type = "peaking";
  presence.frequency.setValueAtTime(3200, context.currentTime);
  presence.Q.setValueAtTime(1, context.currentTime);
  presence.gain.setValueAtTime(3, context.currentTime);

  const compressor = context.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-24, context.currentTime);
  compressor.knee.setValueAtTime(18, context.currentTime);
  compressor.ratio.setValueAtTime(3, context.currentTime);
  compressor.attack.setValueAtTime(0.008, context.currentTime);
  compressor.release.setValueAtTime(0.18, context.currentTime);

  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  const destination = context.createMediaStreamDestination();
  if (destination.stream.getAudioTracks().length === 0) {
    throw new Error("Processed microphone stream has no audio track.");
  }

  source.connect(highPass);
  highPass.connect(inputGain);
  inputGain.connect(presence);
  presence.connect(compressor);
  compressor.connect(analyser);
  compressor.connect(destination);

  return {
    inputGain,
    analyser,
    recordingStream: destination.stream,
    nodes: [source, highPass, inputGain, presence, compressor, analyser, destination],
  };
}

export type RecordedTake = {
  blob: Blob;
  mimeType: string;
  durationSec: number;
  audioBuffer: AudioBuffer;
  peaks: number[];
  sampleRate: number;
  createdAt: string;
  reachedMaxLength: boolean;
  bpm: number | null;
  bpmConfidence: "known" | null;
};

export type MicErrorInfo = {
  title: string;
  message: string;
  showPermissionHelp: boolean;
};

export function detectRecordingMimeType(
  isTypeSupported?: (mimeType: string) => boolean,
): string {
  const check =
    isTypeSupported ??
    (typeof MediaRecorder !== "undefined" &&
    typeof MediaRecorder.isTypeSupported === "function"
      ? (mime: string) => MediaRecorder.isTypeSupported(mime)
      : undefined);

  if (!check) return "";

  for (const candidate of SUPPORTED_RECORDING_MIME_TYPES) {
    try {
      if (check(candidate)) {
        return candidate;
      }
    } catch {
      // Ignore unsupported query errors on older mobile browsers.
    }
  }

  return "";
}

export function normalizeMimeLabel(mimeType: string): string {
  const base = mimeType.split(";")[0]?.trim().toLowerCase();
  if (base === "audio/wav" || base === "audio/wave") return "audio/wav (enhanced)";
  if (base === "audio/mp4" || base === "audio/x-m4a") return "audio/mp4 (AAC)";
  if (base === "audio/webm") return "audio/webm (Opus)";
  if (base) return base;
  return "browser audio";
}

export function formatDuration(seconds: number): string {
  const clamped = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function computeRmsLevel(samples: ArrayLike<number>): number {
  const length = samples.length;
  if (length === 0) return 0;

  let sumSquares = 0;
  for (let i = 0; i < length; i++) {
    const sample = samples[i] ?? 0;
    sumSquares += sample * sample;
  }

  const rms = Math.sqrt(sumSquares / length);
  // Apply gentle perceptual scaling so normal singing sits comfortably mid-meter
  // while loud peaks reach 1.0.
  return Math.min(1, Math.max(0, Math.sqrt(rms) * 1.4));
}

export function computeWaveformPeaks(
  samples: ArrayLike<number>,
  barCount: number = DEFAULT_WAVEFORM_BARS,
): number[] {
  const safeBarCount = Math.max(1, Math.floor(barCount));
  const length = samples.length;

  if (length === 0) {
    return Array.from({ length: safeBarCount }, () => 0.05);
  }

  const peaks: number[] = new Array(safeBarCount).fill(0);
  let maxPeak = 0;

  for (let bar = 0; bar < safeBarCount; bar++) {
    const start = Math.floor((bar * length) / safeBarCount);
    const end = Math.max(start + 1, Math.floor(((bar + 1) * length) / safeBarCount));
    let bucketMax = 0;

    // Sample up to 256 points per bucket so long 3-minute takes stay instant on phones.
    const step = Math.max(1, Math.floor((end - start) / 256));
    for (let i = start; i < end && i < length; i += step) {
      const abs = Math.abs(samples[i] ?? 0);
      if (abs > bucketMax) bucketMax = abs;
    }

    peaks[bar] = bucketMax;
    if (bucketMax > maxPeak) maxPeak = bucketMax;
  }

  if (maxPeak <= 0) {
    return peaks.map(() => 0.05);
  }

  return peaks.map((peak) => Math.max(0.06, Math.min(1, peak / maxPeak)));
}

// Cleans and normalizes a decoded vocal sample buffer:
// 1. Removes DC offset.
// 2. Applies an 85 Hz high-pass filter to remove low-end mic rumble and cord noise.
// 3. Applies a smooth, musical soft-knee noise gate/expander to reduce background hiss
//    between phrases without cutting off sustained vocal notes.
// 4. Normalizes peak loudness to TARGET_VOCAL_PEAK (-1 dBFS) with soft limiting so
//    quiet wired-headphone recordings play back loud and clear.
export function cleanAndNormalizeSamples(
  input: ArrayLike<number>,
  sampleRate: number = 48000,
  options?: {
    noiseGate?: boolean;
    normalize?: boolean;
    highPass?: boolean;
    targetPeak?: number;
    maxBoost?: number;
  },
): Float32Array {
  const length = input.length;
  const output = new Float32Array(length);
  if (length === 0) return output;

  const enableGate = options?.noiseGate ?? true;
  const enableNormalize = options?.normalize ?? true;
  const enableHighPass = options?.highPass ?? true;
  const targetPeak = options?.targetPeak ?? TARGET_VOCAL_PEAK;
  const maxBoost = options?.maxBoost ?? MAX_AUTO_GAIN_BOOST;
  const safeRate = Math.max(8000, Number.isFinite(sampleRate) ? sampleRate : 48000);

  // Step 1: Compute mean (DC offset)
  let sum = 0;
  for (let i = 0; i < length; i++) {
    sum += input[i] ?? 0;
  }
  const dcOffset = sum / length;

  // Step 2: 85 Hz single-pole high-pass filter to strip low rumble & plosive thumps
  const cutoffHz = 85;
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / safeRate;
  const hpAlpha = rc / (rc + dt);

  let prevIn = 0;
  let prevOut = 0;
  let maxAbs = 0;

  for (let i = 0; i < length; i++) {
    const centered = (input[i] ?? 0) - dcOffset;
    const filtered = enableHighPass
      ? hpAlpha * (prevOut + centered - prevIn)
      : centered;
    prevIn = centered;
    prevOut = filtered;
    output[i] = filtered;
    const abs = Math.abs(filtered);
    if (abs > maxAbs) maxAbs = abs;
  }

  if (maxAbs <= 0.0001) {
    return output;
  }

  // Step 3: Smooth soft-knee noise expander/gate relative to signal peak
  // Attenuates room hiss below ~3% of peak signal with fast attack (6ms) and slow release (150ms)
  if (enableGate) {
    const gateThreshold = Math.min(0.015, Math.max(0.002, maxAbs * 0.025));
    const attackCoeff = Math.exp(-1 / (safeRate * 0.006));
    const releaseCoeff = Math.exp(-1 / (safeRate * 0.15));
    let envelope = 0;
    let postGateMax = 0;

    for (let i = 0; i < length; i++) {
      const sample = output[i];
      const abs = Math.abs(sample);
      envelope =
        abs > envelope
          ? attackCoeff * envelope + (1 - attackCoeff) * abs
          : releaseCoeff * envelope + (1 - releaseCoeff) * abs;

      let gateGain = 1;
      if (envelope < gateThreshold) {
        const ratio = envelope / gateThreshold;
        // Soft quadratic expansion down to 0.22 (-13 dB floor) so background noise
        // drops away smoothly without unnatural "dead air" clicks.
        gateGain = 0.22 + 0.78 * (ratio * ratio);
      }

      const gated = sample * gateGain;
      output[i] = gated;
      const gatedAbs = Math.abs(gated);
      if (gatedAbs > postGateMax) postGateMax = gatedAbs;
    }

    if (postGateMax > 0) {
      maxAbs = postGateMax;
    }
  }

  // Step 4: Raise quiet phrases while a brief loud bump cannot set the gain
  // for the whole take. Use the louder half of 20 ms windows to estimate voice
  // level, then softly limit isolated peaks rather than hard-clipping them.
  if (enableNormalize && maxAbs > 0.001) {
    const windowSize = Math.max(1, Math.floor(safeRate * 0.02));
    const levels: number[] = [];
    for (let start = 0; start < length; start += windowSize) {
      let power = 0;
      const end = Math.min(length, start + windowSize);
      for (let i = start; i < end; i++) power += output[i] * output[i];
      levels.push(Math.sqrt(power / (end - start)));
    }
    levels.sort((a, b) => a - b);
    const voiceRms = levels[Math.floor(levels.length * 0.75)] ?? 0;
    const gain = Math.min(
      maxBoost,
      Math.max(targetPeak / maxAbs, voiceRms > 0.002 ? 0.22 / voiceRms : 1),
    );
    for (let i = 0; i < length; i++) {
      const amplified = output[i] * gain;
      const magnitude = Math.abs(amplified);
      const limited = magnitude <= 0.8
        ? magnitude
        : 0.8 + 0.18 * (1 - Math.exp(-(magnitude - 0.8) / 0.18));
      output[i] = Math.sign(amplified) * limited;
    }
  }

  return output;
}

export function classifyMicError(error: unknown): MicErrorInfo {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name?: unknown }).name)
      : "";

  if (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    name === "SecurityError"
  ) {
    return {
      title: "Microphone access is blocked",
      message:
        "muziqobbiz needs permission to use your microphone so you can record your vocal take.",
      showPermissionHelp: true,
    };
  }

  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      title: "No microphone found",
      message:
        "We could not detect a microphone on this device. Connect a mic or wired headset and try again.",
      showPermissionHelp: false,
    };
  }

  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      title: "Microphone is busy",
      message:
        "Another app or browser tab may be using your microphone. Close other recording apps and try again.",
      showPermissionHelp: false,
    };
  }

  return {
    title: "Could not start recording",
    message:
      "Your browser could not access the microphone. Check that you are on https:// or localhost and try again.",
    showPermissionHelp: true,
  };
}

export async function decodeRecordingBlob(
  blob: Blob,
  audioContext: AudioContext,
  options?: {
    noiseGate?: boolean;
    normalize?: boolean;
    highPass?: boolean;
  },
): Promise<AudioBuffer> {
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
  const arrayBuffer = await blob.arrayBuffer();
  // Pass a detached copy because some WebKit implementations detach the buffer during decode.
  const rawBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

  if (
    typeof audioContext.createBuffer === "function" &&
    typeof rawBuffer.getChannelData === "function" &&
    rawBuffer.numberOfChannels > 0
  ) {
    // Downmix to mono if the browser returned >1 channel, then clean & normalize.
    const length = rawBuffer.length;
    const monoInput = new Float32Array(length);
    const channels = rawBuffer.numberOfChannels;
    for (let ch = 0; ch < channels; ch++) {
      const chData = rawBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        monoInput[i] += chData[i] / channels;
      }
    }

    const cleaned = cleanAndNormalizeSamples(
      monoInput,
      rawBuffer.sampleRate,
      options,
    );
    const enhancedBuffer = audioContext.createBuffer(
      1,
      cleaned.length,
      rawBuffer.sampleRate,
    );
    enhancedBuffer.getChannelData(0).set(cleaned);
    return enhancedBuffer;
  }

  return rawBuffer;
}

// Keep the enhanced buffer as the take's actual file, not only its preview.
export function encodeWavBlob(buffer: AudioBuffer): Blob {
  const samples = buffer.getChannelData(0);
  const data = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(data);
  const writeText = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeText(0, "RIFF");
  view.setUint32(4, data.byteLength - 8, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
  }
  return new Blob([data], { type: "audio/wav" });
}
