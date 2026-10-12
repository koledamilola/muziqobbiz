import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseEnv } from "./env";

// Docs: https://supabase.com/docs/guides/auth/server-side/creating-a-client
export function createClient() {
  const { url, key } = getPublicSupabaseEnv();

  return createBrowserClient(url, key);
}
