import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOwner, OwnerAuthError } from "@/lib/supabase/owner";
import { createClient } from "@/lib/supabase/server";
import { libraryPage, listTracks } from "@/lib/tracks/list-tracks";

export const metadata = { title: "Library · muziqobbiz" };

type SearchParams = Promise<{ page?: string | string[] }>;
const linkClass = "inline-flex min-h-11 items-center justify-center rounded-lg border border-violet-300/25 px-4 py-2 text-sm text-violet-200 hover:bg-violet-400/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

async function SavedTracks({ searchParams }: { searchParams: SearchParams }) {
  let library;
  let page;
  try {
    const owner = await requireOwner();
    page = libraryPage((await searchParams).page);
    library = await listTracks(await createClient(), owner.id, page);
  } catch (error) {
    if (error instanceof OwnerAuthError) redirect("/login?next=%2Flibrary");
    return <p role="alert" className="studio-card mt-6 rounded-xl p-5 text-amber-200">Could not load your saved recordings. Refresh to try again. If the problem continues, sign in again.</p>;
  }

  return (
    <div className="mt-6 space-y-5">
      {library.tracks.length === 0 ? (
        <div className="studio-card rounded-xl p-6">
          <h2 className="text-lg font-semibold">{page === 1 ? "No saved recordings yet" : "No more recordings on this page"}</h2>
          <p className="mt-2 text-sm text-zinc-400">{page === 1 ? "Record a vocal in the studio, then choose Keep & save take. It will appear here once saving finishes." : "Return to your newest recordings below."}</p>
          <Link href="/muziqobbiz" className={`${linkClass} mt-4`}>Open studio</Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2" aria-label="Saved recordings">
          {library.tracks.map((track) => (
            <li key={track.id} className="studio-card min-w-0 rounded-xl p-5">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-violet-400/15 px-2.5 py-1 text-violet-200">{track.tier === "release" && track.release_ready ? "Release-ready" : "Draft"}</span>
                {track.ai_assisted ? <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-cyan-200">AI-assisted</span> : null}
              </div>
              <h2 className="mt-3 break-words font-semibold text-white">{track.title}</h2>
              <p className="mt-1 text-xs text-zinc-400"><time dateTime={track.created_at}>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(track.created_at))} UTC</time></p>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div><dt className="text-xs text-zinc-400">Tempo</dt><dd className="mt-1 text-zinc-200">{track.bpm ? `${track.bpm} BPM` : "Unknown"}</dd></div>
                <div><dt className="text-xs text-zinc-400">Key</dt><dd className="mt-1 text-zinc-200">{track.musical_key ?? "Unknown"}</dd></div>
                <div><dt className="text-xs text-zinc-400">Energy</dt><dd className="mt-1 capitalize text-zinc-200">{track.energy ?? "Unknown"}</dd></div>
              </dl>
              {track.playbackUrl ? (
                <div className="mt-4"><p className="mb-2 text-xs text-emerald-200">Saved vocal</p><audio aria-label={`Play saved vocal: ${track.title}`} controls preload="none" src={track.playbackUrl} className="w-full" /></div>
              ) : <p className="mt-4 text-sm text-amber-200">{track.hasVocal ? "Vocal playback is unavailable. Refresh to try again." : "No vocal file is attached to this track."}</p>}
            </li>
          ))}
        </ul>
      )}
      <nav aria-label="Library pages" className="flex flex-wrap items-center gap-3">
        {page > 1 ? <a href={`/library?page=${page - 1}`} className={linkClass}>Newer recordings</a> : null}
        {library.hasMore ? <a href={`/library?page=${page + 1}`} className={linkClass}>Older recordings</a> : null}
        {page > 1 ? <a href="/library" className={linkClass}>Newest recordings</a> : null}
      </nav>
      {library.tracks.some((track) => track.playbackUrl) ? <p className="text-xs text-zinc-400">Playback links last one hour. Refresh this page for fresh links.</p> : null}
    </div>
  );
}

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return (
    <section className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="studio-title text-3xl font-bold">Library</h1>
        <a href="/library" className={linkClass}>Refresh recordings</a>
      </div>
      <p className="mt-2 text-zinc-400">Your privately saved recordings, newest first.</p>
      <Suspense fallback={<p role="status" className="mt-6 text-cyan-200">Loading your recordings…</p>}>
        <SavedTracks searchParams={searchParams} />
      </Suspense>
    </section>
  );
}
