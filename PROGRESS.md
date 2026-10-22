# PROGRESS.md — Shared logbook

Every agent reads this at the start of a session and updates it at the end. The owner can edit it any time. Keep the newest session at the top of the log.

---

## Current status

- **Current stage / step:** Stage 2.2 — Recorder audio and interface polish; owner phone/desktop verification pending
- **App URL (production):** https://muziqobbiz.vercel.app
- **Last working checkpoint (git tag or commit):** `stage 2.2: improve vocal capture and studio theme` (automated checks pass; owner verification pending)
- **Next step:** Verify a quiet wired-headset vocal and metronome count-in on phone and desktop, then start Stage 2.3 — On-device analysis with `essentia.js`
- **Blockers:** None (`FAL_KEY` and `FAL_MINIMAX_MODEL_ID` are deferred and marked optional while ElevenLabs is used alone for now)

---

## Stage checklist

- [x] Stage 1 — Foundation (scaffold, deploy, login, database, storage)
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
| 2026-10-22 | Use ElevenLabs alone for now; defer FAL.AI (`FAL_KEY`, `FAL_MINIMAX_MODEL_ID`) until later | Owner currently has an ElevenLabs account only; Status treats FAL settings as optional until added | Owner |

---

## Known issues / untested items

| Item | Stage | Status | Notes |
|---|---|---|---|
| `next dev` appends a "Next.js agent rules" block to AGENTS.md every time it runs | 1 | Open | Reverted each time to keep the owner's rulebook untouched. Owner to decide: keep the block, or ignore it |
| Magic-link callback and sign-out with a real email | 1.3 | Production owner-confirmed | Owner confirms production login opens the studio and Sign out returns to `/login`. The same login/sign-out test also passed on the owner's phone. Localhost authentication remains unverified. Owner confirms new-user signup disabled on 2026-10-21. |
| Stage 1.4 hosted schema, storage and signed-in check | 1.4 | SQL and owner browser verified | Both migrations applied; owner CRUD and row isolation pass; three private buckets and storage RLS confirmed. Owner supplied the Status success message following local test instructions. Production/phone repeat and actual Storage API round-trip are untested. |
| Stage 1.5 Status acceptance and provider configuration | 1.5 | Owner-verified live | Owner confirmed all four Status sections (`Owner verified`, `Reachable`, `0 / 25` today's generations, and `All required settings are present`). `FAL_KEY`, `FAL_MINIMAX_MODEL_ID`, and `MINIMAX_API_KEY` remain optional until added. |
| Stage 2.1 Vocal recorder browser/phone verification | 2.1 | Owner-verified | Owner confirmed recording, Play take, Retake, and Keep take all work as expected. |
| Stage 2.2 recorder and metronome verification | 2.2 | Automated checks pass; owner audio/UI test pending | 23 tests, lint, typecheck, and build pass. Needs owner verification on phone and desktop of wired-headset mic choice, quieter room noise, stronger kept take, steady click, count-in, and readable new theme. Browser noise suppression may be unavailable or may soften sung notes. |

---

## Provider docs consulted

| Provider | Doc URL | Date checked | Key facts (model ID, params, limits) |
|---|---|---|---|
| Supabase Auth | https://supabase.com/docs/guides/auth/server-side/creating-a-client | 2026-10-11 | Next.js uses cookie-backed browser/server clients and `proxy.ts`; protect identities with `getClaims()` or `getUser()`, not `getSession()` |
| Supabase Auth | https://supabase.com/docs/guides/auth/auth-email-passwordless | 2026-10-11 | Magic links use `signInWithOtp`; redirect URLs must be allow-listed |
| Supabase changelog | https://supabase.com/changelog.md | 2026-10-11 | Reviewed current breaking changes; new publishable/secret keys are preferred, while the project's fixed environment variable names remain compatible |
| Supabase Auth rate limits | https://supabase.com/docs/guides/auth/rate-limits | 2026-10-11 | The built-in email provider permits two auth emails per hour, and magic-link requests have a per-user cooldown |
| Supabase database / Data API | https://supabase.com/docs/guides/database/postgres/row-level-security and https://supabase.com/docs/guides/api/securing-your-api | 2026-10-22 | Explicit CRUD grants plus RLS; ownership checks cover old and new rows; indexed `(select auth.uid())` predicates |
| Supabase Storage | https://supabase.com/docs/guides/storage/security/access-control and https://supabase.com/docs/guides/storage/buckets/creating-buckets | 2026-10-22 | Private buckets and first-folder ownership; ALL policies cover select/insert/update/delete, including upsert |
| Supabase types | https://supabase.com/docs/guides/api/rest/generating-types | 2026-10-22 | Hand-maintained schema types supplied to server/browser/admin client generics until hosted generation is available |
| Supabase changelog | https://supabase.com/changelog.md | 2026-10-22 | Reviewed PostgreSQL 15.19/17.11 and TLS cipher breaking-change notices; no affected extensions/ciphers introduced by this migration |
| Supabase job counting | https://supabase.com/docs/reference/javascript/select | 2026-10-22 | Exact count with head:true, owner filter, inclusive UTC start/exclusive next midnight; session client and bounded query timeout |
| Next.js / Vercel Status rendering | https://nextjs.org/docs/app/getting-started/cache-components and https://vercel.com/docs/environment-variables/system-environment-variables | 2026-10-22 | Request-time cookie-backed checks behind Suspense; VERCEL_GIT_COMMIT_SHA available for deployed version labels; no cross-request cache |
| MDN Web Audio & MediaRecorder | https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder and https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData | 2026-10-22 | Detect `audio/webm` (Opus) vs `audio/mp4` (AAC) via `MediaRecorder.isTypeSupported`; disable `echoCancellation`, `noiseSuppression`, and `autoGainControl` for singing; resume `AudioContext` on user tap and decode every take to an `AudioBuffer` |
| MDN Web Audio Clock Scheduling | https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/currentTime and https://developer.mozilla.org/en-US/docs/Web/API/OscillatorNode | 2026-10-22 | Schedule metronome clicks ahead on `audioContext.currentTime` (lookahead window) with `OscillatorNode` + `GainNode` ramps so timing never jitters with `setTimeout` |
| MDN processed audio capture | https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamDestination and https://developer.mozilla.org/en-US/docs/Web/API/DynamicsCompressorNode and https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getSettings | 2026-10-22 | Record from the processed Web Audio graph; put mic gain before compression; inspect active microphone and browser noise-suppression setting. |

---

## Session log (newest first)

### 2026-10-22 — Stage 2.2 recorder cleanup and studio palette
- **Date:** 2026-10-22
- **Agent / tool used:** Codex
- **Stage / step worked on:** Stage 2.2 polish, following owner wired-headphone feedback
- **What was done:** Extracted the vocal capture graph into `src/lib/audio/recorder.ts`, moved mic gain before compression, kept the presence EQ independent of noise suppression, improved soft-gate and normalization behavior for quiet singing with a brief loud bump, and encoded the enhanced mono take as WAV so `Keep take` uses the same processed audio as playback. Removed a duplicate unused microphone-constraints constant, hardened capture cleanup after recorder errors, and displayed the active microphone label and suppression availability. Added a shared midnight-violet/coral/mint visual system across the main app, navigation, login, status, and placeholders.
- **Tested? (by agent / by owner / untested):** Agent: 23 tests, lint, typecheck, and production build pass. Owner: phone/desktop audio quality and new theme not yet tested.
- **Problems & how they were resolved:** Next.js build's worker could not spawn in the sandbox (`EPERM`); reran the same build outside the sandbox successfully. Noise filtering reduces steady noise and pauses but cannot guarantee silence under a sung voice; the browser may alter vocal tone when suppression is enabled. Enhanced WAV takes use more memory than the browser's compressed temporary recording (about 17 MB for a 3-minute mono 48 kHz take).
- **Commit / tag:** `stage 2.2: improve vocal capture and studio theme`
- **Exact next step:** Owner checks a quiet wired-headset recording with noise reduction on/off, listens to the kept take, and checks the redesigned screens on phone and desktop; then begin Stage 2.3.

### 2026-10-22 — Stage 2.2 metronome and count-in implementation
- **Date:** 2026-10-22
- **Agent / tool used:** Antigravity
- **Stage / step worked on:** Stage 2.2 — Metronome and count-in
- **What was done:** Created `src/lib/audio/metronome.ts` and updated `src/lib/audio/recorder.ts` and `src/components/Recorder.tsx`. Added an optional 4/4 metronome with BPM controls (60–180, default 90, input + step buttons + slider), volume slider, "Test click" preview, visual 4-beat indicator, and the "Use wired headphones so the click isn't recorded" reminder. Scheduled all clicks on the Web Audio clock (`audioContext.currentTime` lookahead window) with Beat 1 accented (`1100 Hz` vs `780 Hz`) and a 1-bar (4-beat) count-in before `MediaRecorder` starts. Stored the take's BPM as `"known"` (`bpmConfidence: "known"`) when recorded with the metronome. Added a live Web Audio vocal clarity & volume boost chain (`85 Hz` high-pass rumble cut, `3.2 kHz` vocal presence EQ, vocal compressor, adjustable `100%–300%` mic input boost defaulting to `180%`, browser noise suppression toggle) plus post-decode soft noise gating, `-1 dBFS` auto-normalization, and a playback volume boost slider (`50%–200%`). Added unit tests in `tests/recorder.test.mjs` (20 total tests).
- **Tested? (by agent / by owner / untested):** Agent: 20 unit tests (`tests/status.test.mjs` and `tests/recorder.test.mjs`), `lint`, `typecheck`, and `build` pass. Owner: tested wired-headphone recording and requested higher vocal volume + noise reduction (now deployed).
- **Problems & how they were resolved:** None.
- **Commit / tag:** `stage 2.2: metronome` (pushed to `origin/main`)
- **Exact next step:** Verify steady click and 1-bar count-in with wired headphones, then begin Stage 2.3 — On-device tempo, key, and energy detection with `essentia.js`.

### 2026-10-22 — Stage 2.1 vocal recorder implementation
- **Date:** 2026-10-22
- **Agent / tool used:** Antigravity
- **Stage / step worked on:** Stage 2.1 — Vocal recorder on the `/muziqobbiz` page
- **What was done:** Built `src/lib/audio/recorder.ts` and `src/components/Recorder.tsx` and mounted `<Recorder />` on `/muziqobbiz`. Added user-tap `AudioContext` startup/resume, friendly microphone permission errors with step-by-step re-enable instructions for iPhone Safari, Android Chrome, and desktop, MIME type detection (`audio/webm` on Chrome/Android, `audio/mp4` on iOS Safari), mono capture with `echoCancellation`, `noiseSuppression`, and `autoGainControl` turned OFF, a big Record/Stop button, live input level meter, 3-minute max timer with automatic stop, Web Audio decoding into an `AudioBuffer`, interactive waveform preview with click-to-seek playback, and Retake / Keep controls. Added 7 unit tests in `tests/recorder.test.mjs`. Upgraded `next` and `eslint-config-next` from `16.4.0` to `16.4.2` to resolve the Next.js security advisory.
- **Tested? (by agent / by owner / untested):** Agent: 15 unit tests (`tests/status.test.mjs` and `tests/recorder.test.mjs`), `lint`, `typecheck`, and `build` pass on Next.js 16.4.2. Untested by owner: live microphone recording, level meter, playback, and retake on desktop and phone.
- **Problems & how they were resolved:** `next build` surfaced a security advisory for Next.js `16.4.0`; upgraded `next` and `eslint-config-next` to `16.4.2` with owner approval.
- **Commit / tag:** `stage 2.1: recorder` (pushed to `origin/main`)
- **Exact next step:** Verify recording 20 seconds of singing on phone and desktop, then begin Stage 2.2 — Metronome and count-in.

### 2026-10-22 — Stage 1 Gate & Security Audit complete (`stage-1-done`)
- **Date:** 2026-10-22
- **Agent / tool used:** Antigravity
- **Stage / step worked on:** Stage 1.5 verification + Stage 1 Gate (P8) & Security Audit (P7)
- **What was done:** Recorded the owner's decision to use ElevenLabs alone for now and defer FAL.AI until later. Marked `FAL_KEY` and `FAL_MINIMAX_MODEL_ID` as optional in `src/lib/status/config.ts`, updated unit tests and `docs/04-STATUS-CHECKS.md`, and deployed Stage 1.5 (`e472f60`). Owner verified `/status` live (`Owner verified`, `Reachable`, `0 / 25` generations, and `All required settings are present`). Completed the Stage 1 Gate Review (P8) and Security & Cost Audit (P7) with all checks passing, ticked Stage 1 in `PROGRESS.md`, and created/pushed git tag `stage-1-done`.
- **Tested? (by agent / by owner / untested):** Agent: 8 unit tests, `lint`, `typecheck`, `build`, and P7/P8 audit pass. Owner: verified `/status` live with all four health sections passing.
- **Problems & how they were resolved:** None.
- **Commit / tag:** `stage 1: complete foundation and security gate` / tag `stage-1-done`
- **Exact next step:** Begin Stage 2.1 — Vocal recorder on the `/muziqobbiz` page.

### 2026-10-22 — Stage 1.5 system health Status page
- **What changed:** Added server-only configuration and health modules. Status now verifies the owner before checking settings/data and shows the signed-in email, Supabase reachability, all ten configured/missing indicators (MiniMax direct optional), actual daily jobs versus configured limit, package version, optional Vercel commit, and UTC check time. Added a full-page refresh link and kept the earlier write test under an Advanced disclosure. No automatic writes or provider calls.
- **Decisions:** Daily usage uses UTC midnight boundaries and counts all job statuses, matching the future quota query. Missing/invalid limits remain explicit; zero is valid. A failed, timed-out, or count-less database response shows unavailable rather than zero. Configured means nonempty, not validated credentials; `false` remains a valid present setting. New generation endpoints must enforce quotas later.
- **Security:** `readSystemStatus` requires the verified owner before reading environment settings, uses the cookie-backed session client/RLS, and returns only allow-listed presence flags plus intended account/usage/version metadata. Never returns raw provider settings or service error details. No shared caching. Configured server-only values were absent from compiled static client assets.
- **Validation:** Eight focused Node tests pass: presence/secret redaction, limits, UTC day rollover, commit validation, authorization order, exact owner-scoped counting, outage handling, and server-rendered missing/error states. Lint, typecheck, and production build pass. Local production server serves login with 200 and redirects signed-out Status to login with 307. Hosted SQL independently reports zero jobs today. Signed-in browser rendering is still awaiting the owner; no login email or admin session was generated by the agent.
- **Configuration:** Local `ELEVENLABS_API_KEY`, `ELEVENLABS_PLAN_IS_PAID`, and `DAILY_GENERATION_LIMIT` are configured alongside all Supabase and owner settings (all 7 required variables present). `FAL_KEY`, `FAL_MINIMAX_MODEL_ID`, and `MINIMAX_API_KEY` are marked `(optional)` while ElevenLabs is used alone for now. No paid services enabled by the agent, database migrations made, or app dependencies added.
- **Docs / tests:** docs/04-STATUS-CHECKS.md explains local/live/phone checks, settings, UTC reset, unavailable states, and limits. Run `node --test tests/status.test.mjs` for focused regression checks. Reviewed Supabase count docs, Next.js Cache Components, Vercel runtime commit metadata, and React server authorization guidance.
- **Release checkpoint:** `stage 1.5: status page`; production rollout and signed-in local/live/phone acceptance are pending at this checkpoint. Stage 1 is not marked complete or tagged until its review/security gate passes.
- **Exact next step:** Owner checks localhost Status, then repeat on production/phone after deployment. Run the Stage 1 review/security gate next.

### 2026-10-22 — Owner accepts Stage 1.4 browser check; release checkpoint
- **Owner evidence:** Following the local test instructions, the owner supplied the Status result: "Database check passed. Your test track and job were saved, read back, and removed." This verifies the signed-in server-action path and its cleanup, in addition to the hosted SQL-role tests.
- **Validation:** Lint, typecheck, and production build passed for this exact app code in the preceding verification. Only documentation and acceptance evidence changed afterward; no duplicate checks were needed. Configured server-only values were absent from compiled client assets and `.env.local` remains ignored.
- **Release:** Commit/push checkpoint `stage 1.4: database`; use its GitHub Vercel status to confirm the production rollout. Both database migrations are already applied with matching local/remote version numbers.
- **Remaining limits:** The new database check has not yet been repeated on deployed production or phone. Actual Storage API file upload/download remains untested until the audio upload workflow exists. Existing password-protection and unused-index advisor notes are documented in docs/03-DATABASE-SETUP.md.
- **Exact next step:** After the production rollout, Stage 1.5 builds out the full system health Status page. Stage 1 foundation is not complete until that step and its stage gate pass.

### 2026-10-22 — Supabase access restored; hosted Stage 1.4 migration verified
- **Connection:** Management tools now access the correct healthy project, `wwgzvepbuisjbaodcrpc` (muziqobbiz). Preflight confirmed no public tables, buckets, or storage-object policies and exactly one existing Auth account.
- **Applied:** Reviewed schema migration applied successfully. A second migration removed PUBLIC/anon/authenticated EXECUTE grants from the pre-existing `public.rls_auto_enable()` SECURITY DEFINER event-trigger helper flagged by Advisors; its function definition and trigger behavior were left intact. Local filenames were aligned with hosted migration versions `20261022161122` and `20261022161241` to prevent future CLI history drift.
- **Hosted verification:** The full rollback SQL test passed using ordinary authenticated/anon database roles: owner insert/read/update/delete, timestamp update, ownership-transfer denial, other-identity isolation, and anonymous denial. Both app tables plus storage.objects have RLS enabled; vocals, instrumentals, and mixes are private. No test records remain. The helper's public-execution grants are now absent and both associated security warnings cleared.
- **Advisors:** Remaining warning: leaked-password protection disabled (https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); app uses magic links and password settings were not changed. Two new creation-time indexes are informationally unused (https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index); retained for planned queries.
- **Validation:** Lint, typecheck, and the production build passed again. No app code changed during connection recovery and hosted migration application.
- **Still pending:** Real signed-in Status server-action check, actual Storage API file round-trip, owner phone validation of the new Status control, commit, and app deployment. SQL role simulation does not verify the owner's browser session. Stage 1.4 is not marked complete.
- **Proposed commit:** `stage 1.4: database`.
- **Exact next step:** Owner runs the already-built local app (`npm run start`), signs in, opens Status, and clicks Run database check. Expect the success message and automatic cleanup. No SQL needs to be pasted or reapplied. Commit/publish after browser acceptance; Stage 1.5 follows.

### 2026-10-22 — Stage 1.4 database and storage implementation
- **What changed:** Created `supabase/migrations/20261022161122_stage_1_4_database.sql` with both planned tables, defaults/checks, same-owner foreign keys, indexes, the track update timestamp trigger, explicit grants, RLS, three private buckets, and folder policies. Added TypeScript schema definitions, typed Supabase clients, a temporary owner-only Status server action with create/read/update/cleanup checks, a rollback SQL verification script, and `docs/03-DATABASE-SETUP.md` with exact application/testing steps.
- **Security review:** Server action calls `requireOwner` and uses the cookie-backed session client, not admin. Cleanup is scoped to newly generated UUIDs and the current owner. No secrets or full service errors are returned. Storage has a restrictive folder boundary so unrelated permissive policies cannot expose these music buckets. No reference-audio bucket or upload flow was added.
- **Validation:** Lint, typecheck, and production build pass; configured server-only values are absent from compiled client assets. Executed the complete migration and rollback verification in temporary PGlite 0.5.11 with minimal Supabase auth/storage interfaces: owner CRUD, timestamp update, ownership-transfer denial, anonymous/other-user isolation, and cleanup pass. Additional isolated tests passed for all three storage folders, denied root/other-user writes, cross-user reads/deletes, a broad legacy storage policy, and same-owner foreign keys. These isolated tests do not verify hosted Supabase's Storage API or browser sessions.
- **Hosted observations:** Read-only calls against the configured muziqobbiz project returned PGRST205 for both tables and an empty bucket list. The connected management tools list only imagineos-dev; no live writes, migration application, or security advisors were attempted against that unrelated project. Stage 1.3 commit `e470cbc` has a successful Vercel status.
- **Tooling:** Supabase CLI 2.121.0 created the migration filename. CLI and temporary PGlite validation tools were used outside app dependencies; package.json/package-lock.json are unchanged. No local Docker/Postgres installation was available.
- **Decisions / limits:** Hand-maintained database types; user/creation-time and foreign-key indexes; child references must share ownership. Paid-plan/provider verification remains the responsibility of the future release workflow. Browser-session check, real storage API access, hosted advisors, commit, and deployment remain pending. Stage 1.4 is not marked complete.
- **Proposed commit:** `stage 1.4: database`.
- **Exact next step:** Owner applies the SQL migration once in the muziqobbiz SQL Editor, runs `supabase/tests/stage_1_4_verify.sql`, and uses Status > Run database check in the local build. After verification, commit/push this checkpoint and repeat the Status check on production/phone before Stage 1.5.

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
