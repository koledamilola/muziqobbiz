"use server";

import { randomUUID } from "node:crypto";
import { OwnerAuthError, requireOwner } from "@/lib/supabase/owner";
import { createClient } from "@/lib/supabase/server";

export type DatabaseCheckState = {
  status: "idle" | "success" | "error";
  message: string;
};

// Temporary Stage 1.4 check. The session client exercises RLS; admin bypasses it.
// Docs: https://supabase.com/docs/guides/database/postgres/row-level-security
export async function checkDatabase(): Promise<DatabaseCheckState> {
  let user;
  try {
    user = await requireOwner();
  } catch (error) {
    return {
      status: "error",
      message: error instanceof OwnerAuthError
        ? "Please sign in again before running the check."
        : "The connection could not be checked. Please try again.",
    };
  }

  const supabase = await createClient();
  const trackId = randomUUID();
  const jobId = randomUUID();
  let trackAttempted = false;
  let jobAttempted = false;
  let step = "create a test track";
  let result: DatabaseCheckState;
  const cleanupFailures: string[] = [];

  try {
    trackAttempted = true;
    const inserted = await supabase.from("tracks").insert({
      id: trackId, user_id: user.id, title: "Stage 1.4 connection test",
    });
    if (inserted.error) throw new Error("Track insert failed");

    step = "read the test track";
    const track = await supabase.from("tracks").select("id, user_id, title")
      .eq("id", trackId).eq("user_id", user.id).single();
    if (track.error || track.data?.title !== "Stage 1.4 connection test") {
      throw new Error("Track read failed");
    }

    step = "update the test track";
    const updated = await supabase.from("tracks").update({ title: "Stage 1.4 update test" })
      .eq("id", trackId).eq("user_id", user.id).select("title").single();
    if (updated.error || updated.data?.title !== "Stage 1.4 update test") {
      throw new Error("Track update failed");
    }

    step = "create a test job";
    jobAttempted = true;
    const insertedJob = await supabase.from("generation_jobs").insert({
      id: jobId, user_id: user.id, track_id: trackId, provider: "connection_test",
      prompt_text: "Database connection test only; no music is generated.", duration_sec: 1,
    });
    if (insertedJob.error) throw new Error("Job insert failed");

    step = "read the test job";
    const job = await supabase.from("generation_jobs").select("id, track_id, status")
      .eq("id", jobId).eq("user_id", user.id).single();
    if (job.error || job.data?.track_id !== trackId || job.data.status !== "queued") {
      throw new Error("Job read failed");
    }

    result = { status: "success", message: "Database check passed. Your test track and job were saved, read back, and removed." };
  } catch {
    result = {
      status: "error",
      message: `Could not ${step}. Check that the Stage 1.4 migration was applied, then try again.`,
    };
  } finally {
    // Only remove the UUIDs allocated by this invocation, never existing music.
    for (const [table, id, attempted] of [
      ["generation_jobs", jobId, jobAttempted],
      ["tracks", trackId, trackAttempted],
    ] as const) {
      if (!attempted) continue;
      try {
        const removed = await supabase.from(table).delete().eq("id", id).eq("user_id", user.id);
        const remaining = await supabase.from(table).select("id").eq("id", id).eq("user_id", user.id);
        if (removed.error || remaining.error || remaining.data?.length !== 0) {
          cleanupFailures.push(`${table}: ${id}`);
        }
      } catch {
        cleanupFailures.push(`${table}: ${id}`);
      }
    }
  }

  if (cleanupFailures.length) {
    return { status: "error", message: `The check did not finish cleanly. Cleanup could not be confirmed. Check these test IDs in Supabase: ${cleanupFailures.join("; ")}.` };
  }
  return result;
}
