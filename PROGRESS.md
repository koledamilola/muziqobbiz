# PROGRESS.md — Shared logbook

Every agent reads this at the start of a session and updates it at the end. The owner can edit it any time. Keep the newest session at the top of the log.

---

## Current status

- **Current stage / step:** Stage 1.2 complete (deployed) — ready for Stage 1.3
- **App URL (production):** https://muziqobbiz.vercel.app
- **Last working checkpoint (git tag or commit):** `07378e6` (`Add setup docs and app scaffold`), deployed to production
- **Next step:** Stage 1.3 — Single-user login with Supabase
- **Blockers:** none

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
| Nav layout checked only via HTTP responses, not visually; phone untested | 1.1–1.2 | Untested | Owner should open the production URL on a phone and verify that the bottom nav appears and all four links work |

---

## Provider docs consulted

| Provider | Doc URL | Date checked | Key facts (model ID, params, limits) |
|---|---|---|---|
| | | | |

---

## Session log (newest first)

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
