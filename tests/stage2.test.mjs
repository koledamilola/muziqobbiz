import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import ts from "typescript";

function loadTs(file, overrides = {}, testProcess = process) {
  const path = resolve(file);
  const source = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const require = (name) => {
    if (name in overrides) return overrides[name];
    const target = name.startsWith("@/") ? resolve("src", name.slice(2)) : resolve(dirname(path), name);
    return loadTs(`${target}.ts`, overrides, testProcess);
  };
  new Function("require", "exports", "process", source)(require, exports, testProcess);
  return exports;
}

const analysis = loadTs("src/lib/audio/analysis.ts");
const { parseTakeInput, vocalPath, signedTusEndpoint, MAX_TAKE_BYTES } = loadTs("src/lib/tracks/take-input.ts");
const { saveTake } = loadTs("src/lib/tracks/save-take.ts");
const id = "c513c080-68cc-4887-9755-22d14ec31d36";
const take = { id, size: 1000, durationSec: 3, mimeType: "audio/wav", settings: { bpm: 90, musicalKey: "C major", energy: "medium", sources: { bpm: "metronome", key: "user", energy: "detected" } } };

test("analysis has 24 keys, normalizes enharmonics, and preserves known tempo over detected tempo", () => {
  assert.equal(new Set(analysis.MUSICAL_KEYS).size, 24);
  assert.equal(analysis.normalizeKey("D# minor"), "Eb minor");
  assert.equal(analysis.normalizeKey("Db major"), "C# major");
  assert.equal(analysis.normalizeKey("H major"), null);
  const settings = analysis.settingsFromAnalysis({ bpm: 180, key: "G# minor", rms: 0.1 }, 90);
  assert.equal(settings.bpm, 90);
  assert.equal(settings.sources.bpm, "metronome");
  assert.equal(settings.musicalKey, "Ab minor");
  assert.equal(analysis.energyFromRms(0), "low");
  assert.equal(analysis.energyFromRms(0.1), "medium");
  assert.equal(analysis.energyFromRms(0.3), "high");
});

test("take validation rejects path injection, malformed settings, oversized files and invalid durations", () => {
  assert.deepEqual(parseTakeInput(take), take);
  for (const changes of [{ id: "../other-owner" }, { size: MAX_TAKE_BYTES + 1 }, { size: -1 }, { mimeType: "audio/mp4" }, { durationSec: 183 }, { durationSec: NaN }, { settings: null }, { settings: { ...take.settings, bpm: 0 } }, { settings: { ...take.settings, musicalKey: "H major" } }, { settings: { ...take.settings, sources: {} } }]) {
    assert.equal(parseTakeInput({ ...take, ...changes }), null);
  }
  assert.equal(vocalPath("owner", id), `owner/${id}/vocal.wav`);
  assert.equal(signedTusEndpoint("https://project.supabase.co"), "https://project.storage.supabase.co/storage/v1/upload/resumable/sign");
  assert.equal(signedTusEndpoint("http://127.0.0.1:54321"), "http://127.0.0.1:54321/storage/v1/upload/resumable/sign");
});

function storageMock({ existing = null, file = null, insertError = null, playbackError = false, race = null } = {}) {
  const calls = [];
  const bucket = {
    info: async (path) => { calls.push(["info", path]); return file ? { data: file } : { error: { statusCode: "404" } }; },
    createSignedUploadUrl: async (path) => { calls.push(["sign", path]); return { data: { token: "scoped-token" } }; },
    createSignedUrl: async () => playbackError ? { error: {} } : { data: { signedUrl: "https://playback.test/vocal" } },
  };
  const client = {
    storage: { from: (bucketName) => { assert.equal(bucketName, "vocals"); return bucket; } },
    from: (table) => {
      assert.equal(table, "tracks");
      const query = {
        select: () => query,
        eq: (key, value) => { calls.push(["filter", key, value]); return query; },
        maybeSingle: async () => ({ data: existing }),
        single: async () => ({ data: race }),
        insert: async (row) => { calls.push(["insert", row]); return { error: insertError }; },
      };
      return query;
    },
  };
  return { client, calls };
}

test("prepare scopes the signed upload to the verified owner without creating a track", async () => {
  const { client, calls } = storageMock();
  const result = await saveTake(client, "owner", take, "prepare");
  assert.equal(result.path, `owner/${id}/vocal.wav`);
  assert.equal(result.token, "scoped-token");
  assert.equal(calls.some(([kind]) => kind === "insert"), false);
  assert.ok(calls.some((call) => call[0] === "filter" && call[1] === "user_id" && call[2] === "owner"));
});

