# PROGRESS.md — Shared logbook

Every agent reads this at the start of a session and updates it at the end. The owner can edit it any time. Keep the newest session at the top of the log.

---

## Current status

- **Current stage / step:** Stage 1.3 deployed — owner confirms production login and sign-out; new-user signup disabled. Phone login and sign-out also confirmed. Follow-up fixes prepared for publication; localhost authentication remains unverified.
- **App URL (production):** https://muziqobbiz.vercel.app
- **Last working checkpoint (git tag or commit):** `0bd5049` (`stage 1.3: login`), pushed to `origin/main` and deployed to production
- **Next step:** Commit and push the reviewed Stage 1.3 fixes, then begin Stage 1.4 database and storage. Owner authorized proceeding on production and phone evidence; localhost authentication is deferred.
- **Blockers:** No current production login failure reported. Localhost authentication remains unverified; the October 11 rate-limit failure is historical. Owner approved proceeding after successful production and phone checks.

---

## Stage checklist

- [ ] Stage 1 — Foundation (scaffold, deploy, login, database, storage)
- [ ] Stage 2 — Recorder & on-device analysis
- [ ] Stage 3 — Generation engine (prompts, guardrails, providers, jobs)
- [ ] Stage 4 — Mixer & save
- [ ] Stage 5 — Library
- [ ] Stage 6 — Draft → Release upgrade
- [ ] Stage 7 — Reference song → inspired-by
- [ ] Stage 8 — Export & release prep
- [ ] Stage 9 — PWA, mobile hardening, backup
- [ ] Stage 10 — Release your first song (no code)

---

## Decisions

Record any change from the defaults in `docs/01-SETUP-GUIDE.md` Part B, plus any important choices made during the build.

| Date | Decision | Reason | Decided by |
|---|---|---|---|
| | Defaults from setup guide | | Owner |
| 2026-10-06 | Use Node 24 LTS (v24.21.0) via Homebrew `node@24` instead of Node 26 (Current) | Setup guide asks for LTS | Owner |
| 2026-10-06 | Kept create-next-app defaults for Next.js 16.4 (`cacheComponents`, `partialPrefetching` on in next.config.ts) | Scaffold default; revisit if it blocks auth/data pages in Stage 1.3 | Agent |
| 2026-10-11 | Installed Node 24 LTS (v24.21.0) system-wide on Windows | Matches the project's selected LTS version and makes npm available in every terminal | Owner |

---

## Known issues / untested items

| Item | Stage | Status | Notes |
|---|---|---|---|
| `next dev` appends a "Next.js agent rules" block to AGENTS.md every time it runs | 1 | Open | Reverted each time to keep the owner's rulebook untouched. Owner to decide: keep the block, or ignore it |
| Magic-link callback and sign-out with a real email | 1.3 | Production owner-confirmed | Owner confirms production login opens the studio and Sign out returns to `/login`. The same login/sign-out test also passed on the owner's phone. Localhost authentication remains unverified. Owner confirms new-user signup disabled on 2026-10-21. |

---

## Provider docs consulted

| Provider | Doc URL | Date checked | Key facts (model ID, params, limits) |
|---|---|---|---|
| Supabase Auth | https://supabase.com/docs/guides/auth/server-side/creating-a-client | 2026-10-11 | Next.js uses cookie-backed browser/server clients and `proxy.ts`; protect identities with `getClaims()` or `getUser()`, not `getSession()` |
| Supabase Auth | https://supabase.com/docs/guides/auth/auth-email-passwordless | 2026-10-11 | Magic links use `signInWithOtp`; redirect URLs must be allow-listed |
| Supabase changelog | https://supabase.com/changelog.md | 2026-10-11 | Reviewed current breaking changes; new publishable/secret keys are preferred, while the project's fixed environment variable names remain compatible |
| Supabase Auth rate limits | https://supabase.com/docs/guides/auth/rate-limits | 2026-10-11 | The built-in email provider permits two auth emails per hour, and magic-link requests have a per-user cooldown |

---

## Session log (newest first)

