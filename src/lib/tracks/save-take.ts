import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";
import { vocalPath, type TakeInput } from "./take-input";

// Session client only: signed uploads remain owner-scoped through Storage RLS.
// https://supabase.com/docs/guides/storage/uploads/resumable-uploads#presigned-uploads
// https://supabase.com/docs/reference/javascript/file-buckets-info
export async function saveTake(supabase: SupabaseClient<Database>, ownerId: string, input: TakeInput, action: "prepare" | "finalize") {
  const path = vocalPath(ownerId, input.id);
  const bucket = supabase.storage.from("vocals");
  const existing = await supabase.from("tracks").select("id,title,vocal_path")
    .eq("id", input.id).eq("user_id", ownerId).maybeSingle();
  if (existing.error) throw new Error("Could not check saved take. Retry without recording again.");
  const savedResult = async (title: string) => {
    const playback = await bucket.createSignedUrl(path, 3600);
    // The row/file are saved even if a temporary playback link cannot be issued.
    return { saved: true as const, id: input.id, title, playbackUrl: playback.data?.signedUrl ?? null };
  };
  if (existing.data) {
    if (existing.data.vocal_path !== path) throw new Error("This take ID is already in use.");
    return savedResult(existing.data.title);
  }
  const info = await bucket.info(path);
  if (info.data && (info.data.size !== input.size || info.data.contentType !== input.mimeType)) {
    throw new Error("The uploaded file does not match this take.");
  }
  if (action === "prepare") {
    if (info.data) return { saved: false as const, uploaded: true as const, path };
    if (info.error && !["404", "400"].includes(String(info.error.statusCode))) {
      throw new Error("Could not check vocal storage. Retry in a moment.");
    }
    const signed = await bucket.createSignedUploadUrl(path);
    if (signed.error || !signed.data) throw new Error("Could not start your upload. Retry in a moment.");
    return { saved: false as const, uploaded: false as const, path, token: signed.data.token };
  }
  if (info.error || !info.data) throw new Error("The vocal upload has not finished. Retry to continue it.");
  const title = `Untitled take ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`;
  const inserted = await supabase.from("tracks").insert({
    id: input.id, user_id: ownerId, title, mode: "vocal_first", tier: "draft",
    release_ready: false, ai_assisted: true, vocal_path: path,
    bpm: input.settings.bpm, musical_key: input.settings.musicalKey, energy: input.settings.energy,
    vocal_fx: { capture: { mimeType: input.mimeType, size: input.size, durationSec: input.durationSec }, analysisSources: input.settings.sources },
  });
  if (inserted.error) {
    // A lost response or concurrent retry must not create a second track.
    if (inserted.error.code === "23505") {
      const retry = await supabase.from("tracks").select("title,vocal_path")
        .eq("id", input.id).eq("user_id", ownerId).single();
      if (retry.data?.vocal_path === path) return savedResult(retry.data.title);
    }
    throw new Error("Your vocal is uploaded, but its details were not saved. Retry; the audio will not be uploaded twice.");
  }
  return savedResult(title);
}