test("finalize requires the complete matching upload and never marks a draft release-ready", async () => {
  const { client, calls } = storageMock({ file: { size: take.size, contentType: take.mimeType } });
  const result = await saveTake(client, "owner", take, "finalize");
  assert.equal(result.saved, true);
  const row = calls.find(([kind]) => kind === "insert")[1];
  assert.equal(row.user_id, "owner");
  assert.equal(row.vocal_path, `owner/${id}/vocal.wav`);
  assert.equal(row.tier, "draft");
  assert.equal(row.release_ready, false);
  assert.equal(row.ai_assisted, true);
  assert.equal(row.vocal_fx.capture.mimeType, "audio/wav");
  for (const file of [null, { size: 10, contentType: take.mimeType }, { size: take.size, contentType: "text/plain" }]) {
    const invalid = storageMock({ file });
    await assert.rejects(saveTake(invalid.client, "owner", take, "finalize"));
    assert.equal(invalid.calls.some(([kind]) => kind === "insert"), false);
  }
});

test("retries reuse uploaded audio and saved rows, including a lost insert response", async () => {
  const path = `owner/${id}/vocal.wav`;
  const uploaded = storageMock({ file: { size: take.size, contentType: take.mimeType } });
  assert.equal((await saveTake(uploaded.client, "owner", take, "prepare")).uploaded, true);
  assert.equal(uploaded.calls.some(([kind]) => kind === "sign"), false);
  const existing = storageMock({ existing: { id, title: "Already saved", vocal_path: path }, playbackError: true });
  const result = await saveTake(existing.client, "owner", take, "finalize");
  assert.equal(result.saved, true);
  assert.equal(result.playbackUrl, null);
  assert.equal(existing.calls.some(([kind]) => kind === "insert"), false);
  const race = storageMock({ file: { size: take.size, contentType: take.mimeType }, insertError: { code: "23505" }, race: { title: "Race saved", vocal_path: path } });
  assert.equal((await saveTake(race.client, "owner", take, "finalize")).title, "Race saved");
});

test("save API checks owner before parsing input or accessing storage and hides upstream errors", async () => {
  class OwnerAuthError extends Error {}
  let authorized = false;
  let accessed = false;
  const { POST } = loadTs("src/app/api/takes/route.ts", {
    "next/server": { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    "@/lib/supabase/owner": { OwnerAuthError, requireOwner: async () => { if (!authorized) throw new OwnerAuthError(); return { id: "owner" }; } },
    "@/lib/supabase/server": { createClient: async () => { accessed = true; return {}; } },
    "@/lib/tracks/save-take": { saveTake: async () => { throw new Error("UPSTREAM_SECRET_TOKEN"); } },
  });
  assert.equal((await POST(new Request("https://app.test/api/takes", { method: "POST", body: "bad input" }))).status, 401);
  assert.equal(accessed, false);
  authorized = true;
  const req = (origin, body) => new Request("https://app.test/api/takes", { method: "POST", headers: { "Content-Type": "application/json", origin }, body: JSON.stringify(body) });
  assert.equal((await POST(req("https://evil.test", { take, action: "prepare" }))).status, 403);
  assert.equal((await POST(req("https://app.test", { take: {}, action: "prepare" }))).status, 400);
  const result = await POST(req("https://app.test", { take, action: "prepare" }));
  assert.equal(result.status, 503);
  assert.equal(JSON.stringify(result).includes("UPSTREAM_SECRET_TOKEN"), false);
});

test("session proxy returns JSON 401 for expired/wrong-owner API sessions and leaves static analysis assets public", async () => {
  let claims = null;
  let signedOut = false;
  const response = (body, options = {}) => ({ body, status: options.status ?? 200, cookies: { getAll: () => [], set() {} } });
  const next = { next: () => response(null), json: response, redirect: () => { throw new Error("API must not redirect to HTML"); } };
  const { updateSession } = loadTs("src/lib/supabase/proxy.ts", {
    "next/server": { NextResponse: next },
    "./env": { getPublicSupabaseEnv: () => ({ url: "https://project.supabase.co", key: "public-key" }) },
    "@supabase/ssr": { createServerClient: () => ({ auth: { getClaims: async () => ({ data: { claims } }), signOut: async () => { signedOut = true; } } }) },
  }, { env: { ALLOWED_EMAIL: "owner@example.test" } });
  const request = { nextUrl: { pathname: "/api/takes" }, cookies: { getAll: () => [] } };
  assert.equal((await updateSession(request)).status, 401);
  claims = { email: "other@example.test" };
  assert.equal((await updateSession(request)).status, 401);
  assert.equal(signedOut, true);
  claims = { email: "owner@example.test" };
  assert.equal((await updateSession(request)).status, 200);
  const { config } = loadTs("src/proxy.ts", { "@/lib/supabase/proxy": { updateSession() {} } });
  const matcher = new RegExp(`^${config.matcher[0]}$`);
  assert.equal(matcher.test("/api/takes"), true);
  assert.equal(matcher.test("/library"), true);
  assert.equal(matcher.test("/workers/analyze.js"), false);
  assert.equal(matcher.test("/vendor/essentia-0.1.3/essentia-wasm.es.js"), false);
});
