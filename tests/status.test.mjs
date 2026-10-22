import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);

// Exercise the server modules without loading Next's request/cookie runtime.
// Only server-only's build-time marker and request dependencies are substituted.
function loadServerModule(file, imports = {}, env = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports, process: { env }, Date, AbortSignal,
    require(name) {
      if (name === "server-only") return {};
      if (Object.hasOwn(imports, name)) return imports[name];
      throw new Error(`Unexpected dependency: ${name}`);
    },
  }, { filename: file });
  return exports;
}

const config = loadServerModule("../src/lib/status/config.ts");
const fixtureEnv = {
  FAL_KEY: "private-sentinel-value", ELEVENLABS_PLAN_IS_PAID: "false",
  DAILY_GENERATION_LIMIT: "25", MINIMAX_API_KEY: "   ", UNLISTED_SECRET: "unlisted-sentinel",
};

function healthFixture({ result = { count: 0, error: null }, rejectAuth = false, throwQuery = false, env = fixtureEnv } = {}) {
  const calls = [];
  const builder = Object.fromEntries(["select", "eq", "gte", "lt"].map((name) => [name, (...args) => {
    calls.push([name, ...args]);
    return builder;
  }]));
  builder.abortSignal = async (signal) => {
    assert.ok(signal instanceof AbortSignal);
    if (throwQuery) throw new Error("sensitive upstream details");
    return result;
  };
  const health = loadServerModule("../src/lib/status/health.ts", {
    "../../../package.json": { version: "0.1.0" },
    "./config": config,
    "@/lib/supabase/owner": { requireOwner: async () => {
      calls.push(["auth"]);
      if (rejectAuth) throw new Error("Unauthorized");
      return { id: "verified-owner-id", email: "owner@example.test" };
    } },
    "@/lib/supabase/server": { createClient: async () => ({ from: (table) => {
      calls.push(["from", table]);
      return builder;
    } }) },
  }, env);
  return { ...health, calls };
}

test("configuration reports presence without leaking values; false is configured and optional is explicit", () => {
  const rows = config.configurationStatus(fixtureEnv);
  assert.equal(rows.length, 10);
  assert.equal(rows.find((r) => r.name === "ELEVENLABS_PLAN_IS_PAID").configured, true);
  assert.equal(rows.find((r) => r.name === "FAL_MINIMAX_MODEL_ID").configured, false);
  assert.equal(rows.find((r) => r.name === "FAL_KEY").optional, true);
  assert.equal(rows.find((r) => r.name === "FAL_MINIMAX_MODEL_ID").optional, true);
  assert.equal(rows.find((r) => r.name === "MINIMAX_API_KEY").configured, false);
  assert.equal(rows.find((r) => r.name === "MINIMAX_API_KEY").optional, true);
  assert.equal(rows.find((r) => r.name === "ELEVENLABS_API_KEY").optional, false);
  assert.doesNotMatch(JSON.stringify(rows), /sentinel|UNLISTED_SECRET/);
  assert.ok(config.configurationStatus({}).every((r) => !r.configured));
});

test("limits accept zero but never silently default missing or invalid input", () => {
  assert.equal(config.dailyLimit("0"), 0);
  assert.equal(config.dailyLimit(" 25 "), 25);
  for (const value of [undefined, "", " ", "-1", "1.5", "Infinity", "1e3", "25junk", "9007199254740992"]) {
    assert.equal(config.dailyLimit(value), null);
  }
});

test("UTC day boundaries ignore local timezone and handle leap/month rollover", () => {
  const day = config.utcDayBounds(new Date("2024-02-29T23:30:00-06:00"));
  assert.equal(day.start, "2024-03-01T00:00:00.000Z");
  assert.equal(day.end, "2024-03-02T00:00:00.000Z");
});

test("only a valid commit hash is rendered", () => {
  assert.equal(config.commitLabel("a".repeat(40)), "aaaaaaa");
  assert.equal(config.commitLabel("private-sentinel-value"), null);
  assert.equal(config.commitLabel(undefined), null);
});

test("authentication precedes environment reads and database access", async () => {
  const env = new Proxy({}, { get() { throw new Error("Environment read before auth"); } });
  const fixture = healthFixture({ rejectAuth: true, env });
  await assert.rejects(fixture.readSystemStatus(), /Unauthorized/);
  assert.deepEqual(fixture.calls, [["auth"]]);
});

test("owner-scoped read uses exact count and an exclusive UTC upper bound, with no writes", async () => {
  const fixture = healthFixture({ result: { count: 3, error: null } });
  const snapshot = await fixture.readSystemStatus();
  assert.equal(snapshot.generationCount, 3);
  assert.equal(snapshot.limit, 25);
  assert.equal(snapshot.email, "owner@example.test");
  assert.deepEqual(fixture.calls.map((call) => call[0]), ["auth", "from", "select", "eq", "gte", "lt"]);
  assert.equal(fixture.calls[1][1], "generation_jobs");
  assert.equal(fixture.calls[2][2].count, "exact");
  assert.equal(fixture.calls[2][2].head, true);
  assert.deepEqual(fixture.calls[3], ["eq", "user_id", "verified-owner-id"]);
  assert.deepEqual(fixture.calls[4], ["gte", "created_at", snapshot.day.start]);
  assert.deepEqual(fixture.calls[5], ["lt", "created_at", snapshot.day.end]);
  assert.doesNotMatch(JSON.stringify(snapshot), /sentinel/);
  assert.equal((await healthFixture().readSystemStatus()).generationCount, 0);
});

test("errors, timeouts and absent count remain unavailable, never reported as zero", async () => {
  for (const options of [
    { result: { count: 0, error: { message: "sensitive upstream details" } } },
    { result: { count: null, error: null } },
    { throwQuery: true },
  ]) {
    const snapshot = await healthFixture(options).readSystemStatus();
    assert.equal(snapshot.generationCount, null);
    assert.doesNotMatch(JSON.stringify(snapshot), /sensitive upstream/);
  }
});

test("server-rendered page shows missing settings and unavailable usage without exposing values", async () => {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const fixture = healthFixture({ throwQuery: true });
  const page = loadServerModule("../src/app/status/page.tsx", {
    react: React,
    "react/jsx-runtime": require("react/jsx-runtime"),
    "next/navigation": { redirect: () => { throw new Error("Redirect"); } },
    "@/lib/supabase/owner": { OwnerAuthError: class extends Error {} },
    "@/lib/status/health": fixture,
    "./DatabaseCheck": { default: () => null },
  });
  const suspense = React.Children.toArray(page.default().props.children).find((child) => child.type === React.Suspense);
  const component = suspense.props.children;
  const html = renderToStaticMarkup(await component.type(component.props));
  assert.match(html, /owner@example.test/);
  assert.match(html, /Check unavailable/);
  assert.match(html, /Unavailable/);
  assert.match(html, /Missing/);
  assert.match(html, /Configured/);
  assert.match(html, /\(optional\)/);
  assert.doesNotMatch(html, /sentinel|sensitive upstream/);
});
