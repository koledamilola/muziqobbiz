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
    { exports, Math, Number, String, Array, Object, Float32Array, ArrayBuffer, DataView, Blob },
    { filename: relativePath },
  );
  return exports;
}

const recorder = loadAudioModule("../src/lib/audio/recorder.ts");
const metronome = loadAudioModule("../src/lib/audio/metronome.ts");

test("buildVocalAudioConstraints requests mono capture and toggles noise suppression", () => {
  assert.equal(recorder.MAX_RECORDING_SECONDS, 180);

  const withNoiseReduction = recorder.buildVocalAudioConstraints({
    noiseSuppression: true,
  });
  assert.equal(withNoiseReduction.echoCancellation, false);
  assert.equal(withNoiseReduction.channelCount, 1);
  assert.equal(withNoiseReduction.autoGainControl, false);
  assert.equal(withNoiseReduction.noiseSuppression, true);
  assert.equal(recorder.buildVocalAudioConstraints().noiseSuppression, false);
});

test("a short loud bump does not leave a quiet vocal take inaudible or clip it", () => {
  const rate = 48000;
  const input = new Float32Array(rate);
  for (let i = 0; i < rate; i++) {
    input[i] = 0.04 * Math.sin(2 * Math.PI * 440 * i / rate);
  }
  input[rate / 2] = 0.9;
  const output = recorder.cleanAndNormalizeSamples(input, rate, {
    noiseGate: false,
    highPass: false,
  });
  assert.ok(Math.abs(output[rate / 4 + 27]) > 0.2);
  assert.ok(Math.max(...output) <= 0.981);
});

test("enhanced audio is stored in a valid mono 16-bit WAV file", async () => {
  const samples = new Float32Array([0, 0.5, -1, 1]);
  const blob = recorder.encodeWavBlob({
    sampleRate: 48000,
    getChannelData: () => samples,
  });
  assert.equal(blob.type, "audio/wav");
  assert.equal(blob.size, 52);
  const bytes = new DataView(await blob.arrayBuffer());
  assert.equal(bytes.getUint32(4, true), 44);
  assert.equal(bytes.getUint16(22, true), 1);
  assert.equal(bytes.getUint32(24, true), 48000);
  assert.equal(bytes.getInt16(48, true), -32768);
});

test("capture graph routes boosted audio through compression into the recorded stream", () => {
  const edges = [];
  const param = { setValueAtTime() {} };
  const node = (name) => ({
    name,
    connect(target) { edges.push(`${name}->${target.name}`); },
    disconnect() {},
  });
  const mic = { getAudioTracks: () => [{}] };
  const processed = { getAudioTracks: () => [{}] };
  let filterCount = 0;
  const context = {
    currentTime: 1,
    createMediaStreamSource: (stream) => {
      assert.equal(stream, mic);
      return node("mic");
    },
    createBiquadFilter: () => Object.assign(
      node(filterCount++ ? "presence" : "highpass"),
      { frequency: param, Q: param, gain: param },
    ),
    createGain: () => Object.assign(node("boost"), { gain: param }),
    createDynamicsCompressor: () => Object.assign(node("compressor"), {
      threshold: param, knee: param, ratio: param, attack: param, release: param,
    }),
    createAnalyser: () => node("meter"),
    createMediaStreamDestination: () => Object.assign(node("recording"), { stream: processed }),
  };
  const graph = recorder.createVocalCaptureGraph(context, mic, 1.8);
  assert.equal(graph.recordingStream, processed);
  assert.deepEqual(edges, [
    "mic->highpass", "highpass->boost", "boost->presence",
    "presence->compressor", "compressor->meter", "compressor->recording",
  ]);
});

test("cleanAndNormalizeSamples boosts quiet wired-headset vocals and attenuates low-level background hiss", () => {
  const sampleRate = 48000;
  const totalSamples = 4800; // 100ms
  const input = new Float32Array(totalSamples);

  // First half: quiet room hiss (~0.002). Second half: quiet sung note at 440 Hz (~0.15 amplitude).
  for (let i = 0; i < totalSamples; i++) {
    if (i < totalSamples / 2) {
      input[i] = (i % 2 === 0 ? 1 : -1) * 0.002;
    } else {
      input[i] = 0.15 * Math.sin((2 * Math.PI * 440 * i) / sampleRate);
    }
  }

  const cleaned = recorder.cleanAndNormalizeSamples(input, sampleRate, {
    noiseGate: true,
    normalize: true,
  });

  let maxHissPeak = 0;
  for (let i = 100; i < totalSamples / 2 - 100; i++) {
    const abs = Math.abs(cleaned[i]);
    if (abs > maxHissPeak) maxHissPeak = abs;
  }

  let maxSungPeak = 0;
  for (let i = Math.floor(totalSamples * 0.5); i < totalSamples; i++) {
    const abs = Math.abs(cleaned[i]);
    if (abs > maxSungPeak) maxSungPeak = abs;
  }

  // Quiet 0.15 input peak is boosted up to TARGET_VOCAL_PEAK (~0.89), while room hiss stays gated down.
  assert.ok(
    maxSungPeak > 0.85 && maxSungPeak <= 0.98,
    `Expected maxSungPeak in (0.85, 0.98], got ${maxSungPeak} (hiss peak: ${maxHissPeak})`,
  );
  assert.ok(maxHissPeak < 0.01, `Expected hiss peak < 0.01, got ${maxHissPeak}`);
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


