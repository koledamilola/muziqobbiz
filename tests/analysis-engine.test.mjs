import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Essentia = require("essentia.js/dist/essentia.js-core.umd.js");
const wasm = require("essentia.js/dist/essentia-wasm.umd.js");

test("the pinned Essentia engine detects a C-major fixture with 120 BPM pulses", () => {
  const engine = new Essentia(wasm);
  const samples = Float32Array.from({ length: 44100 * 12 }, (_, i) => {
    const t = i / 44100;
    const beat = t % 0.5;
    return 0.07 * (Math.sin(2 * Math.PI * 261.6256 * t) + Math.sin(2 * Math.PI * 329.6276 * t) + Math.sin(2 * Math.PI * 391.9954 * t))
      + (beat < 0.03 ? 0.25 * Math.exp(-beat * 100) * Math.sin(2 * Math.PI * 1500 * t) : 0);
  });
  const vector = engine.arrayToVector(samples);
  let rhythm;
  try {
    rhythm = engine.RhythmExtractor2013(vector);
    const key = engine.KeyExtractor(vector);
    assert.ok(Math.abs(rhythm.bpm - 120) < 2);
    assert.ok(rhythm.confidence > 0);
    assert.equal(key.key, "C");
    assert.equal(key.scale, "major");
    assert.ok(key.strength > 0.5);
    assert.ok(engine.RMS(vector).rms > 0);
  } finally {
    if (rhythm) for (const value of Object.values(rhythm)) value?.delete?.();
    vector.delete();
    engine.shutdown();
  }
});
