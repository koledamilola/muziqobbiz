import { Suspense } from "react";
import { redirect } from "next/navigation";
import { OwnerAuthError } from "@/lib/supabase/owner";
import { readSystemStatus } from "@/lib/status/health";
import DatabaseCheck from "./DatabaseCheck";

export const metadata = { title: "Status · muziqobbiz" };

async function SystemHealth() {
  let status;
  try {
    status = await readSystemStatus();
  } catch (error) {
    if (error instanceof OwnerAuthError) redirect("/login?next=%2Fstatus");
    // Configuration/auth-service failures must not expose a partial private report.
    return <p role="alert" className="mt-6 text-red-300">Unable to verify your account. Please reload or sign in again.</p>;
  }

  const reachable = status.generationCount !== null;
  const missing = status.configuration.filter((item) => !item.optional && !item.configured).length;
  const limitLabel = status.limit !== null ? String(status.limit) : status.limitConfigured ? "Invalid limit" : "Limit not set";
  const limitReached = status.generationCount !== null && status.limit !== null && status.generationCount >= status.limit;

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-zinc-800 p-5" aria-labelledby="account-heading">
          <h2 id="account-heading" className="font-medium">Signed-in account</h2>
          <p className="mt-2 break-all text-sm text-zinc-300">{status.email}</p>
          <p className="mt-2 text-sm text-emerald-300">Owner verified</p>
        </section>
        <section className="rounded-lg border border-zinc-800 p-5" aria-labelledby="database-heading">
          <h2 id="database-heading" className="font-medium">Supabase database</h2>
          <p className={`mt-2 text-sm ${reachable ? "text-emerald-300" : "text-amber-300"}`}>
            {reachable ? "Reachable" : "Check unavailable"}
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            {reachable ? "Your account can read its generation jobs." : "Could not read your generation jobs. Refresh to try again."}
          </p>
        </section>
      </div>

      <section className="rounded-lg border border-zinc-800 p-5" aria-labelledby="usage-heading">
        <h2 id="usage-heading" className="font-medium">Today’s generations</h2>
        <p className="mt-2 text-2xl font-semibold tabular-nums">
          {status.generationCount ?? "Unavailable"} <span className="text-base font-normal text-zinc-400">/ {limitLabel}</span>
        </p>
        <p className="mt-2 text-sm text-zinc-400">All generation attempts, including failed jobs. Resets at midnight UTC.</p>
        {status.limit === null ? (
          <p className="mt-2 text-sm text-amber-300">Set DAILY_GENERATION_LIMIT to a whole number of zero or more.</p>
        ) : limitReached ? (
          <p className="mt-2 text-sm text-amber-300">Daily limit reached.</p>
        ) : null}
      </section>

      <section className="rounded-lg border border-zinc-800 p-5" aria-labelledby="config-heading">
        <h2 id="config-heading" className="font-medium">Configuration</h2>
        <p className="mt-2 text-sm text-zinc-400">
          {missing ? `${missing} required setting${missing === 1 ? " is" : "s are"} missing.` : "All required settings are present."}
          {" "}Configured means a value is present; provider credentials are not tested here. Values stay hidden.
        </p>
        <dl className="mt-4 divide-y divide-zinc-800">
          {status.configuration.map((item) => (
            <div key={item.name} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <dt className="min-w-0 break-all font-mono text-xs leading-5 text-zinc-300">
                {item.name}{item.optional ? <span className="ml-2 font-sans text-zinc-500">(optional)</span> : null}
              </dt>
              <dd className={`shrink-0 text-sm ${item.configured ? "text-emerald-300" : item.optional ? "text-zinc-400" : "text-amber-300"}`}>
                {item.configured ? "Configured" : "Missing"}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-lg border border-zinc-800 p-5" aria-labelledby="version-heading">
        <h2 id="version-heading" className="font-medium">App version</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-zinc-400">Version</dt><dd>{status.version}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-zinc-400">Commit</dt><dd className="font-mono">{status.commit ?? "Not available"}</dd></div>
          <div className="flex flex-wrap justify-between gap-2"><dt className="text-zinc-400">Last checked (UTC)</dt><dd><time dateTime={status.checkedAt}>{status.checkedAt.slice(0, 19).replace("T", " ")}</time></dd></div>
        </dl>
      </section>

      <details className="rounded-lg border border-zinc-800 p-5">
        <summary className="cursor-pointer text-sm font-medium">Advanced: test saving a track</summary>
        <DatabaseCheck />
      </details>
    </div>
  );
}

export default function Page() {
  return (
    <section className="max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Status</h1>
        <a href="/status" className="rounded-md border border-zinc-700 px-4 py-2.5 text-sm hover:bg-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Refresh checks</a>
      </div>
      <p className="mt-2 text-zinc-400">Your account, connection, and generation settings.</p>
      {/* Cookies and database reads stay request-scoped behind Suspense. */}
      {/* https://nextjs.org/docs/app/getting-started/cache-components */}
      <Suspense fallback={<p role="status" className="mt-6 text-zinc-400">Checking system health…</p>}>
        <SystemHealth />
      </Suspense>
    </section>
  );
}
