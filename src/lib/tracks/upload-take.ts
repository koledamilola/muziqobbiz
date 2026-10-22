import { getPublicSupabaseEnv } from "../supabase/env";
import { signedTusEndpoint, type TakeInput } from "./take-input";

export type SavedTake = { saved: true; id: string; title: string; playbackUrl: string | null };
type Prepared = SavedTake | { saved: false; uploaded: boolean; path: string; token?: string };

async function requestSave(action: "prepare" | "finalize", take: TakeInput): Promise<Prepared> {
  const response = await fetch("/api/takes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, take }), signal: AbortSignal.timeout(30000) });
  const result = await response.json().catch(() => { throw new Error("Saving could not finish. Keep this tab open, check your connection, and retry."); });
  if (!response.ok) throw new Error(result.error || "Saving failed. Retry without recording again.");
  return result;
}

export async function uploadTake(blob: Blob, take: TakeInput, onProgress: (percent: number) => void, signal: AbortSignal): Promise<SavedTake> {
  const prepared = await requestSave("prepare", take);
  if (prepared.saved) return prepared;
  if (!prepared.uploaded) {
    const { Upload } = await import("tus-js-client");
    const { url, key } = getPublicSupabaseEnv();
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => signal.removeEventListener("abort", abort);
      const abort = () => { void upload.abort(); cleanup(); reject(new DOMException("Cancelled", "AbortError")); };
      const upload = new Upload(blob, {
        // https://github.com/supabase/supabase/blob/master/examples/storage/resumable-upload-signed-uppy/index.html
        endpoint: signedTusEndpoint(url), chunkSize: 6 * 1024 * 1024,
        headers: { "x-signature": prepared.token!, apikey: key },
        metadata: { bucketName: "vocals", objectName: prepared.path, contentType: "audio/wav", cacheControl: "3600" },
        uploadDataDuringCreation: true, removeFingerprintOnSuccess: true,
        retryDelays: [0, 1000, 3000, 5000, 10000],
        fingerprint: async () => `muziqobbiz-vocal-${take.id}`,
        onProgress: (uploaded, total) => onProgress(Math.min(99, Math.floor(uploaded / total * 100))),
        onSuccess: () => { cleanup(); resolve(); },
        onError: () => { cleanup(); reject(new Error("Upload interrupted. Keep this page open and retry to continue.")); },
      });
      if (signal.aborted) { abort(); return; }
      signal.addEventListener("abort", abort, { once: true });
      upload.findPreviousUploads().then((previous) => {
        if (signal.aborted) return;
        if (previous[0]) upload.resumeFromPreviousUpload(previous[0]);
        upload.start();
      }).catch(() => { if (!signal.aborted) upload.start(); });
    });
  }
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  const saved = await requestSave("finalize", take);
  if (!saved.saved) throw new Error("Could not save take details. Retry.");
  onProgress(100);
  return saved;
}
