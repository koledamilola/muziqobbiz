import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const nodeRequire = createRequire(import.meta.url);
function loadTs(file, overrides = {}) {
  const path = resolve(file);
  const source = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  const require = (name) => {
    if (name in overrides) return overrides[name];
    if (!name.startsWith("@/") && !name.startsWith(".")) return nodeRequire(name);
    const target = name.startsWith("@/") ? resolve("src", name.slice(2)) : resolve(dirname(path), name);
    return loadTs(`${target}.ts`, overrides);
  };
  new Function("require", "exports", source)(require, exports);
  return exports;
}

const { libraryPage, listTracks, LIBRARY_PAGE_SIZE } = loadTs("src/lib/tracks/list-tracks.ts");
const ownerId = "owner";
const row = { id: "take-1", title: "My saved vocal", created_at: "2026-10-22T18:00:00Z", bpm: 97, musical_key: "E minor", energy: "low", vocal_path: "owner/take-1/vocal.wav", tier: "draft", release_ready: false, ai_assisted: true };

function clientFixture(rows = [], error = null) {
  const calls = [];
  const query = {
    select: (fields) => { calls.push(["select", fields]); return query; },
    eq: (...args) => { calls.push(["eq", ...args]); return query; },
    order: (...args) => { calls.push(["order", ...args]); return query; },
    range: async (...args) => { calls.push(["range", ...args]); return { data: rows, error }; },
  };
  const client = {
    from: (table) => { assert.equal(table, "tracks"); return query; },
    storage: { from: (bucket) => {
      assert.equal(bucket, "vocals");
      return { createSignedUrl: async (path, expiry) => {
        calls.push(["sign", path, expiry]);
        if (path.includes("missing")) return { data: null, error: { message: "Not found" } };
        if (path.includes("offline")) throw new Error("Network interrupted");
        return { data: { signedUrl: "https://playback.test/vocal.wav" }, error: null };
      } };
    } },
  };
  return { client, calls };
}

test("Library reads only the owner, orders ties consistently and paginates before signing", async () => {
  const { client, calls } = clientFixture(Array.from({ length: LIBRARY_PAGE_SIZE + 1 }, (_, i) => ({ ...row, id: `take-${i}` })));
  const result = await listTracks(client, ownerId, 2);
  assert.equal(result.tracks.length, 20);
  assert.equal(result.hasMore, true);
  assert.ok(calls.some((call) => call[0] === "eq" && call[1] === "user_id" && call[2] === ownerId));
  assert.deepEqual(calls.filter(([kind]) => kind === "order"), [["order", "created_at", { ascending: false }], ["order", "id", { ascending: false }]]);
  assert.deepEqual(calls.find(([kind]) => kind === "range"), ["range", 20, 40]);
  assert.equal(calls.filter(([kind]) => kind === "sign").length, 20);
  assert.ok(calls.filter(([kind]) => kind === "sign").every((call) => call[2] === 3600));
  assert.equal(result.tracks[0].playbackUrl, "https://playback.test/vocal.wav");
  assert.equal("vocal_path" in result.tracks[0], false);
});

test("Missing audio and signing failures leave saved rows visible without signing other owners' files", async () => {
  const { client, calls } = clientFixture([
    row,
    { ...row, id: "missing", vocal_path: "owner/missing/vocal.wav" },
    { ...row, id: "offline", vocal_path: "owner/offline/vocal.wav" },
    { ...row, id: "foreign", vocal_path: "other-owner/private.wav" },
    { ...row, id: "none", vocal_path: null },
  ]);
  const result = await listTracks(client, ownerId, 1);
  assert.equal(result.tracks.length, 5);
  assert.equal(result.hasMore, false);
  assert.ok(result.tracks[0].playbackUrl);
  assert.ok(result.tracks.slice(1).every((track) => track.playbackUrl === null));
  assert.equal(calls.filter(([kind]) => kind === "sign").length, 3);
  assert.equal(result.tracks[4].hasVocal, false);
});

test("Database failures are errors, rather than a misleading empty Library", async () => {
  const { client, calls } = clientFixture([], { message: "internal credential details" });
  await assert.rejects(listTracks(client, ownerId, 1), { message: "Could not load your saved recordings. Refresh to try again." });
  assert.equal(calls.some(([kind]) => kind === "sign"), false);
});

test("Library page input rejects invalid, repeated and excessive offsets", () => {
  for (const value of [undefined, ["2", "3"], "", "0", "-1", "1.5", "Infinity", "9999999", "abc"]) assert.equal(libraryPage(value), 1);
  assert.equal(libraryPage("2"), 2);
});

class OwnerAuthError extends Error {}
async function renderLibrary({ rows = [], error = null, unauthorized = false } = {}) {
  const { client, calls } = clientFixture(rows, error);
  const Page = loadTs("src/app/library/page.tsx", {
    "@/lib/supabase/owner": { OwnerAuthError, requireOwner: async () => { if (unauthorized) throw new OwnerAuthError(); return { id: ownerId }; } },
    "@/lib/supabase/server": { createClient: async () => client },
    "next/navigation": { redirect: (url) => { throw new Error(`redirect:${url}`); } },
  }).default;
  const root = Page({ searchParams: Promise.resolve({}) });
  const suspense = root.props.children.find((child) => typeof child.type === "symbol");
  const content = suspense.props.children;
  const html = renderToStaticMarkup(await content.type(content.props));
  return { html, calls };
}

test("Library renders saved title, settings, badges and playable private vocal", async () => {
  const { html } = await renderLibrary({ rows: [row] });
  for (const value of ["My saved vocal", "97 BPM", "E minor", "low", "Draft", "AI-assisted", "<audio", 'preload="none"', "https://playback.test/vocal.wav"]) assert.ok(html.includes(value), value);
});

test("Library distinguishes empty and failed reads, and rejects unauthorized access before querying", async () => {
  assert.ok((await renderLibrary()).html.includes("No saved recordings yet"));
  const failed = await renderLibrary({ error: { message: "private failure" } });
  assert.ok(failed.html.includes('role="alert"'));
  assert.ok(!failed.html.includes("No saved recordings yet"));
  assert.ok(!failed.html.includes("private failure"));
  await assert.rejects(renderLibrary({ unauthorized: true }), /redirect:\/login\?next=%2Flibrary/);
});
