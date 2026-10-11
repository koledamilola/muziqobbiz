# AGENTS.md — Rules for any AI agent working on this project

You are working on **muziqobbiz**, a personal AI music producer web app. The owner is a **solo builder with limited coding experience.** Multiple different AI agents may work on this project over time. This file plus `PROGRESS.md` are your shared memory. Read both fully before doing anything.

Full build plan: `docs/02-BUILD-ROADMAP.md`. Setup context: `docs/01-SETUP-GUIDE.md`.

---

## 1. What the app does

A private, single-user web app (installable PWA) that:

1. Records the owner's vocal in the browser, with an optional metronome click.
2. Detects tempo (BPM) and musical key **on-device** with essentia.js. The owner can confirm or override the values.
3. Builds a **text prompt from structured descriptors** (genre, mood, energy, BPM, key, instrumentation) and generates a **new, instrumental-only** track via an AI music API.
4. Mixes vocal + instrumental in the browser (gain, timing offset, simple vocal polish).
5. Saves tracks, audio, and metadata to the owner's library.
6. Upgrades a "draft" generation to a "release" generation on a commercially licensed provider.
7. Analyzes an uploaded reference song **on-device only** to extract descriptors. The reference audio is never uploaded, stored, or sent anywhere.
8. Exports WAV/MP3 with basic loudness normalization and shows a release checklist.

**Out of scope unless the owner asks:** multiple users, social features, payments, native mobile apps, real-time generation, AI vocal generation or voice cloning.

---

## 2. Tech stack (do not change without the owner's explicit approval)

| Area | Choice |
|---|---|
| Framework | Next.js (App Router), TypeScript (strict), React |
| Styling | Tailwind CSS |
| Hosting | Vercel (Hobby). Server code runs in Next.js route handlers / server actions |
| Auth, DB, storage | Supabase (Auth with email magic link, Postgres, Storage) via `@supabase/ssr` / `@supabase/supabase-js` |
| Audio analysis | essentia.js (WASM), loaded lazily inside a **Web Worker** |
| Audio recording | MediaRecorder + Web Audio API |
| Mixing/export | Web Audio API, OfflineAudioContext, WAV encoder; MP3 via a small encoder library |
| Draft generation | FAL.AI → MiniMax Music model (ID in `FAL_MINIMAX_MODEL_ID`) |
| Release generation | ElevenLabs Music API (optional: MiniMax direct) |
| PWA | Web app manifest + minimal service worker (cache the app shell only, never audio or API calls) |

If you believe a different library or approach is clearly better, **propose it and explain in plain language. Don't switch silently.**

---

## 3. Suggested project structure

```
src/
  app/
    login/page.tsx
    muziqobbiz/page.tsx              # record → analyze → generate → mix
    library/page.tsx
    library/[id]/page.tsx
    reference/page.tsx           # on-device reference analysis
    api/generate/route.ts        # create a generation job
    api/jobs/[id]/route.ts       # poll job status
    api/tracks/...               # CRUD for tracks
  lib/
    audio/                       # recorder, metronome, analyzer worker, mixer, exporter, wav/mp3 encode
    prompt/                      # vocabulary.ts, buildPrompt.ts, guardrails.ts
    providers/                   # types.ts, fal-minimax.ts, elevenlabs.ts, minimax.ts, index.ts
    supabase/                    # browser client, server client, admin client (server only)
  components/
supabase/migrations/             # all DB changes as SQL migration files
docs/
```

---

## 4. Data model (Supabase Postgres)

**`tracks`**: id (uuid), user_id, title, mode (`vocal_first` | `beat_first` | `reference`), bpm, musical_key, genre, mood, energy, instrumentation (text[]), prompt_text, provider, tier (`draft` | `release`), release_ready (bool), ai_assisted (bool, default true), vocal_path, instrumental_path, mix_path, offset_ms, vocal_gain, instrumental_gain, vocal_fx (jsonb), parent_track_id (for draft → release lineage), notes, created_at, updated_at.

**`generation_jobs`**: id, user_id, track_id, provider, tier, prompt_text, duration_sec, status (`queued` | `running` | `succeeded` | `failed`), provider_request_id, result_path, error_message, created_at, completed_at.

**Storage buckets (private):** `vocals`, `instrumentals`, `mixes`. **There is no bucket for reference songs, and never should be.**

**Row Level Security** is ON for every table and bucket. Policies allow access only where `user_id = auth.uid()`.

---

## 5. Environment variables (names are fixed)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_EMAIL`, `FAL_KEY`, `FAL_MINIMAX_MODEL_ID`, `ELEVENLABS_API_KEY`, `MINIMAX_API_KEY` (optional), `ELEVENLABS_PLAN_IS_PAID`, `DAILY_GENERATION_LIMIT`.

Keep `.env.example` up to date with names only. Never ask the owner to paste secret values into chat. Tell them which variable to fill in `.env.local` and in Vercel.

