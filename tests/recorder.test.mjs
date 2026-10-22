import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

function loadRecorderModule() {
  const source = readFileSync(
    new URL("../src/lib/audio/recorder.ts", import.meta.url),
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
    { exports, Math, Number, String, Array },
    { filename: "recorder.ts" },
  );
  return exports;
}

const recorder = loadRecorderModule();

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

