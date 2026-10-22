"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  classifyMicError,
  computeRmsLevel,
  computeWaveformPeaks,
  decodeRecordingBlob,
  detectRecordingMimeType,
  formatDuration,
  MAX_RECORDING_SECONDS,
  type MicErrorInfo,
  normalizeMimeLabel,
  type RecordedTake,
  VOCAL_AUDIO_CONSTRAINTS,
} from "@/lib/audio/recorder";

type RecorderPhase = "idle" | "requesting" | "recording" | "decoding" | "review";

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

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordStartMsRef = useRef<number>(0);
  const reachedMaxRef = useRef<boolean>(false);
  const meterFrameRef = useRef<number | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const playbackSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const playbackStartContextTimeRef = useRef<number>(0);
  const playbackOffsetSecRef = useRef<number>(0);
  const playbackFrameRef = useRef<number | null>(null);

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
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setInputLevel(0);
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
    setIsPlaying(false);
    if (resetPosition) {
      playbackOffsetSecRef.current = 0;
      setPlaybackSec(0);
    }
  }, []);

  useEffect(() => {
    return () => {
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
  }, [stopMicStream, stopPlayback]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        stopMicStream();
        setPhase("idle");
      }
    }
  }, [stopMicStream]);

  const startRecording = useCallback(async () => {
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

      // Request mono vocal input with echoCancellation, noiseSuppression, and autoGainControl OFF
      // because speech call filters distort singing pitch, sustain, and dynamics.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: VOCAL_AUDIO_CONSTRAINTS,
      });
      mediaStreamRef.current = stream;

      const preferredMimeType = detectRecordingMimeType();
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      reachedMaxRef.current = false;
      recordStartMsRef.current = performance.now();
      setElapsedSec(0);

      // Set up live input level meter via Web Audio AnalyserNode.
      const sourceNode = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = sourceNode;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      sourceNode.connect(analyser);
      const sampleBuffer = new Float32Array(analyser.fftSize);

      const updateMeterAndTimer = () => {
        analyser.getFloatTimeDomainData(sampleBuffer);
        setInputLevel(computeRmsLevel(sampleBuffer));

        const elapsed = (performance.now() - recordStartMsRef.current) / 1000;
        const clampedElapsed = Math.min(MAX_RECORDING_SECONDS, elapsed);
        setElapsedSec(clampedElapsed);

        if (elapsed >= MAX_RECORDING_SECONDS) {
          reachedMaxRef.current = true;
          if (recorder.state !== "inactive") {
            recorder.stop();
          }
          return;
        }

        meterFrameRef.current = requestAnimationFrame(updateMeterAndTimer);
      };

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
          const audioBuffer = await decodeRecordingBlob(blob, ctx);
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

      // Collect chunks every 250ms so both short and 3-minute takes assemble reliably on mobile.
      recorder.start(250);
      setPhase("recording");
      meterFrameRef.current = requestAnimationFrame(updateMeterAndTimer);
    } catch (error) {
      stopMicStream();
      setMicError(classifyMicError(error));
      setPhase("idle");
    }
  }, [ensureAudioContext, stopMicStream, stopPlayback]);

  const startPlaybackFrom = useCallback(
    async (offsetSec: number) => {
      if (!take) return;
      stopPlayback(false);

      const ctx = await ensureAudioContext();
      const safeOffset = Math.max(
        0,
        Math.min(offsetSec, Math.max(0, take.durationSec - 0.05)),
      );

      const source = ctx.createBufferSource();
      source.buffer = take.audioBuffer;
      source.connect(ctx.destination);

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
    [ensureAudioContext, stopPlayback, take],
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
    stopPlayback(true);
    setTake(null);
    setIsKept(false);
    setDecodeError(null);
    setElapsedSec(0);
    setPhase("idle");
  }, [stopPlayback]);

  const handleKeep = useCallback(() => {
    if (!take) return;
    setIsKept(true);
    onKeepTake?.(take);
  }, [onKeepTake, take]);

  const meterPercent = Math.round(inputLevel * 100);
  const playbackProgress =
    take && take.durationSec > 0
      ? Math.min(1, Math.max(0, playbackSec / take.durationSec))
      : 0;

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-medium">1. Vocal Recorder</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Raw mono vocal capture (speech filters off for natural singing). Max{" "}
              {formatDuration(MAX_RECORDING_SECONDS)}.
            </p>
          </div>
          {phase === "recording" ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-red-950/80 px-3 py-1 text-xs font-medium text-red-200 ring-1 ring-red-800">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
              Recording
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

        {/* Idle / Requesting / Recording / Decoding Controls */}
        {phase !== "review" ? (
          <div className="mt-6 flex flex-col items-center rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-6 text-center">
            <div className="font-mono text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">
              {formatDuration(elapsedSec)}{" "}
              <span className="text-lg font-normal text-zinc-500">
                / {formatDuration(MAX_RECORDING_SECONDS)}
              </span>
            </div>

            {/* Live Input Level Meter */}
            <div className="mt-5 w-full max-w-md">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span id="mic-level-label">Input level</span>
                <span className="font-mono tabular-nums">
                  {phase === "recording" ? `${meterPercent}%` : "—"}
                </span>
              </div>
              <div
                role="meter"
                aria-labelledby="mic-level-label"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={phase === "recording" ? meterPercent : 0}
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
                  style={{ width: `${phase === "recording" ? meterPercent : 0}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-zinc-500">
                {phase === "recording"
                  ? meterPercent > 88
                    ? "Strong signal — step back slightly if it clips."
                    : meterPercent > 8
                      ? "Good vocal level."
                      : "Sing or hum into your mic…"
                  : "Use wired headphones when possible for the cleanest vocal take."}
              </p>
            </div>

            {/* Primary Record / Stop Button */}
            <div className="mt-6">
              {phase === "recording" ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="inline-flex min-h-14 min-w-52 items-center justify-center gap-3 rounded-full bg-zinc-100 px-8 py-4 text-base font-semibold text-zinc-950 shadow-lg hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <span className="h-3.5 w-3.5 rounded-xs bg-red-600" />
                  Stop recording
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
                      ? "Decoding take…"
                      : "Record vocal"}
                </button>
              )}
            </div>
          </div>
        ) : null}

        {/* Review Take: Waveform Preview, Playback, Retake & Keep */}
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
                Take kept in memory ({formatDuration(take.durationSec)}, decoded{" "}
                {take.audioBuffer.length.toLocaleString()} samples). Tempo/key detection
                (Step 2.3) and saving to your library (Step 2.4) will use this decoded
                take.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

