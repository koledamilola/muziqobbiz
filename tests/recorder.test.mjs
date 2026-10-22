import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

function loadAudioModule(relativePath) {
  const source = readFileSync(
    new URL(relativePath, import.meta.url),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const exports = {};
  vm.runInNewContext(
    outputText,
    { exports, Math, Number, String, Array, Object },
    { filename: relativePath },
  );
  return exports;
}

const recorder = loadAudioModule("../src/lib/audio/recorder.ts");
const metronome = loadAudioModule("../src/lib/audio/metronome.ts");

test("VOCAL_AUDIO_CONSTRAINTS disables speech call filters and requests mono", () => {
  assert.equal(recorder.VOCAL_AUDIO_CONSTRAINTS.channelCount, 1);
  assert.equal(recorder.VOCAL_AUDIO_CONSTRAINTS.echoCancellation, false);
  assert.equal(recorder.VOCAL_AUDIO_CONSTRAINTS.noiseSuppression, false);
  assert.equal(recorder.VOCAL_AUDIO_CONSTRAINTS.autoGainControl, false);
  assert.equal(recorder.MAX_RECORDING_SECONDS, 180);
});

test("detectRecordingMimeType picks audio/webm on Chrome/Android and audio/mp4 on iOS Safari", () => {
  const chromeMime = recorder.detectRecordingMimeType(
    (mime) => mime === "audio/webm;codecs=opus" || mime === "audio/webm",
  );
  assert.equal(chromeMime, "audio/webm;codecs=opus");

  const iosSafariMime = recorder.detectRecordingMimeType(
    (mime) => mime === "audio/mp4;codecs=mp4a.40.2" || mime === "audio/mp4",
  );
  assert.equal(iosSafariMime, "audio/mp4;codecs=mp4a.40.2");

  const fallbackMime = recorder.detectRecordingMimeType(() => false);
  assert.equal(fallbackMime, "");
});

test("formatDuration formats seconds as M:SS and clamps invalid or negative values", () => {
  assert.equal(recorder.formatDuration(0), "0:00");
  assert.equal(recorder.formatDuration(9.8), "0:09");
  assert.equal(recorder.formatDuration(65), "1:05");
  assert.equal(recorder.formatDuration(180), "3:00");
  assert.equal(recorder.formatDuration(-5), "0:00");
  assert.equal(recorder.formatDuration(Number.NaN), "0:00");
});

test("computeRmsLevel returns 0 for silence and scales active vocal signal into [0, 1]", () => {
  assert.equal(recorder.computeRmsLevel(new Float32Array(128)), 0);
  const moderate = recorder.computeRmsLevel(new Float32Array(128).fill(0.25));
  assert.ok(moderate > 0.4 && moderate < 0.9);
  const loud = recorder.computeRmsLevel(new Float32Array(128).fill(1.0));
  assert.equal(loud, 1);
});

test("computeWaveformPeaks normalizes peaks across the requested bar count", () => {
  const samples = new Float32Array([0.1, -0.2, 0.5, -1.0, 0.25, -0.5, 0.05, 0.1]);
  const peaks = recorder.computeWaveformPeaks(samples, 4);
  assert.equal(peaks.length, 4);
  assert.equal(peaks[1], 1);
  assert.ok(peaks.every((p) => p >= 0.06 && p <= 1));

  const silentPeaks = recorder.computeWaveformPeaks(new Float32Array(16), 8);
  assert.equal(silentPeaks.length, 8);
  assert.ok(silentPeaks.every((p) => p === 0.05));
});

test("classifyMicError distinguishes permission denial, missing mic, and busy mic", () => {
  const denied = recorder.classifyMicError({ name: "NotAllowedError" });
  assert.match(denied.title, /blocked/i);
  assert.equal(denied.showPermissionHelp, true);

  const missing = recorder.classifyMicError({ name: "NotFoundError" });
  assert.match(missing.title, /No microphone/i);
  assert.equal(missing.showPermissionHelp, false);

  const busy = recorder.classifyMicError({ name: "NotReadableError" });
  assert.match(busy.title, /busy/i);
  assert.equal(busy.showPermissionHelp, false);
});

test("decodeRecordingBlob resumes suspended AudioContext and decodes a detached ArrayBuffer copy", async () => {
  let resumed = false;
  let receivedByteLength = 0;
  const fakeBuffer = { duration: 12.5, sampleRate: 48000, length: 600000 };
  const fakeContext = {
    state: "suspended",
    async resume() {
      resumed = true;
      this.state = "running";
    },
    async decodeAudioData(ab) {
      receivedByteLength = ab.byteLength;
      return fakeBuffer;
    },
  };
  const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/mp4" });
  const decoded = await recorder.decodeRecordingBlob(blob, fakeContext);
  assert.equal(resumed, true);
  assert.equal(receivedByteLength, 4);
  assert.equal(decoded, fakeBuffer);
});

test("metronome clamps BPM to 60–180 (default 90) and computes 4/4 count-in duration", () => {
  assert.equal(metronome.DEFAULT_METRONOME_BPM, 90);
  assert.equal(metronome.BEATS_PER_BAR, 4);
  assert.equal(metronome.COUNT_IN_BEATS, 4);
  assert.equal(metronome.clampMetronomeBpm(40), 60);
  assert.equal(metronome.clampMetronomeBpm(220), 180);
  assert.equal(metronome.clampMetronomeBpm(120.4), 120);
  assert.equal(metronome.clampMetronomeBpm(Number.NaN), 90);
  assert.equal(metronome.secondsPerBeat(120), 0.5);
  assert.equal(metronome.countInDurationSec(120), 2.0);
});

test("computeScheduledBeatsInWindow schedules exact Web Audio clock timestamps with beat 1 accented", () => {
  const beats = metronome.computeScheduledBeatsInWindow({
    startContextTime: 10.0,
    bpm: 120, // 0.5s per beat
    fromBeatIndex: 0,
    windowEndContextTime: 12.6,
    includeCountIn: true,
  });

  assert.equal(beats.length, 6); // beats 0..5 at 10.0, 10.5, 11.0, 11.5, 12.0, 12.5
  assert.deepEqual(
    Array.from(beats, (b) => ({
      idx: b.beatIndex,
      barBeat: b.beatInBar,
      accent: b.isAccent,
      countIn: b.isCountIn,
      t: b.timeSec,
    })),
    [
      { idx: 0, barBeat: 1, accent: true, countIn: true, t: 10.0 },
      { idx: 1, barBeat: 2, accent: false, countIn: true, t: 10.5 },
      { idx: 2, barBeat: 3, accent: false, countIn: true, t: 11.0 },
      { idx: 3, barBeat: 4, accent: false, countIn: true, t: 11.5 },
      { idx: 4, barBeat: 1, accent: true, countIn: false, t: 12.0 },
      { idx: 5, barBeat: 2, accent: false, countIn: false, t: 12.5 },
    ],
  );
});

test("getBeatDisplayAtTime tracks 1-bar count-in beats and recording beats", () => {
  const firstBeat = metronome.getBeatDisplayAtTime({
    startContextTime: 5.0,
    currentContextTime: 5.1,
    bpm: 120,
    includeCountIn: true,
  });
  assert.equal(firstBeat.beatInBar, 1);
  assert.equal(firstBeat.isAccent, true);
  assert.equal(firstBeat.isCountIn, true);
  assert.equal(firstBeat.countInBeatsRemaining, 4);

  const recordingDownbeat = metronome.getBeatDisplayAtTime({
    startContextTime: 5.0,
    currentContextTime: 7.05,
    bpm: 120,
    includeCountIn: true,
  });
  assert.equal(recordingDownbeat.beatIndex, 4);
  assert.equal(recordingDownbeat.beatInBar, 1);
  assert.equal(recordingDownbeat.isCountIn, false);
  assert.equal(recordingDownbeat.countInBeatsRemaining, 0);
});

test("scheduleMetronomeClick schedules oscillator and gain on Web Audio clock and respects mute", () => {
  const scheduled = [];
  const fakeContext = {
    currentTime: 1.0,
    destination: { id: "dest" },
    createOscillator() {
      return {
        type: "sine",
        frequency: {
          setValueAtTime(hz, t) {
            scheduled.push(["freq", hz, t]);
          },
        },
        connect() {},
        start(t) {
          scheduled.push(["start", t]);
        },
        stop(t) {
          scheduled.push(["stop", t]);
        },
      };
    },
    createGain() {
      return {
        gain: {
          setValueAtTime() {},
          linearRampToValueAtTime(val) {
            scheduled.push(["peak", val]);
          },
          exponentialRampToValueAtTime() {},
        },
        connect() {},
      };
    },
  };

  metronome.scheduleMetronomeClick(
    fakeContext,
    { timeSec: 1.25, isAccent: true },
    0,
  );
  assert.equal(scheduled.length, 0);

  metronome.scheduleMetronomeClick(
    fakeContext,
    { timeSec: 1.25, isAccent: true },
    0.8,
  );
  assert.deepEqual(scheduled[0], ["freq", metronome.ACCENT_FREQUENCY_HZ, 1.25]);
  assert.deepEqual(scheduled[2], ["start", 1.25]);
});


