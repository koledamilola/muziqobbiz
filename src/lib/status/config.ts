import "server-only";

// This allow-list must match AGENTS.md section 5. Never return env values.
const configurationNames = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ALLOWED_EMAIL",
  "FAL_KEY",
  "FAL_MINIMAX_MODEL_ID",
  "ELEVENLABS_API_KEY",
  "MINIMAX_API_KEY",
  "ELEVENLABS_PLAN_IS_PAID",
  "DAILY_GENERATION_LIMIT",
] as const;

const optionalConfigurationNames = new Set([
  "FAL_KEY",
  "FAL_MINIMAX_MODEL_ID",
  "MINIMAX_API_KEY",
]);

type Environment = Record<string, string | undefined>;

export function configurationStatus(env: Environment) {
  return configurationNames.map((name) => ({
    name,
    configured: Boolean(env[name]?.trim()),
    optional: optionalConfigurationNames.has(name),
  }));
}

export function dailyLimit(value: string | undefined): number | null {
  const trimmed = value?.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) return null;
  const limit = Number(trimmed);
  return Number.isSafeInteger(limit) ? limit : null;
}

export function utcDayBounds(now: Date) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function commitLabel(value: string | undefined): string | null {
  // Vercel's Git metadata is available at runtime. Show only a valid short SHA.
  // https://vercel.com/docs/environment-variables/system-environment-variables
  return value && /^[a-f0-9]{40}$/i.test(value) ? value.slice(0, 7) : null;
}
