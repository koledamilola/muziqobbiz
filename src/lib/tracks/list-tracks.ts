import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";

export const LIBRARY_PAGE_SIZE = 20;

export function libraryPage(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^[1-9]\d{0,5}$/.test(value)) return 1;
  return Number(value);
}

// Use the owner's session client so both the query and private playback obey RLS.
// https://supabase.com/docs/reference/javascript/select
// https://supabase.com/docs/reference/javascript/range
// https://supabase.com/docs/reference/javascript/storage-from-createsignedurl
export async function listTracks(supabase: SupabaseClient<Database>, ownerId: string, page: number) {
  const offset = (page - 1) * LIBRARY_PAGE_SIZE;
  const { data, error } = await supabase.from("tracks")
    .select("id,title,created_at,bpm,musical_key,energy,vocal_path,tier,release_ready,ai_assisted")
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + LIBRARY_PAGE_SIZE);

  if (error) throw new Error("Could not load your saved recordings. Refresh to try again.");

  const rows = data ?? [];
  const tracks = await Promise.all(rows.slice(0, LIBRARY_PAGE_SIZE).map(async (track) => {
    let playbackUrl: string | null = null;
    if (track.vocal_path?.startsWith(`${ownerId}/`)) {
      try {
        const playback = await supabase.storage.from("vocals").createSignedUrl(track.vocal_path, 3600);
        if (!playback.error) playbackUrl = playback.data?.signedUrl ?? null;
      } catch {
        // A missing/unavailable file must not hide this or other saved tracks.
      }
    }
    const { vocal_path, ...details } = track;
    return { ...details, hasVocal: Boolean(vocal_path), playbackUrl };
  }));

  return { tracks, hasMore: rows.length > LIBRARY_PAGE_SIZE };
}
