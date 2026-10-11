# PROGRESS.md — Shared logbook

Every agent reads this at the start of a session and updates it at the end. The owner can edit it any time. Keep the newest session at the top of the log.

---

## Current status

- **Current stage / step:** Stage 1.1 complete (scaffold) — ready for Stage 1.2
- **App URL (production):** _(added in Stage 1)_
- **Last working checkpoint (git tag or commit):** `stage 1.1: scaffold` (local, not pushed)
- **Next step:** Stage 1.2 — Deploy to Vercel
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

---

## Known issues / untested items

| Item | Stage | Status | Notes |
|---|---|---|---|
| `next dev` appends a "Next.js agent rules" block to AGENTS.md every time it runs | 1 | Open | Reverted each time to keep the owner's rulebook untouched. Owner to decide: keep the block, or ignore it |
| Nav layout checked only via HTTP responses, not visually; phone untested | 1.1 | Untested | Owner to verify (see session log) |

---

## Provider docs consulted

| Provider | Doc URL | Date checked | Key facts (model ID, params, limits) |
|---|---|---|---|
| | | | |

---

## Session log (newest first)

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
