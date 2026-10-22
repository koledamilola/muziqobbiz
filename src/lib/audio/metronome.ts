// Stage 2.2 — Web Audio clock metronome and 1-bar (4/4) count-in scheduler.
// Docs consulted:
// - MDN Web Audio API scheduling (AudioContext.currentTime):
//   https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/currentTime
// - MDN OscillatorNode / GainNode:
//   https://developer.mozilla.org/en-US/docs/Web/API/OscillatorNode

export const MIN_METRONOME_BPM = 60;
export const MAX_METRONOME_BPM = 180;
export const DEFAULT_METRONOME_BPM = 90;
export const BEATS_PER_BAR = 4; // 4/4 time signature
export const COUNT_IN_BARS = 1;
export const COUNT_IN_BEATS = BEATS_PER_BAR * COUNT_IN_BARS; // 4 beats
export const DEFAULT_METRONOME_VOLUME = 0.7;

// Schedule clicks ahead on the Web Audio hardware clock (never fire clicks directly
// from setTimeout/requestAnimationFrame callbacks, which jitter under UI load).
export const LOOKAHEAD_WINDOW_SEC = 0.12;
export const ACCENT_FREQUENCY_HZ = 1100; // Beat 1 (accented)
export const REGULAR_FREQUENCY_HZ = 780; // Beats 2, 3, 4
export const CLICK_DURATION_SEC = 0.035;

export type ScheduledMetronomeBeat = {
  beatIndex: number;
  beatInBar: 1 | 2 | 3 | 4;
  isAccent: boolean;
  isCountIn: boolean;
  timeSec: number;
};

export type MetronomeBeatDisplay = {
  beatIndex: number;
  beatInBar: 1 | 2 | 3 | 4;
  isAccent: boolean;
  isCountIn: boolean;
  countInBeatsRemaining: number;
};

export function clampMetronomeBpm(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_METRONOME_BPM;
  const rounded = Math.round(value);
  return Math.min(MAX_METRONOME_BPM, Math.max(MIN_METRONOME_BPM, rounded));
}

export function clampMetronomeVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_METRONOME_VOLUME;
  return Math.min(1, Math.max(0, value));
}

export function secondsPerBeat(bpm: number): number {
  return 60 / clampMetronomeBpm(bpm);
}

export function countInDurationSec(bpm: number): number {
  return COUNT_IN_BEATS * secondsPerBeat(bpm);
}

export function computeScheduledBeatsInWindow(params: {
  startContextTime: number;
  bpm: number;
  fromBeatIndex: number;
  windowEndContextTime: number;
  includeCountIn: boolean;
}): ScheduledMetronomeBeat[] {
  const spb = secondsPerBeat(params.bpm);
  const countInTotal = params.includeCountIn ? COUNT_IN_BEATS : 0;
  const scheduled: ScheduledMetronomeBeat[] = [];
  let beatIndex = Math.max(0, Math.floor(params.fromBeatIndex));

  while (true) {
    const timeSec = params.startContextTime + beatIndex * spb;
    if (timeSec > params.windowEndContextTime) {
      break;
    }

    const beatInBar = ((beatIndex % BEATS_PER_BAR) + 1) as 1 | 2 | 3 | 4;
    scheduled.push({
      beatIndex,
      beatInBar,
      isAccent: beatInBar === 1,
      isCountIn: beatIndex < countInTotal,
      timeSec,
    });

    beatIndex++;
  }

  return scheduled;
}

export function getBeatDisplayAtTime(params: {
  startContextTime: number;
  currentContextTime: number;
  bpm: number;
  includeCountIn: boolean;
}): MetronomeBeatDisplay {
  const spb = secondsPerBeat(params.bpm);
  const countInTotal = params.includeCountIn ? COUNT_IN_BEATS : 0;
  const elapsed = Math.max(0, params.currentContextTime - params.startContextTime);
  const beatIndex = Math.max(0, Math.floor(elapsed / spb));
  const beatInBar = ((beatIndex % BEATS_PER_BAR) + 1) as 1 | 2 | 3 | 4;
  const isCountIn = beatIndex < countInTotal;
  const countInBeatsRemaining = isCountIn
    ? Math.max(1, countInTotal - beatIndex)
    : 0;

  return {
    beatIndex,
    beatInBar,
    isAccent: beatInBar === 1,
    isCountIn,
    countInBeatsRemaining,
  };
}

export function scheduleMetronomeClick(
  audioContext: AudioContext,
  beat: Pick<ScheduledMetronomeBeat, "timeSec" | "isAccent">,
  volume: number,
): void {
  const safeVolume = clampMetronomeVolume(volume);
  if (safeVolume <= 0) return;

  const startTime = Math.max(audioContext.currentTime, beat.timeSec);
  const stopTime = startTime + CLICK_DURATION_SEC;
  const peakGain = beat.isAccent
    ? Math.min(1, safeVolume * 0.95)
    : Math.min(1, safeVolume * 0.55);

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(
    beat.isAccent ? ACCENT_FREQUENCY_HZ : REGULAR_FREQUENCY_HZ,
    startTime,
  );

  // Fast attack and exponential decay produce a clean, percussive studio click.
  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.linearRampToValueAtTime(peakGain, startTime + 0.002);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, stopTime);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start(startTime);
  oscillator.stop(stopTime + 0.005);
}