### 2026-10-21 — Phone verification and publication of login fixes
- **Owner evidence:** Owner confirms the same production login/sign-out test passes on a phone, confirms signup is disabled, and explicitly requests committing and pushing all pending changes before moving forward.
- **What changed:** Successful login redirects only to the studio. Login messages explain rate limits and opening the newest link in the same browser/device. Recorded the owner's desktop and phone confirmations.
- **Validation:** Lint, typecheck, and production build passed again. The sandbox blocked a build worker; the identical build passed with normal process permissions. `.env.local` remains ignored and is excluded from the commit.
- **Remaining limitation:** Localhost browser authentication is unverified and deferred with the owner's go-ahead; production and phone evidence does not verify localhost. No hosted settings or database schema changed.
- **Commit:** `stage 1.3: clarify magic-link login and restrict redirects`.
- **Exact next step:** Push this reviewed checkpoint to `origin/main`; Stage 1.4 database and storage follows. Deployment of these follow-up edits is not yet verified at this checkpoint.

### 2026-10-21 — Owner confirms production authentication and signup restriction
- **Owner evidence:** Production magic-link login opens the studio; Sign out returns to `/login`. Owner also confirms that Allow new users to sign up is now disabled in Supabase.
- **What changed:** Updated the current status and known issues to reflect these confirmations. No code or hosted settings changed in this update.
- **Validation:** Documentation diff checked. The October 20 code changes already passed lint, typecheck and build; checks were not repeated for this documentation-only update.
- **Still pending:** Local/phone authentication checks and committing/deploying the prepared login-message and redirect fixes. Stage 1.3 is not yet marked fully complete.
- **Exact next step:** Complete those checks and publish the reviewed fixes, then begin Stage 1.4 database and storage.

### 2026-10-20 — Stage 1.3 verification and login fixes
- **What was done:** Reviewed the existing Stage 1.3 implementation and Supabase SSR/PKCE documentation. Restricted successful callback navigation to the studio, removing user-controlled redirect destinations. Added a clear HTTP 429 message and same-browser/device instructions after requesting a magic link.
- **Tested:** Lint, typecheck, and production build pass. The sandbox blocked the build worker; the permitted build outside it passed. Live `/login` returns 200; all four private pages return 307 to login; a callback without a code redirects to the login error state. These live checks cover the existing deployment, not the new local edits.
- **Testing correction:** Earlier terminal-initiated email requests did not put the PKCE verifier cookie in the owner's browser and cannot validate the owner's callback. Request the link from the actual browser login form and open it in that same browser/device. No email was sent during this session.
- **Docs:** https://supabase.com/docs/guides/auth/sessions/pkce-flow and https://supabase.com/docs/guides/auth/server-side/creating-a-client checked 2026-10-20; current changelog reviewed.
- **Still pending:** Owner login/callback/sign-out locally and live, phone confirmation, signup-disable confirmation. Stage 1.3 is not marked complete.
- **Commit:** Local changes prepared; proposed message `stage 1.3: clarify magic-link login and restrict redirects`.
- **Exact next step:** Test production login/logout in the same browser. Run `npm run dev` for the localhost test and request its link from localhost. Commit and deploy the reviewed fixes, then confirm the remaining owner checks before Stage 1.4.

### 2026-10-11 — Stage 1.3 login implementation
- **Date:** 2026-10-11
- **Agent / tool used:** Codex
- **Stage / step worked on:** Stage 1.3 — Single-user login with Supabase
- **What was done:** Pinned `@supabase/ssr` 0.12.7 and `@supabase/supabase-js` 2.117.3. Added browser, server, and server-only admin clients; Next.js 16 session proxy; owner-only magic-link login and callback; reusable `requireOwner`; sign-out; private-route redirects; and owner-email enforcement. Added real local configuration in ignored `.env.local`, and the owner configured Supabase and Vercel values plus the Supabase redirect allow-list.
- **Tested? (by agent / by owner / untested):** Agent: lint, typecheck, and production build pass with the real configuration. Both Supabase keys authenticate; `.env.local` is ignored and no secret-looking values are tracked. `/login` returns 200, all four private pages redirect to `/login`, a non-owner form submission shows "This is a private app," an owner submission reaches Supabase, and Supabase accepts the localhost callback instead of falling back to production. After deployment, the production login page contains the expected form and all four private production routes redirect signed-out requests to `/login`. Owner: confirmed Stage 1.2 mobile navigation and that the first magic link reached the old production app. Untested: browser callback/session and sign-out locally and live.
- **Problems & how they were resolved:** Next.js 16 Cache Components rejected direct `searchParams` access during login prerendering; moved the dynamic login notice behind Suspense. Next.js also rejected a non-function export from a `use server` module at form-submit time; moved the login state into `login/state.ts`. The first magic link fell back to production because localhost was absent from Supabase's redirect allow-list; the owner added localhost and production wildcard entries, and an admin-generated link confirmed localhost is now accepted. Further email testing hit Supabase's built-in two-emails-per-hour quota.
- **Commit / tag:** `0bd5049` (`stage 1.3: login`), pushed to `origin/main` and deployed; manual end-to-end verification remains pending.
- **Exact next step:** Request one fresh link after the quota resets and verify local and live callback/session/sign-out behavior. Then disable new-user signup in Supabase before starting Stage 1.4.