---

## 6. NON-NEGOTIABLE RULES

### Copyright & release safety
1. **Never send reference audio anywhere.** Reference songs are decoded and analyzed in the browser. Only extracted descriptors (numbers and words) may leave the device. Do not upload, store, cache, or log reference audio.
2. **Generation requests must be instrumental-only** and contain only descriptor text built by `lib/prompt/buildPrompt.ts`. Never pass audio files to a generation API.
3. **No artist names, song titles, or "in the style of [person]" in prompts.** Prompts are built from a curated vocabulary (`lib/prompt/vocabulary.ts`). Optional free-text "vibe words" must pass `lib/prompt/guardrails.ts`, which rejects likely names and titles and phrases like "style of," "sounds like," and "cover of." When unsure, reject and show a friendly message.
4. **`release_ready` is true ONLY** when the generation came from a release-tier provider on a paid plan (ElevenLabs with `ELEVENLABS_PLAN_IS_PAID=true`, or MiniMax direct on a paid plan). Draft-tier output is always labeled "Draft — regenerate before release."
5. **`ai_assisted` is always true** for generated tracks and cannot be turned off in the UI.

### Security & cost
6. Secret keys are used **only in server code.** Never import the admin Supabase client or provider modules into client components. Never prefix secrets with `NEXT_PUBLIC_`.
7. **Every API route checks the logged-in user** and that their email equals `ALLOWED_EMAIL`. Otherwise it returns 401.
8. **Enforce `DAILY_GENERATION_LIMIT`** server-side by counting today's `generation_jobs` rows before calling any provider.
9. Never log secrets, tokens, or full provider responses that might contain them.

### Third-party APIs
10. **Before writing or changing any provider integration (FAL, ElevenLabs, MiniMax, Supabase, essentia.js), read the provider's current official docs.** Don't rely on memory, because these APIs change. Note the doc URL you used in a code comment and in `PROGRESS.md`.
11. All providers implement one shared interface in `lib/providers/types.ts`. The rest of the app never knows which provider it's using. Switching providers must be a configuration change, not a rewrite.
12. **Generation is asynchronous.** It can take minutes. Use the job pattern: create a job, return immediately, let the client poll `/api/jobs/[id]` or have the server finalize when the provider completes. Never rely on one long request staying open. Respect Vercel function duration limits (check current docs).

### Audio realities (handle these, don't ignore them)
13. iOS Safari records `audio/mp4` (AAC); Chrome and Android record `audio/webm` (Opus). Detect the supported MIME type and decode everything through the Web Audio API.
14. An AudioContext must be started or resumed from a user tap (mobile autoplay rules).
15. Run essentia.js in a Web Worker. The UI must never freeze. Resample to what the algorithm expects and use mono.
16. Detected BPM and key on solo vocals are **estimates.** Always show them as editable.
17. Generators may not hit the exact BPM or key requested. The mixer provides a timing offset control. Don't promise perfect sync.

---

## 7. How to work with the owner

- **Work in small steps.** One roadmap step per session, or less. If a step is big, split it and say so.
- **Explain in plain language.** After each change, describe what you did and why in 3–6 sentences, without jargon or with jargon explained.
- **Always give testing instructions a non-coder can follow:** what to click, what they should see, and what would mean it's broken. Include phone testing when relevant.
- **Before saying "done," run** `npm run lint`, `npm run typecheck` (add this script if missing: `tsc --noEmit`), and `npm run build`. Fix all errors. If you can't fix one, say so clearly.
- **Ask before:** adding a paid service, changing the stack, deleting files or data, changing the database schema outside a migration, or doing anything irreversible.
- **Database changes** go in a new SQL file in `supabase/migrations/`. Tell the owner exactly how to apply it: paste it into the Supabase SQL Editor and click Run, unless the Supabase CLI is set up.
- **Don't add dependencies casually.** Each new package needs a one-line justification in your summary.
- **Never mark something as working if you haven't verified it.** Say "untested" when it is.
- When stuck after two failed attempts at the same bug, stop. Summarize what you tried, what you learned, and two alternative approaches, and let the owner choose.

---

## 8. End of every session (mandatory)

1. Run lint, typecheck, and build.
2. Update `PROGRESS.md`: current stage and step, what was completed, what's untested, known issues, decisions made, docs consulted, and the exact next step.
3. Propose a commit message in the form `stage X.Y: short description`. Commit if the owner agrees (or if they've told you to commit automatically).
4. Tell the owner, in one short paragraph, where things stand and what the next session should do.

---

## 9. Definition of done (for any step)

- It works as described in the roadmap step's **"Done when"** list.
- Lint, typecheck, and build pass.
- No secret is reachable from the browser.
- The owner has received testing instructions.
- `PROGRESS.md` is updated, and the work is committed.
