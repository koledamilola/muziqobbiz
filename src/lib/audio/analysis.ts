export const NOTES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;
export const MUSICAL_KEYS = NOTES.flatMap((note) => [`${note} major`, `${note} minor`]);
export type Energy = "low" | "medium" | "high";
export type ValueSource = "detected" | "metronome" | "user";
export type AnalysisResult = {
  bpm: number | null;
  bpmConfidence: number | null;
  key: string | null;
  keyStrength: number | null;
  rms: number;
  warnings: string[];
};
export type TakeSettings = {
  bpm: number | null;
  musicalKey: string | null;
  energy: Energy;
  sources: { bpm: ValueSource; key: ValueSource; energy: ValueSource };
};

export function normalizeKey(key: string | null): string | null {
  const aliases: Record<string, string> = { Db: "C#", "D#": "Eb", Gb: "F#", "G#": "Ab", "A#": "Bb" };
  if (!key) return null;
  const [note, scale] = key.split(" ");
  const normalized = `${aliases[note] ?? note} ${scale}`;
  return MUSICAL_KEYS.includes(normalized) ? normalized : null;
}

export function energyFromRms(rms: number): Energy {
  const db = 20 * Math.log10(Math.max(rms, 1e-9));
  return db < -26 ? "low" : db < -16 ? "medium" : "high";
}

export function settingsFromAnalysis(result: AnalysisResult, knownBpm: number | null): TakeSettings {
  return {
    bpm: knownBpm ?? result.bpm,
    musicalKey: normalizeKey(result.key),
    energy: energyFromRms(result.rms),
    sources: { bpm: knownBpm ? "metronome" : "detected", key: "detected", energy: "detected" },
  };
}
