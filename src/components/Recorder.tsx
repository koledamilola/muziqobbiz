"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BEATS_PER_BAR,
  clampMetronomeBpm,
  clampMetronomeVolume,
  computeScheduledBeatsInWindow,
  countInDurationSec,
  DEFAULT_METRONOME_BPM,
  DEFAULT_METRONOME_VOLUME,
  getBeatDisplayAtTime,
  LOOKAHEAD_WINDOW_SEC,
  MAX_METRONOME_BPM,
  type MetronomeBeatDisplay,
  MIN_METRONOME_BPM,
  scheduleMetronomeClick,
} from "@/lib/audio/metronome";
import {
  buildVocalAudioConstraints,
  classifyMicError,
  computeRmsLevel,
  computeWaveformPeaks,
  decodeRecordingBlob,
  DEFAULT_MIC_BOOST,
  detectRecordingMimeType,
  formatDuration,
  MAX_RECORDING_SECONDS,
  type MicErrorInfo,
  normalizeMimeLabel,
  type RecordedTake,
} from "@/lib/audio/recorder";

type RecorderPhase =
  | "idle"
  | "requesting"
  | "count-in"
  | "recording"
  | "decoding"
  | "review";

type RecorderProps = {
  onKeepTake?: (take: RecordedTake) => void;
};

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext ??
    null
  );
}

