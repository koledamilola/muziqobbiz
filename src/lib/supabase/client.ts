import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseEnv } from "./env";
import type { Database } from "@/lib/types";

// Docs: https://supabase.com/docs/guides/auth/server-side/creating-a-client
export function createClient() {
  const { url, key } = getPublicSupabaseEnv();

  return createBrowserClient<Database>(url, key);
}
