# Stage 1.5: system health

Open **Status** while signed in. The page checks your account and queries your
generation jobs on the server. Opening or refreshing the page does not write
records, generate music, or contact music providers.

## What you should see

- **Signed-in account:** your email and **Owner verified**.
- **Supabase database:** **Reachable** when your session can count its jobs.
- **Today's generations:** the real number of jobs created during the current
  UTC day, out of `DAILY_GENERATION_LIMIT`. With no jobs and a limit of 25, this
  reads **0 / 25**. Failed and pending jobs also count. The day resets at midnight
  UTC, independent of your phone or computer's timezone.
- **Configuration:** all ten names from AGENTS.md, each marked **Configured** or
  **Missing**, without showing values. `FAL_KEY`, `FAL_MINIMAX_MODEL_ID`, and
  `MINIMAX_API_KEY` are marked `(optional)` while ElevenLabs is used as the sole
  provider, so they do not count toward the required-settings warning.
  `ELEVENLABS_PLAN_IS_PAID=false` counts as configured; false is an intentional
  setting.
- **App version:** the package version, a short Vercel commit hash when available,
  and when the checks ran. A local build can show **Not available** for the commit.

**Configured** only means a nonempty value exists. It does not certify a valid
provider key, available credit, or a commercial license. Missing provider keys
do not prevent this page from loading. Authentication still needs the Supabase
public settings and `ALLOWED_EMAIL`; removing those can prevent sign-in entirely.

If the database query fails, lacks a count, or times out after five seconds, the
page shows **Check unavailable** and **Unavailable** instead of a misleading
zero. An absent or invalid daily limit is reported separately; no fallback
silently hides it. Zero is valid and means no daily generation allowance.

The previous **Run database check** button is retained under **Advanced: test
saving a track**. That explicit test creates and removes temporary records.

## Settings to finish before generation work

Use your own account's values in ignored `.env.local` and the Vercel project's
Production environment variables. Do not paste keys into chat.

| Name | Value to supply | Vercel type |
|---|---|---|
| `FAL_KEY` | Your FAL API key (optional while using ElevenLabs alone; add later) | Secret if used |
| `FAL_MINIMAX_MODEL_ID` | The exact FAL MiniMax model ID (optional until FAL.AI is added) | Config if used |
| `ELEVENLABS_API_KEY` | Your ElevenLabs API key | Secret |
| `ELEVENLABS_PLAN_IS_PAID` | `false` until a suitable paid plan is confirmed | Config |
| `DAILY_GENERATION_LIMIT` | `25` initially, or another nonnegative whole number | Config |
| `MINIMAX_API_KEY` | Leave blank unless using the optional direct provider | Secret if used |

Local `ELEVENLABS_API_KEY`, `ELEVENLABS_PLAN_IS_PAID`, and `DAILY_GENERATION_LIMIT`
are configured. `FAL_KEY` and `FAL_MINIMAX_MODEL_ID` remain optional until FAL.AI
is added later. Keep any unused provider setting blank until you have its real value.

Restart the local server after editing `.env.local`. Vercel variable changes
require a new deployment before the running app can use them. The Status page
reports the environment of the app you are viewing, so local and production
can legitimately show different results.

## Browser checks

1. Locally, run `npm run build`, then `npm run start`, and open
   `http://localhost:3000/status` while signed in. If a server is already running,
   stop it with Ctrl+C before starting the new build.
2. Confirm the verified email, database connection, usage, and configuration list
   match the expectations above. Do not share secret values; this page does not
   show them.
3. Click **Refresh checks**. The last-checked time should advance and the current
   configuration/usage should load again.
4. After deployment, repeat at `https://muziqobbiz.vercel.app/status`, including on
   your phone. All variable names should wrap without horizontal scrolling.
5. In a private/incognito window, open `/status`. Expect the login page, with no
   email or configuration report visible.

## Developer verification

```powershell
node --test tests/status.test.mjs
npm run lint
npm run typecheck
npm run build
```

The focused tests use synthetic credentials and substituted request dependencies
to cover authorization order, missing settings, secret-free output, limit
validation, UTC boundaries, exact owner-scoped counting, and database failures.
They do not replace signed-in browser checks against hosted Supabase.

The health snapshot is server-only, verifies the owner before reading settings,
uses the session client (not the privileged admin client), and is not cached
across requests. The dynamic section sits behind Suspense for Next.js Cache
Components. No new environment names, database migrations, or app dependencies
were needed. This page reports usage; server-side quota enforcement belongs to
the later generation endpoint.

Docs checked 2026-10-22:
[Supabase count queries](https://supabase.com/docs/reference/javascript/select),
[Next.js caching](https://nextjs.org/docs/app/getting-started/cache-components),
[Vercel commit metadata](https://vercel.com/docs/environment-variables/system-environment-variables).