export default function Recorder({ onKeepTake }: RecorderProps) {
  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [inputLevel, setInputLevel] = useState(0);
  const [micError, setMicError] = useState<MicErrorInfo | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [take, setTake] = useState<RecordedTake | null>(null);
  const [isKept, setIsKept] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSec, setPlaybackSec] = useState(0);

  // Vocal Clarity, Noise Reduction & Volume Boost state
  const [noiseReductionEnabled, setNoiseReductionEnabled] = useState(true);
  const [autoNormalizeEnabled, setAutoNormalizeEnabled] = useState(true);
  const [micBoost, setMicBoost] = useState<number>(DEFAULT_MIC_BOOST);
  const [playbackGain, setPlaybackGain] = useState<number>(1.25);

  // Metronome state (Stage 2.2)
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [bpm, setBpm] = useState<number>(DEFAULT_METRONOME_BPM);
  const [bpmInput, setBpmInput] = useState<string>(String(DEFAULT_METRONOME_BPM));
  const [metronomeVolume, setMetronomeVolume] = useState<number>(
    DEFAULT_METRONOME_VOLUME,
  );
  const [beatDisplay, setBeatDisplay] = useState<MetronomeBeatDisplay | null>(
    null,
  );
  const [isPreviewingClick, setIsPreviewingClick] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordStartContextTimeRef = useRef<number>(0);
  const reachedMaxRef = useRef<boolean>(false);
  const cancelledDuringCountInRef = useRef<boolean>(false);
  const meterFrameRef = useRef<number | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const inputGainNodeRef = useRef<GainNode | null>(null);

  // Web Audio metronome scheduler refs
  const nextBeatIndexRef = useRef<number>(0);
  const metronomeStartContextTimeRef = useRef<number>(0);
  const metronomeBpmRef = useRef<number>(DEFAULT_METRONOME_BPM);
  const metronomeVolumeRef = useRef<number>(DEFAULT_METRONOME_VOLUME);
  const previewFrameRef = useRef<number | null>(null);

  const playbackSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const playbackGainNodeRef = useRef<GainNode | null>(null);
  const playbackStartContextTimeRef = useRef<number>(0);
  const playbackOffsetSecRef = useRef<number>(0);
  const playbackFrameRef = useRef<number | null>(null);

  useEffect(() => {
    metronomeVolumeRef.current = metronomeVolume;
  }, [metronomeVolume]);

  useEffect(() => {
    if (inputGainNodeRef.current && audioContextRef.current) {
      inputGainNodeRef.current.gain.setValueAtTime(
        micBoost,
        audioContextRef.current.currentTime,
      );
    }
  }, [micBoost]);

  useEffect(() => {
    if (playbackGainNodeRef.current && audioContextRef.current) {
      playbackGainNodeRef.current.gain.setValueAtTime(
        playbackGain,
        audioContextRef.current.currentTime,
      );
    }
  }, [playbackGain]);

  const applyBpm = useCallback((rawValue: number) => {
    const clamped = clampMetronomeBpm(rawValue);
    setBpm(clamped);
    setBpmInput(String(clamped));
    metronomeBpmRef.current = clamped;
  }, []);

  const ensureAudioContext = useCallback(async (): Promise<AudioContext> => {
    let ctx = audioContextRef.current;
    if (!ctx || ctx.state === "closed") {
      const AudioCtx = getAudioContextConstructor();
      if (!AudioCtx) {
        throw new Error("Web Audio API is not supported in this browser.");
      }
      ctx = new AudioCtx();
      audioContextRef.current = ctx;
    }
    // Mobile browsers require AudioContext to be started or resumed from a user tap.
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    return ctx;
  }, []);

  const stopClickPreview = useCallback(() => {
    if (previewFrameRef.current !== null) {
      cancelAnimationFrame(previewFrameRef.current);
      previewFrameRef.current = null;
    }
    setIsPreviewingClick(false);
    setBeatDisplay(null);
  }, []);

  const stopMicStream = useCallback(() => {
    if (meterFrameRef.current !== null) {
      cancelAnimationFrame(meterFrameRef.current);
      meterFrameRef.current = null;
    }
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch {
        // Ignore disconnect errors if already disconnected.
      }
      sourceNodeRef.current = null;
    }
    inputGainNodeRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setInputLevel(0);
    setBeatDisplay(null);
  }, []);

  const stopPlayback = useCallback((resetPosition = false) => {
    if (playbackFrameRef.current !== null) {
      cancelAnimationFrame(playbackFrameRef.current);
      playbackFrameRef.current = null;
    }
    if (playbackSourceRef.current) {
      const node = playbackSourceRef.current;
      playbackSourceRef.current = null;
      node.onended = null;
      try {
        node.stop();
        node.disconnect();
      } catch {
        // Ignore if already stopped.
      }
    }
    if (playbackGainNodeRef.current) {
      try {
        playbackGainNodeRef.current.disconnect();
      } catch {
        // Ignore disconnect error.
      }
      playbackGainNodeRef.current = null;
    }
    setIsPlaying(false);
    if (resetPosition) {
      playbackOffsetSecRef.current = 0;
      setPlaybackSec(0);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopClickPreview();
      stopPlayback(true);
      stopMicStream();
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore stop errors on unmount.
        }
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        void audioContextRef.current.close().catch(() => {});
      }
    };
  }, [stopClickPreview, stopMicStream, stopPlayback]);

  const toggleClickPreview = useCallback(async () => {
    if (isPreviewingClick) {
      stopClickPreview();
      return;
    }

    stopPlayback(true);
    const ctx = await ensureAudioContext();
    const activeBpm = clampMetronomeBpm(bpm);
    metronomeBpmRef.current = activeBpm;
    const startContextTime = ctx.currentTime + 0.05;
    metronomeStartContextTimeRef.current = startContextTime;
    nextBeatIndexRef.current = 0;
    setIsPreviewingClick(true);

    const tickPreview = () => {
      const now = ctx.currentTime;
      const beats = computeScheduledBeatsInWindow({
        startContextTime: metronomeStartContextTimeRef.current,
        bpm: metronomeBpmRef.current,
        fromBeatIndex: nextBeatIndexRef.current,
        windowEndContextTime: now + LOOKAHEAD_WINDOW_SEC,
        includeCountIn: false,
      });

      for (const beat of beats) {
        scheduleMetronomeClick(ctx, beat, metronomeVolumeRef.current);
        nextBeatIndexRef.current = beat.beatIndex + 1;
      }

      if (now >= metronomeStartContextTimeRef.current) {
        setBeatDisplay(
          getBeatDisplayAtTime({
            startContextTime: metronomeStartContextTimeRef.current,
            currentContextTime: now,
            bpm: metronomeBpmRef.current,
            includeCountIn: false,
          }),
        );
      }

      previewFrameRef.current = requestAnimationFrame(tickPreview);
    };

    previewFrameRef.current = requestAnimationFrame(tickPreview);
  }, [bpm, ensureAudioContext, isPreviewingClick, stopClickPreview, stopPlayback]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    // If the user stops during the 1-bar count-in before MediaRecorder has started,
    // cancel cleanly back to idle without saving an empty take.
    if (!recorder || recorder.state === "inactive") {
      cancelledDuringCountInRef.current = true;
      stopMicStream();
      setElapsedSec(0);
      setPhase("idle");
      return;
    }

    try {
      recorder.stop();
    } catch {
      stopMicStream();
      setPhase("idle");
    }
  }, [stopMicStream]);

  const startRecording = useCallback(async () => {
    stopClickPreview();
    stopPlayback(true);
    setMicError(null);
    setDecodeError(null);
    setIsKept(false);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setMicError({
        title: "Recording is not supported in this browser",
        message:
          "Please open muziqobbiz in Safari on iPhone/iPad or Chrome on Android/desktop over https:// or localhost.",
        showPermissionHelp: true,
      });
      return;
    }

    setPhase("requesting");

    try {
      // Start or resume AudioContext directly inside the user tap handler (AGENTS.md rule 14).
      const audioContext = await ensureAudioContext();

      // Request mono vocal input. Echo cancellation and autoGainControl stay OFF
      // so sustained singing notes are not hollowed out; optional noiseSuppression
      // can be enabled alongside our Web Audio vocal clarity chain.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: buildVocalAudioConstraints({
          noiseSuppression: noiseReductionEnabled,
        }),
      });
      mediaStreamRef.current = stream;

      // Build the live Web Audio vocal clarity + gain chain:
      // Mic -> 85 Hz High-Pass (removes low rumble/cord noise)
      //     -> 3.2 kHz Presence EQ (+3 dB vocal clarity)
      //     -> Gentle Vocal Compressor -> Input Gain Boost -> Analyser + Recorder Destination
      const sourceNode = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = sourceNode;

      const highPass = audioContext.createBiquadFilter();
      highPass.type = "highpass";
      highPass.frequency.setValueAtTime(85, audioContext.currentTime);
      highPass.Q.setValueAtTime(0.707, audioContext.currentTime);

      const presenceEq = audioContext.createBiquadFilter();
      presenceEq.type = "peaking";
      presenceEq.frequency.setValueAtTime(3200, audioContext.currentTime);
      presenceEq.Q.setValueAtTime(1.0, audioContext.currentTime);
      presenceEq.gain.setValueAtTime(
        noiseReductionEnabled ? 3.0 : 0,
        audioContext.currentTime,
      );

      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-24, audioContext.currentTime);
      compressor.knee.setValueAtTime(18, audioContext.currentTime);
      compressor.ratio.setValueAtTime(3, audioContext.currentTime);
      compressor.attack.setValueAtTime(0.008, audioContext.currentTime);
      compressor.release.setValueAtTime(0.18, audioContext.currentTime);

      const inputGainNode = audioContext.createGain();
      inputGainNode.gain.setValueAtTime(micBoost, audioContext.currentTime);
      inputGainNodeRef.current = inputGainNode;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      const sampleBuffer = new Float32Array(analyser.fftSize);

      sourceNode.connect(highPass);
      highPass.connect(presenceEq);
      presenceEq.connect(compressor);
      compressor.connect(inputGainNode);
      inputGainNode.connect(analyser);

      let recordingStream: MediaStream = stream;
      if (typeof audioContext.createMediaStreamDestination === "function") {
        const destinationNode = audioContext.createMediaStreamDestination();
        inputGainNode.connect(destinationNode);
        if (destinationNode.stream.getAudioTracks().length > 0) {
          recordingStream = destinationNode.stream;
        }
      }

      const preferredMimeType = detectRecordingMimeType();
      const recorder = preferredMimeType
        ? new MediaRecorder(recordingStream, { mimeType: preferredMimeType })
        : new MediaRecorder(recordingStream);

      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      reachedMaxRef.current = false;
      cancelledDuringCountInRef.current = false;
      setElapsedSec(0);

      const useClick = metronomeEnabled;
      const lockedBpm = clampMetronomeBpm(bpm);
      metronomeBpmRef.current = lockedBpm;
      const useNoiseGate = noiseReductionEnabled;
      const useAutoNormalize = autoNormalizeEnabled;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        stopMicStream();
        setDecodeError("Recording interrupted. Please tap Record to try again.");
        setPhase("idle");
      };

      recorder.onstop = async () => {
        stopMicStream();
        if (cancelledDuringCountInRef.current) {
          chunksRef.current = [];
          setPhase("idle");
          return;
        }

        setPhase("decoding");

        try {
          const actualMimeType =
            recorder.mimeType || preferredMimeType || "audio/webm";
          const blob = new Blob(chunksRef.current, { type: actualMimeType });
          chunksRef.current = [];

          if (blob.size === 0) {
            throw new Error("Empty recording");
          }

          const ctx = await ensureAudioContext();
          const audioBuffer = await decodeRecordingBlob(blob, ctx, {
            noiseGate: useNoiseGate,
            normalize: useAutoNormalize,
          });
          const channelData = audioBuffer.getChannelData(0);
          const peaks = computeWaveformPeaks(channelData);

          const recordedTake: RecordedTake = {
            blob,
            mimeType: actualMimeType,
            durationSec: audioBuffer.duration,
            audioBuffer,
            peaks,
            sampleRate: audioBuffer.sampleRate,
            createdAt: new Date().toISOString(),
            reachedMaxLength: reachedMaxRef.current,
            // Store BPM as "known" (high confidence) when recorded with the metronome.
            bpm: useClick ? lockedBpm : null,
            bpmConfidence: useClick ? "known" : null,
          };

          setTake(recordedTake);
          playbackOffsetSecRef.current = 0;
          setPlaybackSec(0);
          setPhase("review");
        } catch {
          setDecodeError(
            "Could not decode that audio take. Please record a slightly longer take and try again.",
          );
          setPhase("idle");
        }
      };

      const startClockTime = audioContext.currentTime + 0.06;
      metronomeStartContextTimeRef.current = startClockTime;
      nextBeatIndexRef.current = 0;

      const countInSec = useClick ? countInDurationSec(lockedBpm) : 0;
      const recordingStartClockTime = startClockTime + countInSec;
      recordStartContextTimeRef.current = recordingStartClockTime;

      let recorderStarted = false;
      if (!useClick) {
        recorder.start(250);
        recorderStarted = true;
        setPhase("recording");
      } else {
        setPhase("count-in");
      }

      const updateLoop = () => {
        analyser.getFloatTimeDomainData(sampleBuffer);
        setInputLevel(computeRmsLevel(sampleBuffer));

        const now = audioContext.currentTime;

        if (useClick) {
          // Schedule upcoming clicks strictly on the Web Audio clock within the lookahead window.
          const beatsToSchedule = computeScheduledBeatsInWindow({
            startContextTime: startClockTime,
            bpm: lockedBpm,
            fromBeatIndex: nextBeatIndexRef.current,
            windowEndContextTime: now + LOOKAHEAD_WINDOW_SEC,
            includeCountIn: true,
          });

          for (const beat of beatsToSchedule) {
            scheduleMetronomeClick(
              audioContext,
              beat,
              metronomeVolumeRef.current,
            );
            nextBeatIndexRef.current = beat.beatIndex + 1;
          }

          if (now >= startClockTime) {
            setBeatDisplay(
              getBeatDisplayAtTime({
                startContextTime: startClockTime,
                currentContextTime: now,
                bpm: lockedBpm,
                includeCountIn: true,
              }),
            );
          }

          // Start MediaRecorder right as the 1-bar (4-beat) count-in finishes on the Web Audio clock.
          if (!recorderStarted && now >= recordingStartClockTime) {
            recorderStarted = true;
            recorder.start(250);
            setPhase("recording");
          }
        }

        if (recorderStarted) {
          const elapsed = Math.max(0, now - recordStartContextTimeRef.current);
          const clampedElapsed = Math.min(MAX_RECORDING_SECONDS, elapsed);
          setElapsedSec(clampedElapsed);

          if (elapsed >= MAX_RECORDING_SECONDS) {
            reachedMaxRef.current = true;
            if (recorder.state !== "inactive") {
              recorder.stop();
            }
            return;
          }
        }

        meterFrameRef.current = requestAnimationFrame(updateLoop);
      };

      meterFrameRef.current = requestAnimationFrame(updateLoop);
    } catch (error) {
      stopMicStream();
      setMicError(classifyMicError(error));
      setPhase("idle");
    }
  }, [
    autoNormalizeEnabled,
    bpm,
    ensureAudioContext,
    metronomeEnabled,
    micBoost,
    noiseReductionEnabled,
    stopClickPreview,
    stopMicStream,
    stopPlayback,
  ]);

  const startPlaybackFrom = useCallback(
    async (offsetSec: number) => {
      if (!take) return;
      stopClickPreview();
      stopPlayback(false);

      const ctx = await ensureAudioContext();
      const safeOffset = Math.max(
        0,
        Math.min(offsetSec, Math.max(0, take.durationSec - 0.05)),
      );

      const source = ctx.createBufferSource();
      source.buffer = take.audioBuffer;

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(playbackGain, ctx.currentTime);
      playbackGainNodeRef.current = gainNode;

      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      playbackSourceRef.current = source;
      playbackOffsetSecRef.current = safeOffset;
      playbackStartContextTimeRef.current = ctx.currentTime;
      setPlaybackSec(safeOffset);
      setIsPlaying(true);

      const updatePlayhead = () => {
        const current =
          playbackOffsetSecRef.current +
          (ctx.currentTime - playbackStartContextTimeRef.current);
        if (current >= take.durationSec) {
          setPlaybackSec(take.durationSec);
          return;
        }
        setPlaybackSec(current);
        playbackFrameRef.current = requestAnimationFrame(updatePlayhead);
      };

      source.onended = () => {
        if (playbackSourceRef.current === source) {
          playbackSourceRef.current = null;
          if (playbackFrameRef.current !== null) {
            cancelAnimationFrame(playbackFrameRef.current);
            playbackFrameRef.current = null;
          }
          setIsPlaying(false);
          playbackOffsetSecRef.current = 0;
          setPlaybackSec(0);
        }
      };

      source.start(0, safeOffset);
      playbackFrameRef.current = requestAnimationFrame(updatePlayhead);
    },
    [ensureAudioContext, playbackGain, stopClickPreview, stopPlayback, take],
  );

  const togglePlayback = useCallback(async () => {
    if (!take) return;

    if (isPlaying) {
      const ctx = audioContextRef.current;
      if (ctx) {
        const current =
          playbackOffsetSecRef.current +
          (ctx.currentTime - playbackStartContextTimeRef.current);
        playbackOffsetSecRef.current =
          current < take.durationSec ? current : 0;
        setPlaybackSec(playbackOffsetSecRef.current);
      }
      stopPlayback(false);
      return;
    }

    const startFrom =
      playbackOffsetSecRef.current > 0 &&
      playbackOffsetSecRef.current < take.durationSec - 0.1
        ? playbackOffsetSecRef.current
        : 0;
    await startPlaybackFrom(startFrom);
  }, [isPlaying, startPlaybackFrom, stopPlayback, take]);

  const handleRetake = useCallback(() => {
    stopClickPreview();
    stopPlayback(true);
    setTake(null);
    setIsKept(false);
    setDecodeError(null);
    setElapsedSec(0);
    setPhase("idle");
  }, [stopClickPreview, stopPlayback]);

  const handleKeep = useCallback(() => {
    if (!take) return;
    setIsKept(true);
    onKeepTake?.(take);
  }, [onKeepTake, take]);

  const meterPercent = Math.round(inputLevel * 100);
  const volumePercent = Math.round(
    clampMetronomeVolume(metronomeVolume) * 100,
  );
  const micBoostPercent = Math.round(micBoost * 100);
  const playbackGainPercent = Math.round(playbackGain * 100);
  const playbackProgress =
    take && take.durationSec > 0
      ? Math.min(1, Math.max(0, playbackSec / take.durationSec))
      : 0;
  const controlsLocked =
    phase === "requesting" ||
    phase === "count-in" ||
    phase === "recording" ||
    phase === "decoding";

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-medium">1. Vocal Recorder</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Mono vocal capture with studio clarity EQ, rumble filter, and volume
              boost. Max {formatDuration(MAX_RECORDING_SECONDS)}.
            </p>
          </div>
          {phase === "count-in" ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-950/80 px-3 py-1 text-xs font-medium text-amber-200 ring-1 ring-amber-700">
              <span className="h-2 w-2 animate-ping rounded-full bg-amber-400" />
              Count-in ({bpm} BPM)
            </span>
          ) : phase === "recording" ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-red-950/80 px-3 py-1 text-xs font-medium text-red-200 ring-1 ring-red-800">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
              Recording{metronomeEnabled ? ` · ${bpm} BPM` : ""}
            </span>
          ) : phase === "review" && take ? (
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ${
                isKept
                  ? "bg-emerald-950/80 text-emerald-200 ring-emerald-800"
                  : "bg-zinc-900 text-zinc-300 ring-zinc-700"
              }`}
            >
              {isKept ? "Take kept" : "Ready to review"}
            </span>
          ) : null}
        </div>

        {/* Vocal Clarity, Noise Cancelling & Mic Gain Boost Controls */}
        <div className="mt-5 rounded-lg border border-zinc-800/90 bg-zinc-900/35 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Vocal Clarity &amp; Volume Boost
            </h3>
            <span className="text-xs text-emerald-300">
              85 Hz rumble cut · 3.2 kHz clarity EQ · Soft noise gate
            </span>
          </div>

          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <label className="inline-flex cursor-pointer items-start gap-2.5 select-none">
              <input
                type="checkbox"
                checked={noiseReductionEnabled}
                disabled={controlsLocked}
                onChange={(event) => setNoiseReductionEnabled(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-emerald-500 focus:ring-2 focus:ring-emerald-400 disabled:opacity-50"
              />
              <span className="text-xs text-zinc-200">
                <strong className="block font-medium text-zinc-100">
                  Noise reduction &amp; clarity
                </strong>
                Cuts room hiss, cord rumble &amp; adds vocal presence
              </span>
            </label>

            <label className="inline-flex cursor-pointer items-start gap-2.5 select-none">
              <input
                type="checkbox"
                checked={autoNormalizeEnabled}
                disabled={controlsLocked}
                onChange={(event) => setAutoNormalizeEnabled(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-emerald-500 focus:ring-2 focus:ring-emerald-400 disabled:opacity-50"
              />
              <span className="text-xs text-zinc-200">
                <strong className="block font-medium text-zinc-100">
                  Auto-maximize vocal loudness
                </strong>
                Normalizes quiet headset takes to full studio volume
              </span>
            </label>

            <div>
              <div className="flex items-center justify-between text-xs">
                <label
                  htmlFor="mic-boost-slider"
                  className="font-medium text-zinc-200"
                >
                  Mic input boost
                </label>
                <span className="font-mono tabular-nums text-emerald-300">
                  {micBoostPercent}%
                </span>
              </div>
              <input
                id="mic-boost-slider"
                type="range"
                min={100}
                max={300}
                step={10}
                value={micBoostPercent}
                onChange={(event) =>
                  setMicBoost(Number(event.target.value) / 100)
                }
                className="mt-1.5 w-full accent-emerald-400"
              />
            </div>
          </div>
        </div>

        {/* Optional Metronome & 1-Bar Count-In Panel (Stage 2.2) */}
        <div className="mt-4 rounded-lg border border-zinc-800/90 bg-zinc-900/35 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex cursor-pointer items-center gap-3 select-none">
              <input
                type="checkbox"
                checked={metronomeEnabled}
                disabled={controlsLocked}
                onChange={(event) => {
                  const nextChecked = event.target.checked;
                  setMetronomeEnabled(nextChecked);
                  if (!nextChecked && isPreviewingClick) {
                    stopClickPreview();
                  }
                }}
                className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-emerald-500 focus:ring-2 focus:ring-emerald-400 disabled:opacity-50"
              />
              <span className="text-sm font-medium text-zinc-100">
                Metronome click &amp; 1-bar count-in
              </span>
            </label>
            <span className="rounded bg-zinc-800/90 px-2.5 py-0.5 font-mono text-xs text-zinc-300">
              4/4 time · Accent beat 1
            </span>
          </div>

          {metronomeEnabled ? (
            <div className="mt-4 space-y-4 border-t border-zinc-800/80 pt-4">
              <p className="rounded-md border border-amber-800/60 bg-amber-950/35 px-3 py-2 text-xs text-amber-200">
                Use wired headphones so the click isn&apos;t recorded.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* BPM Input, Step Buttons & Slider */}
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="metronome-bpm-input"
                      className="text-xs font-medium text-zinc-300"
                    >
                      Tempo (BPM, {MIN_METRONOME_BPM}–{MAX_METRONOME_BPM})
                    </label>
                    <span className="font-mono text-xs text-emerald-300">
                      {bpm} BPM (known)
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={controlsLocked || bpm <= MIN_METRONOME_BPM}
                      onClick={() => applyBpm(bpm - 5)}
                      className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 font-mono text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
                    >
                      -5
                    </button>
                    <button
                      type="button"
                      disabled={controlsLocked || bpm <= MIN_METRONOME_BPM}
                      onClick={() => applyBpm(bpm - 1)}
                      className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 font-mono text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
                    >
                      -1
                    </button>
                    <input
                      id="metronome-bpm-input"
                      type="number"
                      inputMode="numeric"
                      min={MIN_METRONOME_BPM}
                      max={MAX_METRONOME_BPM}
                      value={bpmInput}
                      disabled={controlsLocked}
                      onChange={(event) => {
                        setBpmInput(event.target.value);
                        const parsed = Number(event.target.value);
                        if (
                          Number.isFinite(parsed) &&
                          parsed >= MIN_METRONOME_BPM &&
                          parsed <= MAX_METRONOME_BPM
                        ) {
                          const rounded = Math.round(parsed);
                          setBpm(rounded);
                          metronomeBpmRef.current = rounded;
                        }
                      }}
                      onBlur={() => applyBpm(Number(bpmInput))}
                      className="w-20 rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-center font-mono text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none disabled:opacity-50"
                    />
                    <button
                      type="button"
                      disabled={controlsLocked || bpm >= MAX_METRONOME_BPM}
                      onClick={() => applyBpm(bpm + 1)}
                      className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 font-mono text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      disabled={controlsLocked || bpm >= MAX_METRONOME_BPM}
                      onClick={() => applyBpm(bpm + 5)}
                      className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 font-mono text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
                    >
                      +5
                    </button>
                  </div>
                  <input
                    type="range"
                    aria-label="Tempo BPM slider"
                    min={MIN_METRONOME_BPM}
                    max={MAX_METRONOME_BPM}
                    value={bpm}
                    disabled={controlsLocked}
                    onChange={(event) => applyBpm(Number(event.target.value))}
                    className="mt-2 w-full accent-emerald-400 disabled:opacity-50"
                  />
                </div>

                {/* Click Volume & Test Click Button */}
                <div className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <label
                        htmlFor="metronome-volume"
                        className="font-medium text-zinc-300"
                      >
                        Click volume
                      </label>
                      <span className="font-mono tabular-nums text-zinc-400">
                        {volumePercent}%
                      </span>
                    </div>
                    <input
                      id="metronome-volume"
                      type="range"
                      min={0}
                      max={100}
                      value={volumePercent}
                      onChange={(event) =>
                        setMetronomeVolume(
                          clampMetronomeVolume(Number(event.target.value) / 100),
                        )
                      }
                      className="mt-2 w-full accent-emerald-400"
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={controlsLocked}
                      onClick={() => void toggleClickPreview()}
                      className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
                    >
                      {isPreviewingClick ? "Stop click test" : "Test click"}
                    </button>

                    {/* 4-beat visual pulse indicator */}
                    <div
                      aria-label="4/4 beat indicator"
                      className="flex items-center gap-1.5"
                    >
                      {Array.from({ length: BEATS_PER_BAR }, (_, idx) => {
                        const beatNumber = (idx + 1) as 1 | 2 | 3 | 4;
                        const isActive = beatDisplay?.beatInBar === beatNumber;
                        const isAccentBeat = beatNumber === 1;
                        return (
                          <span
                            key={beatNumber}
                            className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs font-semibold transition-transform ${
                              isActive
                                ? isAccentBeat
                                  ? "scale-110 bg-amber-400 text-zinc-950"
                                  : "scale-105 bg-emerald-400 text-zinc-950"
                                : "bg-zinc-800 text-zinc-400"
                            }`}
                          >
                            {beatNumber}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Friendly microphone error & device instructions */}
        {micError ? (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-amber-800/80 bg-amber-950/40 p-4 text-sm text-amber-100"
          >
            <p className="font-medium text-amber-200">{micError.title}</p>
            <p className="mt-1 text-amber-100/90">{micError.message}</p>
            {micError.showPermissionHelp ? (
              <div className="mt-3 space-y-2 border-t border-amber-800/60 pt-3 text-xs text-amber-100/90">
                <p className="font-medium text-amber-200">
                  How to re-enable your microphone:
                </p>
                <ul className="list-disc space-y-1.5 pl-4">
                  <li>
                    <strong>iPhone / iPad (Safari):</strong> Tap the{" "}
                    <span className="font-mono">aA</span> or page settings icon in the
                    address bar &rarr; <strong>Website Settings</strong> &rarr;{" "}
                    <strong>Microphone</strong> &rarr; select <strong>Allow</strong>, then
                    reload this page.
                  </li>
                  <li>
                    <strong>Android (Chrome):</strong> Tap the{" "}
                    <strong>site controls / lock icon</strong> next to the address bar
                    &rarr; <strong>Permissions</strong> &rarr;{" "}
                    <strong>Microphone</strong> &rarr; select <strong>Allow</strong>, then
                    tap <strong>Record vocal</strong> again.
                  </li>
                  <li>
                    <strong>Computer (Chrome / Safari / Edge):</strong> Click the{" "}
                    <strong>microphone or site settings icon</strong> in the address bar,
                    set Microphone to <strong>Allow</strong>, and try again.
                  </li>
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {decodeError ? (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-red-800/80 bg-red-950/40 p-4 text-sm text-red-200"
          >
            {decodeError}
          </div>
        ) : null}

        {/* Idle / Requesting / Count-in / Recording / Decoding Controls */}
        {phase !== "review" ? (
          <div className="mt-6 flex flex-col items-center rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-6 text-center">
            {phase === "count-in" ? (
              <div role="status" aria-live="polite" className="mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                  1-Bar Count-In · Get ready to sing
                </p>
                <p className="mt-1 font-mono text-4xl font-bold text-amber-300 sm:text-5xl">
                  Beat {beatDisplay?.beatInBar ?? 1} of 4
                </p>
              </div>
            ) : (
              <div className="font-mono text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">
                {formatDuration(elapsedSec)}{" "}
                <span className="text-lg font-normal text-zinc-500">
                  / {formatDuration(MAX_RECORDING_SECONDS)}
                </span>
              </div>
            )}

            {/* Live Input Level Meter */}
            <div className="mt-5 w-full max-w-md">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span id="mic-level-label">Input level</span>
                <span className="font-mono tabular-nums">
                  {phase === "recording" || phase === "count-in"
                    ? `${meterPercent}%`
                    : "—"}
                </span>
              </div>
              <div
                role="meter"
                aria-labelledby="mic-level-label"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={
                  phase === "recording" || phase === "count-in" ? meterPercent : 0
                }
                className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-zinc-800"
              >
                <div
                  className={`h-full transition-[width] duration-75 ${
                    meterPercent > 88
                      ? "bg-red-500"
                      : meterPercent > 65
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                  }`}
                  style={{
                    width: `${
                      phase === "recording" || phase === "count-in"
                        ? meterPercent
                        : 0
                    }%`,
                  }}
                />
              </div>
              <p className="mt-1.5 text-xs text-zinc-500">
                {phase === "count-in"
                  ? "Recording starts automatically after beat 4…"
                  : phase === "recording"
                    ? meterPercent > 88
                      ? "Strong signal — lower Mic input boost slightly if it clips."
                      : meterPercent > 8
                        ? "Good vocal level."
                        : "Sing into your wired headphone mic…"
                    : "Hold your wired headphone mic close to your mouth for the clearest tone."}
              </p>
            </div>

            {/* Primary Record / Stop Button */}
            <div className="mt-6">
              {phase === "recording" || phase === "count-in" ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="inline-flex min-h-14 min-w-52 items-center justify-center gap-3 rounded-full bg-zinc-100 px-8 py-4 text-base font-semibold text-zinc-950 shadow-lg hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <span className="h-3.5 w-3.5 rounded-xs bg-red-600" />
                  {phase === "count-in" ? "Cancel count-in" : "Stop recording"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={phase === "requesting" || phase === "decoding"}
                  className="inline-flex min-h-14 min-w-52 items-center justify-center gap-3 rounded-full bg-red-600 px-8 py-4 text-base font-semibold text-white shadow-lg hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="h-3.5 w-3.5 rounded-full bg-white" />
                  {phase === "requesting"
                    ? "Allow microphone…"
                    : phase === "decoding"
                      ? "Enhancing & decoding take…"
                      : metronomeEnabled
                        ? `Count-in & Record (${bpm} BPM)`
                        : "Record vocal"}
                </button>
              )}
            </div>
          </div>
        ) : null}

        {/* Review Take: Waveform Preview, Playback Volume, Retake & Keep */}
        {phase === "review" && take ? (
          <div className="mt-6 space-y-5 rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
            {take.reachedMaxLength ? (
              <p className="rounded-md border border-amber-800/70 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
                Reached the 3:00 maximum recording length and stopped automatically.
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="font-mono tabular-nums text-zinc-200">
                {formatDuration(isPlaying || playbackSec > 0 ? playbackSec : take.durationSec)}{" "}
                <span className="text-zinc-500">
                  / {formatDuration(take.durationSec)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                {take.bpm !== null && take.bpmConfidence === "known" ? (
                  <span className="rounded bg-emerald-950/90 px-2 py-0.5 font-mono text-emerald-300 ring-1 ring-emerald-800">
                    {take.bpm} BPM · Known (metronome)
                  </span>
                ) : (
                  <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-zinc-300">
                    Free tempo (no click)
                  </span>
                )}
                <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-zinc-300">
                  {normalizeMimeLabel(take.mimeType)}
                </span>
                <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-zinc-300">
                  {Math.round(take.sampleRate / 100) / 10} kHz mono
                </span>
              </div>
            </div>

            {/* Interactive Waveform Preview */}
            <div>
              <p className="sr-only" id="waveform-label">
                Recorded vocal waveform preview. Click a bar to jump to that point in the take.
              </p>
              <div
                role="group"
                aria-labelledby="waveform-label"
                className="flex h-24 w-full items-center gap-1 rounded-lg border border-zinc-800/90 bg-zinc-950 px-3 py-2"
              >
                {take.peaks.map((peak, index) => {
                  const barProgress = (index + 0.5) / take.peaks.length;
                  const isPlayed =
                    (isPlaying || playbackSec > 0) &&
                    barProgress <= playbackProgress;
                  const heightPercent = Math.max(8, Math.round(peak * 100));

                  return (
                    <button
                      key={index}
                      type="button"
                      aria-label={`Seek to ${formatDuration(barProgress * take.durationSec)}`}
                      onClick={() =>
                        void startPlaybackFrom(barProgress * take.durationSec)
                      }
                      className="group flex h-full flex-1 items-center justify-center focus-visible:outline-1 focus-visible:outline-white"
                    >
                      <span
                        className={`w-full rounded-full transition-colors ${
                          isPlayed
                            ? "bg-emerald-400"
                            : "bg-zinc-600 group-hover:bg-zinc-400"
                        }`}
                        style={{ height: `${heightPercent}%` }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Playback Volume Control */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-zinc-800/80 bg-zinc-950/60 px-3.5 py-2.5 text-xs">
              <label
                htmlFor="playback-volume-slider"
                className="font-medium text-zinc-300"
              >
                Playback volume boost
              </label>
              <div className="flex flex-1 items-center gap-3 sm:max-w-xs">
                <input
                  id="playback-volume-slider"
                  type="range"
                  min={50}
                  max={200}
                  step={5}
                  value={playbackGainPercent}
                  onChange={(event) =>
                    setPlaybackGain(Number(event.target.value) / 100)
                  }
                  className="w-full accent-emerald-400"
                />
                <span className="w-12 text-right font-mono tabular-nums text-emerald-300">
                  {playbackGainPercent}%
                </span>
              </div>
            </div>

            {/* Playback, Retake, and Keep Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => void togglePlayback()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-zinc-100 px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {isPlaying ? "Pause playback" : "Play take"}
              </button>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Retake
                </button>
                <button
                  type="button"
                  onClick={handleKeep}
                  className={`inline-flex min-h-11 items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                    isKept
                      ? "bg-emerald-700 text-white"
                      : "bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                  }`}
                >
                  {isKept ? "Take kept ✓" : "Keep take"}
                </button>
              </div>
            </div>

            {isKept ? (
              <div
                role="status"
                className="rounded-lg border border-emerald-800/70 bg-emerald-950/40 p-3.5 text-xs text-emerald-200"
              >
                Take kept in memory ({formatDuration(take.durationSec)}
                {take.bpm !== null
                  ? `, ${take.bpm} BPM known from metronome`
                  : ", free tempo"}
                , decoded {take.audioBuffer.length.toLocaleString()} samples). Tempo/key
                detection (Step 2.3) and saving to your library (Step 2.4) will use this
                decoded take.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
