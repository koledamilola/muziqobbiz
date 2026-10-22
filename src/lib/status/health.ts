import "server-only";

import { version } from "../../../package.json";
import { requireOwner } from "@/lib/supabase/owner";
import { createClient } from "@/lib/supabase/server";
import { commitLabel, configurationStatus, dailyLimit, utcDayBounds } from "./config";

export async function readSystemStatus() {
  // Verify the actual user before reading settings or making database queries.
  // Do not cache this snapshot across users or requests.
  const user = await requireOwner();
  const checkedAt = new Date();
  const day = utcDayBounds(checkedAt);
  let generationCount: number | null = null;

  try {
    const supabase = await createClient();
    // A count-only read proves database access using the owner's session/RLS.
    // Count every job status; failed attempts also count toward the daily limit.
    // https://supabase.com/docs/reference/javascript/select
    const { count, error } = await supabase.from("generation_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", day.start)
      .lt("created_at", day.end)
      .abortSignal(AbortSignal.timeout(5000));

    if (!error && count !== null && Number.isSafeInteger(count) && count >= 0) {
      generationCount = count;
    }
  } catch {
    // Do not leak service errors or pretend that a failed query returned zero.
  }

  const configuration = configurationStatus(process.env);
  return {
    email: user.email!,
    checkedAt: checkedAt.toISOString(),
    day,
    configuration,
    generationCount,
    limit: dailyLimit(process.env.DAILY_GENERATION_LIMIT),
    limitConfigured: configuration.find((item) => item.name === "DAILY_GENERATION_LIMIT")!.configured,
    version,
    commit: commitLabel(process.env.VERCEL_GIT_COMMIT_SHA),
  };
}