### 2026-10-11 — Stage 1.2 deployed
- **Date:** 2026-10-11
- **Agent / tool used:** Codex
- **Stage / step worked on:** Stage 1.2 — Deploy to Vercel
- **What was done:** Confirmed Node.js v24.21.0 and npm v11.19.0 work system-wide on Windows. Reinstalled dependencies from `package-lock.json`, verified the production build locally, and inspected the existing Vercel project. Confirmed the production deployment is READY, uses Next.js, points at current `main` commit `07378e6`, and is available at https://muziqobbiz.vercel.app. Vercel's GitHub integration is connected to `koledamilola/muziqobbiz`; pushes to `main` create production deployments, while pushes to other branches create preview deployments.
- **Tested? (by agent / by owner / untested):** Agent: lint, typecheck, and production build pass; local `/` redirects to `/muziqobbiz`; local and production `/muziqobbiz`, `/library`, `/reference`, and `/status` return HTTP 200. Owner: phone layout and navigation still to verify visually.
- **Problems & how they were resolved:** The first dependency install was interrupted and left a partial `node_modules`; removed only that generated directory and ran a clean `npm ci`. The sandbox blocked Next.js child workers during the first build, so the identical build was rerun with normal process permissions and passed. The Vercel protected-page helper lacked bypass permission, but direct public HTTPS checks succeeded.
- **Commit / tag:** `stage 1.2: record deployment`
- **Exact next step:** Open https://muziqobbiz.vercel.app on a phone and confirm the bottom navigation works, then begin Stage 1.3 — single-user login with Supabase.

### 2026-10-06 — Stage 1.1 scaffold
- **Date:** 2026-10-06
- **Agent / tool used:** Claude Code
- **Stage / step worked on:** Stage 1.1 — Scaffold the project
- **What was done:** Next.js 16.4 (App Router) + TypeScript strict + Tailwind 4 scaffolded into the repo root (via a temp folder so existing files stayed intact). Added `typecheck` script, `.env.example` (all names from AGENTS.md section 5), dark mobile-first layout with top bar and nav (bottom on phones, side on desktop), and placeholder pages: muziqobbiz, Library, Reference, Status. `/` redirects to `/muziqobbiz`. Earlier in the session: added CLAUDE.md, filled .gitignore, switched Node to 24 LTS.
- **Tested? (by agent / by owner / untested):** Agent: lint, typecheck, build pass; all four pages return 200. Owner: not yet. Visual nav switch and phone: untested.
- **Problems & how they were resolved:** `LayoutProps` type is only generated after a build, so typecheck failed on a fresh checkout; replaced with an explicit `children` type. `next dev` edited AGENTS.md; reverted (see Known issues). Owner's first `npm run dev` showed a NEXT_REDIRECT prerender error from `redirect()` in `src/app/page.tsx`; fixed by moving the `/` → `/muziqobbiz` redirect into `next.config.ts` (docs: https://nextjs.org/docs/app/api-reference/config/next-config-js/redirects) and deleting that page.
- **Commit / tag:** `stage 1.1: scaffold` (not pushed)
- **Exact next step:** Stage 1.2 — Deploy to Vercel (paste P1, then the 1.2 prompt).

### Session template — copy this block for each session
- **Date:**
- **Agent / tool used:**
- **Stage / step worked on:**
- **What was done:**
- **Tested? (by agent / by owner / untested):**
- **Problems & how they were resolved:**
- **Commit / tag:**
- **Exact next step:**
