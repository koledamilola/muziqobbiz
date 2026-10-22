// Official API / sample-rate requirements checked 2026-10-22:
// https://mtg.github.io/essentia.js/docs/api/tutorial-1.%20Getting%20started.html
// https://essentia.upf.edu/reference/std_RhythmExtractor2013.html
// https://essentia.upf.edu/reference/std_KeyExtractor.html
self.onmessage = async ({ data: { samples, knownBpm } }) => {
  let essentia;
  let vector;
  const dispose = (result) => {
    for (const value of Object.values(result)) value?.delete?.();
  };
  try {
    self.postMessage({ type: "progress", message: "Loading audio analyzer…" });
    const [{ default: Essentia }, { EssentiaWASM }] = await Promise.all([
      import("/vendor/essentia-0.1.3/essentia.js-core.es.min.js"),
      import("/vendor/essentia-0.1.3/essentia-wasm.es.js"),
    ]);
    essentia = new Essentia(EssentiaWASM);
    vector = essentia.arrayToVector(samples);
    const rms = essentia.RMS(vector).rms;
    const result = { bpm: knownBpm, bpmConfidence: null, key: null, keyStrength: null, rms, warnings: [] };
    if (rms < 0.001 || samples.length < 44100 * 2) {
      result.warnings.push("Record at least a few seconds of clear singing for useful estimates.");
    } else {
      if (!knownBpm) {
        self.postMessage({ type: "progress", message: "Estimating tempo…" });
        try {
          const rhythm = essentia.RhythmExtractor2013(vector, 208, "multifeature", 40);
          if (Number.isFinite(rhythm.bpm) && rhythm.bpm > 0 && rhythm.confidence > 0) {
            result.bpm = Math.round(rhythm.bpm);
            result.bpmConfidence = rhythm.confidence;
          }
          dispose(rhythm);
        } catch { result.warnings.push("Tempo could not be estimated. Set it yourself below."); }
      }
      self.postMessage({ type: "progress", message: "Estimating musical key…" });
      try {
        const tonal = essentia.KeyExtractor(vector);
        if (Number.isFinite(tonal.strength) && tonal.strength > 0.1) {
          result.key = `${tonal.key} ${tonal.scale}`;
          result.keyStrength = Math.min(1, Math.max(0, tonal.strength));
        }
      } catch { result.warnings.push("Key could not be estimated. Choose it below."); }
    }
    self.postMessage({ type: "result", result });
  } catch {
    self.postMessage({ type: "error", message: "Analysis could not finish. Retry, or set the values yourself." });
  } finally {
    vector?.delete();
    essentia?.shutdown();
  }
};
