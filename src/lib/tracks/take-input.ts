import { MUSICAL_KEYS, type TakeSettings } from "../audio/analysis";

export const MAX_TAKE_BYTES = 40 * 1024 * 1024;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type TakeInput = { id: string; size: number; mimeType: "audio/wav"; durationSec: number; settings: TakeSettings };

export function parseTakeInput(value: unknown): TakeInput | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<TakeInput>;
  const s = v.settings;
  if (!v.id || !UUID_PATTERN.test(v.id) || v.mimeType !== "audio/wav"
    || !Number.isInteger(v.size) || v.size! < 46 || v.size! > MAX_TAKE_BYTES
    || !Number.isFinite(v.durationSec) || v.durationSec! <= 0 || v.durationSec! > 182
    || !s || typeof s !== "object"
    || (s.bpm !== null && (!Number.isFinite(s.bpm) || s.bpm < 40 || s.bpm > 250))
    || (s.musicalKey !== null && !MUSICAL_KEYS.includes(s.musicalKey))
    || !["low", "medium", "high"].includes(s.energy)
    || !s.sources || ![s.sources.bpm, s.sources.key, s.sources.energy].every((x) => ["detected", "metronome", "user"].includes(x))) return null;
  return { id: v.id, size: v.size!, mimeType: "audio/wav", durationSec: v.durationSec!, settings: s };
}

export function vocalPath(ownerId: string, takeId: string): string {
  return `${ownerId}/${takeId}/vocal.wav`;
}

export function signedTusEndpoint(projectUrl: string): string {
  const endpoint = new URL(projectUrl);
  if (endpoint.hostname.endsWith(".supabase.co")) endpoint.hostname = endpoint.hostname.replace(".supabase.co", ".storage.supabase.co");
  endpoint.pathname = "/storage/v1/upload/resumable/sign";
  endpoint.search = "";
  endpoint.hash = "";
  return endpoint.toString();
}
