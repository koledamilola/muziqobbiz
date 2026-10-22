// Stage 2.1 — Browser vocal recorder utilities and Web Audio decoding.
// Docs consulted:
// - MDN MediaRecorder: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
// - MDN MediaTrackConstraints: https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints
// - MDN BaseAudioContext.decodeAudioData: https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData

export const MAX_RECORDING_SECONDS = 180; // 3 minutes max length
export const DEFAULT_WAVEFORM_BARS = 64;

// Chrome and Android record audio/webm (Opus); iOS Safari records audio/mp4 (AAC).
export const SUPPORTED_RECORDING_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
] as const;

// Browser voice-call filters (echoCancellation, noiseSuppression, autoGainControl)
// are built for speech calls and aggressively cut sustained sung notes, vibrato,
// and natural vocal dynamics. Keep all three OFF and record a clean mono signal.
export const VOCAL_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  channelCount: 1,
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};

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
): Promise<AudioBuffer> {
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
  const arrayBuffer = await blob.arrayBuffer();
  // Pass a detached copy because some WebKit implementations detach the buffer during decode.
  return await audioContext.decodeAudioData(arrayBuffer.slice(0));
}

