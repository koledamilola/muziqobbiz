// Explicit backend integration check. Run with: node --env-file=.env.local scripts/verify-stage2-storage.mjs
// Uses the server key only in Node; verifies Storage/TUS/row/playback, not browser
// owner authentication or session-client RLS. Only this invocation's new UUID
// and exact path are cleaned up. Never run against reference audio.
import { createClient } from "@supabase/supabase-js";
import { Upload } from "tus-js-client";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import ts from "typescript";

function loadTs(file) {
  const path = resolve(file);
  const source = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function("require", "exports", source)((name) => loadTs(`${resolve(dirname(path), name)}.ts`), exports);
  return exports;
}
const { saveTake } = loadTs("src/lib/tracks/save-take.ts");
const { signedTusEndpoint } = loadTs("src/lib/tracks/take-input.ts");
const { encodeWavBlob } = loadTs("src/lib/audio/recorder.ts");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const client = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const users = await client.auth.admin.listUsers();
if (users.error) throw new Error("Could not find configured owner for backend check.");
const owner = users.data.users.find((user) => user.email?.toLowerCase() === process.env.ALLOWED_EMAIL?.trim().toLowerCase());
if (!owner) throw new Error("Configured owner not found.");
const id = randomUUID();
const path = `${owner.id}/${id}/vocal.wav`;
const durationSec = 70; // Cross the 6 MiB TUS chunk boundary, exercising PATCH too.
const requests = { POST: 0, PATCH: 0 };
const samples = Float32Array.from({ length: 48000 * durationSec }, (_, i) => .05 * Math.sin(2 * Math.PI * 440 * i / 48000));
const blob = encodeWavBlob({ sampleRate: 48000, getChannelData: () => samples });
const take = { id, size: blob.size, mimeType: "audio/wav", durationSec, settings: { bpm: 90, musicalKey: "C major", energy: "low", sources: { bpm: "user", key: "user", energy: "user" } } };
let complete = false;
try {
  const prepared = await saveTake(client, owner.id, take, "prepare");
  if (prepared.saved || prepared.uploaded) throw new Error("Expected a new isolated upload.");
  const uploadBytes = Buffer.from(await blob.arrayBuffer());
  await new Promise((resolveUpload, reject) => {
      const actual = new Upload(uploadBytes, {
        endpoint: signedTusEndpoint(url), chunkSize: 6 * 1024 * 1024,
        headers: { "x-signature": prepared.token, apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
        metadata: { bucketName: "vocals", objectName: path, contentType: "audio/wav", cacheControl: "3600" },
        uploadDataDuringCreation: true, storeFingerprintForResuming: false,
        onAfterResponse: (request, response) => { const method = request.getMethod(); if (response.getStatus() < 300 && method in requests) requests[method]++; },
        retryDelays: [0, 1000], onError: (error) => {
          const status = error.originalResponse?.getStatus();
          let code;
          try { const body = JSON.parse(error.originalResponse?.getBody() || "{}"); code = body.error_code ?? body.code ?? body.error; } catch { code = "unreadable-response"; }
          reject(new Error(`Signed TUS upload failed (HTTP ${status ?? "no response"}, code ${code ?? "unavailable"}).`));
        }, onSuccess: resolveUpload,
      });
      actual.start();
  });
  if (!requests.POST || !requests.PATCH) throw new Error("Multi-chunk upload was not exercised.");
  const saved = await saveTake(client, owner.id, take, "finalize");
  if (!saved.saved || !saved.playbackUrl) throw new Error("Finalization did not return playback.");
  const audio = await fetch(saved.playbackUrl);
  const bytes = await audio.arrayBuffer();
  if (!audio.ok || bytes.byteLength !== blob.size || new TextDecoder().decode(bytes.slice(0, 4)) !== "RIFF") throw new Error("Playback file mismatch.");
  const repeated = await saveTake(client, owner.id, take, "prepare");
  if (!repeated.saved || repeated.id !== id) throw new Error("Retry did not reuse saved row.");
  const rows = await client.from("tracks").select("id,tier,release_ready,ai_assisted,vocal_fx").eq("id", id).eq("user_id", owner.id);
  if (rows.error || rows.data.length !== 1 || rows.data[0].tier !== "draft" || rows.data[0].release_ready || !rows.data[0].ai_assisted) throw new Error("Saved row mismatch.");
  complete = true;
} finally {
  const row = await client.from("tracks").delete().eq("id", id).eq("user_id", owner.id);
  const file = await client.storage.from("vocals").remove([path]);
  const check = await client.from("tracks").select("id").eq("id", id).eq("user_id", owner.id);
  const fileCheck = await client.storage.from("vocals").exists(path);
  const missingFile = fileCheck.data === false && (!fileCheck.error || [400, 404].includes(Number(fileCheck.error.status)));
  if (row.error || file.error || check.error || check.data.length || !missingFile) {
    throw new Error(`Check cleanup of temporary take ${id}; no existing tracks were selected for deletion.`);
  }
}
console.log(JSON.stringify({ passed: complete, signedTusUpload: true, requests, savedRow: true, playbackBytes: blob.size, retryReusedRow: true, cleanupVerified: true, authScope: "backend admin fixture; browser owner session still needs testing" }));
