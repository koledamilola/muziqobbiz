# 02 — Build Roadmap (Zero → Released Song)

**Prerequisite:** every box in `01-SETUP-GUIDE.md` Part J is ticked.
**Works with any AI coding agent.** Every prompt here is plain text. Paste it into Claude Code, Cursor, Codex, or anything else.

The roadmap has **10 stages**. Each stage has small **steps**. Each step gives you:
- a **prompt** to paste into your agent
- **owner tasks** (things only you can do, like pasting keys or clicking in a dashboard)
- **You verify** (how to check it works, no coding needed)
- a **checkpoint** (save point you can return to)

Stages 1–5 give you a working personal tool. Stages 6–9 make it release-grade and robust. Stage 10 releases a song.

---

## How to use this roadmap — the session loop

Repeat this loop for every step:

```
1. Open your agent in the project folder
2. Paste PROMPT P1 (Session Start)          → agent reads the rules and progress, confirms the next step
3. Paste the step's prompt                 → agent builds
4. Do any "Owner tasks"
5. Run through "You verify"                → if broken, use PROMPT P3 (Bug report)
6. Paste PROMPT P2 (Session End)           → agent updates PROGRESS.md and commits
7. At the end of a stage, paste PROMPT P8 (Stage Gate) and tag the checkpoint
```

**Golden rules for a solo non-coder:**
- **One step per session.** Small steps mean small breakages, and those are easy to fix.
- **Never skip "You verify."** Agents sometimes say "done" when it isn't.
- **Commit after every verified step.** Commits are free undo buttons.
- **Test on your phone** whenever the step touches recording, playback, or layout.
- **Switching agents is fine at any step boundary.** The new agent runs P1 and continues.

**How to run the app locally:** ask your agent "How do I start the app locally?" It's usually `npm run dev`, then open `http://localhost:3000`. The live version is at your Vercel URL after each push.

---

## Prompt library (reusable prompts)

### P1 — Session Start (paste at the start of EVERY session)
```
Read AGENTS.md and PROGRESS.md completely, then read the current stage in
docs/02-BUILD-ROADMAP.md. Do not write any code yet.
Reply with: (1) a 3-sentence summary of the project, (2) the current stage
and step from PROGRESS.md, (3) any known issues listed, (4) what you plan to
do this session in plain language, (5) anything you need from me first.
Then wait for my go-ahead.
```

### P2 — Session End (paste at the end of EVERY session)
```
We're ending this session. Follow AGENTS.md section 8 exactly:
run lint, typecheck and build and fix any errors; update PROGRESS.md
(current status, session log entry, untested items, decisions, docs
consulted, exact next step); then show me the proposed commit message and
commit and push once I say yes. Finish with a one-paragraph plain-language
summary of where the project stands.
```

### P3 — Bug report
```
Something isn't working. Here's what I did: [steps]. Here's what I expected:
[expected]. Here's what happened instead: [what you saw, exact error text,
screenshot description]. Device/browser: [e.g. iPhone Safari / Chrome on
laptop].
Before changing code: explain the most likely cause in plain language and
how you'll confirm it. Then fix it with the smallest change possible, and
tell me exactly how to re-test.
```
Tip: for errors on screen, also open the browser console (ask the agent how) and paste the red error text.

### P4 — Explain it simply
```
Explain what you just changed as if I'm not a developer: which files
changed, what each change does, and anything I should know or watch out
for. Under 200 words.
```

### P5 — Rollback
```
The last changes broke things and I want to go back. Show me the recent
commits and tags in plain language. Then restore the project to [the last
checkpoint / tag stage-X-done / the commit before "..."] safely — keep a
backup branch of the current state first so nothing is lost. Confirm what
was undone.
```
No-terminal alternative: in GitHub Desktop → History, right-click the bad commit → **Revert changes in commit**.

### P6 — Agent is stuck (or switching agents)
```
Stop working on the fix. Write a handoff note in PROGRESS.md under "Known
issues": the problem, everything you tried, what each attempt showed, your
best theory, and two alternative approaches. Don't commit broken code —
if the current state is broken, stash or revert to the last working commit
and say which approach you took.
```
Then open a **different agent** and start with P1. A fresh perspective often fixes it.

### P7 — Security & cost audit
```
Do a security and cost audit against AGENTS.md section 6. Check:
(1) no secret env var is used in client code or prefixed NEXT_PUBLIC_;
(2) every API route checks the user and ALLOWED_EMAIL;
(3) RLS is enabled on every table and storage bucket with user-only policies;
(4) DAILY_GENERATION_LIMIT is enforced server-side before any provider call;
(5) reference audio never leaves the browser (search the code for any
upload/fetch involving it);
(6) prompts only come from buildPrompt.ts and pass guardrails;
(7) nothing logs secrets.
Report each item as PASS/FAIL with evidence (file and line). Fix FAILs one
at a time, explaining each.
```

### P8 — Stage Gate review (end of each stage)
```
We're finishing Stage [X]. Go through every "Done when" item for every step
in Stage [X] of docs/02-BUILD-ROADMAP.md and report PASS/FAIL/UNTESTED with
evidence. Run lint, typecheck and build. List anything I still need to test
by hand. If everything passes, update PROGRESS.md (tick the stage) and
create the git tag stage-[X]-done and push it.
```

### P9 — Small change or idea
```
I'd like this change: [describe]. Before doing it: tell me whether it fits
AGENTS.md rules, which files it touches, and any risk. Keep it as small as
possible. Then implement, and give me test steps.
```

---

# STAGE 1 — Foundation
**Goal:** a live, login-protected app with a database and file storage. No music features yet, but every later stage builds on this.

### Step 1.1 — Scaffold the project
**Prompt:**
```
Stage 1.1 — Scaffold the project.
Create a Next.js (App Router) project with TypeScript (strict) and Tailwind
CSS in the current repo root, keeping AGENTS.md, PROGRESS.md, docs/ and
README.md intact. Add npm scripts: dev, build, start, lint, typecheck
(tsc --noEmit). Create .env.example listing every variable name from
AGENTS.md section 5 with empty values and a short comment each, and make
sure .env.local is gitignored.
Create a simple mobile-first layout: top bar with the app name "muziqobbiz",
and bottom navigation (on mobile) / side navigation (on desktop) with
muziqobbiz, Library, Reference, and Status pages as placeholders.
Use a clean dark theme suitable for a music app.
Done when: app runs locally, all four pages load, lint/typecheck/build pass.
Finish per AGENTS.md section 8.
```
**Owner tasks:** copy `.env.example` → `.env.local` (the agent can do the copy; you paste values in Step 1.3).
**You verify:** run the app locally and open it on your computer, then click all four pages. Shrink the browser window narrow, and the nav should move to the bottom.
**Checkpoint:** commit `stage 1.1: scaffold`.

### Step 1.2 — Deploy to Vercel
**Prompt:**
```
Stage 1.2 — Prepare for Vercel deployment.
Make sure the project builds cleanly for Vercel with default settings.
Then give me click-by-click instructions to: import this GitHub repo into
Vercel, confirm the framework preset, and deploy. Also explain how
automatic deployments work when we push to main.
Done when: I have a live URL that shows the app.
Finish per AGENTS.md section 8 (add the live URL to PROGRESS.md once I give it to you).
```
**Owner tasks:** follow the agent's steps in Vercel and share the live URL with the agent.
**You verify:** open the live URL **on your phone**. The pages load and the bottom nav shows.
**Checkpoint:** commit `stage 1.2: deployed`.

### Step 1.3 — Login (only you)
**Prompt:**
```
Stage 1.3 — Single-user login with Supabase.
Read the current Supabase docs for Next.js App Router auth with @supabase/ssr
first, and note the URL in PROGRESS.md.
Implement: browser and server Supabase clients in src/lib/supabase/
(plus a server-only admin client using SUPABASE_SERVICE_ROLE_KEY, guarded
so it can't be imported into client code); a /login page with email magic
link sign-in; an auth callback route; middleware that protects every page
except /login and redirects to /login when signed out; a sign-out button.
Enforce ALLOWED_EMAIL: if a signed-in user's email doesn't match, sign them
out and show "This is a private app." Do the same check in a reusable
server helper (requireOwner) for future API routes.
Tell me exactly which Supabase dashboard settings to change (Site URL and
Redirect URLs for both localhost and my Vercel URL) and which env vars to
set in .env.local and in Vercel.
Done when: I can sign in with my email on local and live, other emails are
blocked, and signed-out visitors can only see /login.
Finish per AGENTS.md section 8.
```
**Owner tasks:**
1. Paste the Supabase URL, anon key, service key, and `ALLOWED_EMAIL` into `.env.local` **and** into Vercel → Settings → Environment Variables. Redeploy after adding them.
2. In Supabase → Authentication → URL Configuration, set Site URL and Redirect URLs as instructed.
3. Sign in once on the live site to create your user.
4. **Then turn off "Allow new users to sign up"** in Supabase Auth settings.

**You verify:** in a private/incognito window, visiting any page sends you to `/login`. Signing in with your email works on phone and computer. A different email can't get in.
**Checkpoint:** commit `stage 1.3: login`.

### Step 1.4 — Database and storage
**Prompt:**
```
Stage 1.4 — Database schema and storage.
Create a SQL migration in supabase/migrations/ for the tracks and
generation_jobs tables exactly as described in AGENTS.md section 4
(sensible types, defaults, created_at/updated_at with an update trigger,
indexes on user_id and created_at). Enable Row Level Security on both
tables with policies allowing only user_id = auth.uid().
Create private storage buckets vocals, instrumentals, mixes with policies
so users can only access files under a folder named with their user id.
Generate TypeScript types for these tables (or hand-write them in
src/lib/types.ts if generation isn't set up).
Give me step-by-step instructions to apply the migration in the Supabase
SQL Editor (or via CLI if you set it up) and how to confirm it worked.
Done when: tables and buckets exist with RLS on, and a small server-side
test (a temporary /status check) can insert and read back a test row as me.
Finish per AGENTS.md section 8.
```
**Owner tasks:** paste the SQL into Supabase → SQL Editor → Run. Check Table Editor (two tables) and Storage (three buckets).
**You verify:** tables and buckets appear in Supabase, and the agent's test passes.
**Checkpoint:** commit `stage 1.4: database`.

### Step 1.5 — Status page
**Prompt:**
```
Stage 1.5 — Status page.
Build the /status page (owner-only) showing a checklist of system health:
logged-in user email, Supabase reachable, each env var from AGENTS.md
section 5 shown as "configured" or "missing" (never show values), today's
generation count vs DAILY_GENERATION_LIMIT (0 for now), and app version /
latest commit if available. Server-side checks only.
Done when: the page loads on local and live and correctly shows missing
vars as missing.
Finish per AGENTS.md section 8.
```
**Owner tasks:** add `FAL_KEY`, `FAL_MINIMAX_MODEL_ID`, `ELEVENLABS_API_KEY`, `ELEVENLABS_PLAN_IS_PAID=false`, and `DAILY_GENERATION_LIMIT=25` to `.env.local` and Vercel.
**You verify:** the Status page shows everything "configured" on both local and live.
**🏁 Stage gate:** paste **P8** for Stage 1, then **P7** (security audit). Tag `stage-1-done`.

---

# STAGE 2 — Recorder & on-device analysis
**Goal:** record a take on your phone, see its tempo and key, and save it safely.

### Step 2.1 — Vocal recorder
**Prompt:**
```
Stage 2.1 — Vocal recorder on the muziqobbiz page.
Build a recorder in src/lib/audio/ and a Recorder component:
- Request mic permission on tap, with friendly messages if denied
  (including how to re-enable on iPhone and Android).
- Detect a supported MediaRecorder MIME type (audio/webm on Chrome/Android,
  audio/mp4 on iOS Safari); request mono with echoCancellation,
  noiseSuppression and autoGainControl OFF (they damage singing) and
  explain this choice in a code comment.
- Big record/stop button, elapsed timer, live input level meter, a 3-minute
  max length, then a waveform preview and playback of the take.
- Allow "Retake" (discard) and "Keep".
- Decode every recording via Web Audio so later stages get an AudioBuffer
  regardless of format.
Done when: I can record, see the level meter move, play back, and retake on
Chrome desktop, iPhone Safari, and Android Chrome.
Finish per AGENTS.md section 8.
```
**You verify:** on your phone, record 20 seconds of singing. The level meter moves, playback sounds like your voice without the "phone call" processing, and retake works.
**Checkpoint:** commit `stage 2.1: recorder`.

### Step 2.2 — Metronome and count-in
**Prompt:**
```
Stage 2.2 — Metronome and count-in.
Add an optional metronome to the recorder: BPM input (60–180, default 90),
time signature 4/4, a 1-bar count-in before recording starts, accent on
beat 1, volume control, and a reminder "Use wired headphones so the click
isn't recorded." Schedule clicks with the Web Audio clock (not setTimeout)
so timing is steady. When a take is recorded with the metronome, store its
BPM as "known" (high confidence) for later steps.
Done when: the click is steady on phone and desktop, the count-in works,
and the take's BPM is remembered.
Finish per AGENTS.md section 8.
```
**You verify:** with wired headphones on, record to the click. Play it back and confirm the click wasn't recorded and that you stayed in time.
**Checkpoint:** commit `stage 2.2: metronome`.

### Step 2.3 — Tempo, key, and energy detection
**Prompt:**
```
Stage 2.3 — On-device analysis with essentia.js.
Read the current essentia.js docs first and note the URL in PROGRESS.md.
Run essentia.js in a Web Worker, loaded lazily only when analysis is
needed. From a recorded AudioBuffer (converted to mono at the sample rate
the algorithms expect), estimate: BPM (with confidence), musical key and
scale (with strength/confidence), and an energy level (low/medium/high
from loudness). If the take used the metronome, use that BPM instead of
the estimate.
Show results as editable fields: BPM number, key dropdown (all 24 major/
minor keys), energy selector, each with a "detected" or "set by you"
label and a note that detection on solo vocals is an estimate.
Show a progress indicator; the UI must not freeze.
Done when: analysis returns in a reasonable time on my phone, values are
plausible for a test take, and I can override every value.
Finish per AGENTS.md section 8.
```
**You verify:** sing something you know the key of (or check with a free tuner app). The detected key should be close or a related key, and you can override it. The page never freezes.
**Checkpoint:** commit `stage 2.3: analysis`.

### Step 2.4 — Save the take
**Prompt:**
```
Stage 2.4 — Save takes so nothing is lost.
When I tap "Keep", upload the vocal (original format is fine, plus record
its MIME type) to the vocals bucket under my user-id folder, and create a
tracks row (mode vocal_first, title "Untitled take [date time]", bpm,
musical_key, energy, vocal_path, tier draft, release_ready false,
ai_assisted true). Show upload progress and a clear success/failure
message with retry. Warn me before leaving the page if a take is unsaved.
Done when: a kept take appears as a row in Supabase with a playable file.
Finish per AGENTS.md section 8.
```
**You verify:** keep a take on your phone. In Supabase, a new `tracks` row and a file in `vocals` appear.
**🏁 Stage gate:** **P8** for Stage 2. Tag `stage-2-done`.

---

# STAGE 3 — Generation engine
**Goal:** turn descriptors into a new instrumental, safely, within budget.

### Step 3.1 — Prompt builder and guardrails
**Prompt:**
```
Stage 3.1 — Prompt vocabulary, builder and guardrails.
In src/lib/prompt/ create:
- vocabulary.ts: curated lists for genre (pop, R&B, soul, rock, indie,
  country, folk/acoustic, hip-hop, trap, afrobeats, reggae, gospel, jazz,
  lo-fi, EDM/house, ballad, cinematic), mood (upbeat, melancholic,
  romantic, driving, chill, dark, hopeful, triumphant, dreamy), energy
  (low/medium/high), instrumentation (piano, acoustic guitar, electric
  guitar, bass, 808s, strings, synth pads, brass, live drums, drum machine,
  percussion), and production feel (warm, polished, raw, spacious, punchy).
- guardrails.ts: validates optional free-text "vibe words" (max ~12 words):
  rejects phrases like "style of", "sounds like", "cover", "remix of",
  "by", "feat", likely proper names (capitalised multi-word sequences not in
  the vocabulary), quotes, and anything not mostly common musical/descriptive
  words. Returns a friendly reason when rejecting.
- buildPrompt.ts: takes structured descriptors (genre, mood, energy, bpm,
  key, instrumentation[], feel, vibe words, duration) and returns a plain
  instrumental-only prompt string, always including "instrumental, no
  vocals" wording. It's the ONLY way prompts are made.
Add unit tests (Vitest) covering good prompts and blocked inputs (e.g.
"in the style of Adele", "Taylor Swift vibes", "cover of Hello").
Add a "Beat settings" panel on muziqobbiz that uses these lists and shows a
live prompt preview.
Done when: tests pass, blocked inputs show a friendly message, and the
preview updates live.
Finish per AGENTS.md section 8.
```
**You verify:** try typing an artist name into vibe words. It should be refused with a nice explanation. Normal descriptions produce a sensible preview.
**Checkpoint:** commit `stage 3.1: prompts`.

### Step 3.2 — Provider interface and draft provider (FAL → MiniMax)
**Prompt:**
```
Stage 3.2 — Provider layer + FAL MiniMax draft provider.
Read FAL.AI's current docs for the MiniMax Music model ID in
FAL_MINIMAX_MODEL_ID (input parameters, how to request instrumental-only
output, duration limits, async/queue usage, output format) and note the
URL and key facts in PROGRESS.md "Provider docs consulted".
In src/lib/providers/: define a MusicProvider interface in types.ts
(id, tier 'draft'|'release', isConfigured(), submit(prompt, durationSec)
→ provider request id OR finished audio, checkStatus(requestId) → status +
audio URL/bytes, and normalised errors). Implement fal-minimax.ts using the
FAL server SDK or HTTP API, server-side only. Add index.ts that returns a
provider by id from config (DRAFT = fal-minimax by default).
If the model can't guarantee instrumental-only, tell me what it does
support and suggest the best workaround before continuing.
Done when: a server-only test function can submit a prompt and get back a
playable instrumental from FAL (costs one generation).
Finish per AGENTS.md section 8.
```
**You verify:** the agent shows you that a test generation succeeded. Listen to the file: it should be instrumental only.
**Checkpoint:** commit `stage 3.2: draft provider`.

### Step 3.3 — Generation jobs (async, limits, progress)
**Prompt:**
```
Stage 3.3 — Generation job system.
Check current Vercel function duration limits for my plan and design to
stay well within them.
Build POST /api/generate: requireOwner; validate input; build the prompt
ONLY via buildPrompt (re-run guardrails server-side); enforce
DAILY_GENERATION_LIMIT by counting today's generation_jobs; create a
generation_jobs row; submit to the chosen provider; return the job id
immediately.
Build GET /api/jobs/[id]: requireOwner; if still running, check provider
status; when finished, download the audio server-side, store it in the
instrumentals bucket under my folder, set result_path, mark succeeded,
and link it to the track (instrumental_path, prompt_text, provider, tier).
Handle failures with clear error_message values.
On muziqobbiz: a "Generate beat" button (choose duration, e.g. 30s/60s/full
length per provider limits), a progress state polling every few seconds
with elapsed time, friendly errors, and the result playing when ready.
Show "X of Y generations left today".
Done when: I can generate a beat from my take's settings on my phone, it
survives a 1–3 minute wait without errors, the limit blocks generation
when reached, and the Status page shows today's count.
Finish per AGENTS.md section 8.
```
**Owner tasks:** to test the limit, temporarily set `DAILY_GENERATION_LIMIT=1` locally, then set it back.
**You verify:** generate a beat on your phone, then lock and unlock the phone mid-wait. It should still finish (or resume on refresh). The limit message appears when reached.
**Checkpoint:** commit `stage 3.3: jobs`.

### Step 3.4 — Release provider (ElevenLabs)
**Prompt:**
```
Stage 3.4 — ElevenLabs Music release provider.
Read ElevenLabs' current Music API docs (instrumental-only option, length
limits, output format, sync vs async behaviour, commercial-use notes) and
log them in PROGRESS.md.
Implement src/lib/providers/elevenlabs.ts against the MusicProvider
interface, server-only, fitting the existing job system (if the API is
synchronous and long-running, make the job handling still safe under
Vercel limits and explain how).
Tier is 'release'. A generation is release_ready only if
ELEVENLABS_PLAN_IS_PAID is "true"; otherwise label it "Release provider —
not release-ready (free plan)".
(Optional, only if MINIMAX_API_KEY is set: implement minimax.ts direct
provider the same way, also tier 'release', with its own paid-plan flag.)
Add a provider selector on muziqobbiz: "Draft (cheap)" default, "Release"
when configured.
Done when: one ElevenLabs test generation works and is labeled correctly
for my current plan.
Finish per AGENTS.md section 8.
```
**You verify:** generate one beat with "Release." It's instrumental and labeled correctly for your plan.
**🏁 Stage gate:** **P8** for Stage 3, then **P7**. Tag `stage-3-done`.

---

# STAGE 4 — Mixer & save
**Goal:** hear your vocal over the beat, line them up, make it sound good, and save it.

### Step 4.1 — Two-track mixer
**Prompt:**
```
Stage 4.1 — Mixer.
Build a mixer (src/lib/audio/mixer.ts + Mixer component) that plays the
vocal and instrumental in perfect sync via Web Audio: shared play/pause/
seek, independent volume faders, mute/solo per track, a timing offset
control for the vocal (slider ±2000 ms plus fine nudge buttons ±10 ms and
±50 ms), and loop-a-section. Show both waveforms stacked so I can see
alignment. If the instrumental's BPM differs from the vocal's, show a
gentle note suggesting a regenerate. Settings update live without
restarting playback where possible.
Done when: I can line up my vocal against the beat on phone and desktop.
Finish per AGENTS.md section 8.
```
**You verify:** play the mix. Use offset nudges until the vocal sits on the beat, and confirm faders and mute work.
**Checkpoint:** commit `stage 4.1: mixer`.

### Step 4.2 — Vocal polish
**Prompt:**
```
Stage 4.2 — Vocal polish chain.
Add a vocal effects chain using built-in Web Audio nodes: high-pass filter
(~80–100 Hz), gentle compressor, simple presence EQ, and a reverb send
(generated impulse response, adjustable amount). Provide presets "Natural",
"Polished", "Big & spacious", plus manual controls in an "Advanced" drawer.
Store settings as vocal_fx JSON. Keep it subtle by default.
Done when: presets audibly change the vocal and can be toggled on/off for
comparison.
Finish per AGENTS.md section 8.
```
**You verify:** toggle effects on and off. "Polished" should sound fuller and smoother, not robotic.
**Checkpoint:** commit `stage 4.2: vocal fx`.

### Step 4.3 — Beat-first mode
**Prompt:**
```
Stage 4.3 — Beat-first mode.
Add a mode switch on muziqobbiz: "Sing first" (current flow) and "Beat first".
Beat first: choose genre/mood/BPM/key etc. → generate beat → record vocal
WHILE the beat plays in my headphones (reuse the recorder), with a count-in
derived from the beat's BPM. Add a one-time "latency calibration" in
settings (play clicks, I clap/tap along, store an offset in ms) and apply
it automatically to beat-first recordings. Save tracks with mode beat_first.
Done when: on my phone with wired headphones, a beat-first recording lines
up closely without manual nudging after calibration.
Finish per AGENTS.md section 8.
```
**You verify:** calibrate once, then record over a beat. Playback should already be close to aligned.
**Checkpoint:** commit `stage 4.3: beat-first`.

### Step 4.4 — Render and save the mix
**Prompt:**
```
Stage 4.4 — Save mix.
Add "Save mix": persist mixer settings (offset_ms, gains, vocal_fx) to the
track, render the full mix with OfflineAudioContext (same effects and
offset), encode WAV (44.1 kHz), upload to the mixes bucket, set mix_path.
Show progress; handle long renders on phones gracefully. Reopening a track
restores all mixer settings.
Done when: a saved mix plays back identically after a page refresh, and
the rendered file sounds like the live preview.
Finish per AGENTS.md section 8.
```
**You verify:** save, refresh the page, and reopen. Settings are restored, and the saved mix sounds the same as the preview.
**🏁 Stage gate:** **P8** for Stage 4. Tag `stage-4-done`.
**🎉 Milestone: you now have a working personal AI producer.**

---

# STAGE 5 — Library
**Goal:** find, replay, and manage everything you've made.

### Step 5.1 — Library list
**Prompt:**
```
Stage 5.1 — Library page.
Show all my tracks newest first as cards: title, date, genre, mood, BPM,
key, duration, badges ("Draft" / "Release-ready" / "AI-assisted"), and a
play button (mix if available, otherwise instrumental, otherwise vocal).
Filters: genre, mood, release-ready only; search by title. Use signed URLs
for private audio. Paginate or lazy-load for performance. Good empty state.
Done when: my test tracks show with correct badges and play on phone.
Finish per AGENTS.md section 8.
```
**You verify:** filters work, badges are correct, and playback works on your phone.
**Checkpoint:** commit `stage 5.1: library`.

### Step 5.2 — Track detail page
**Prompt:**
```
Stage 5.2 — Track detail.
/library/[id]: play vocal, instrumental and mix separately; edit title,
genre, mood, notes; "Open in mixer"; "Generate variation" (same settings,
new generation, saved as a new track linked by parent_track_id); show
prompt_text, provider, tier, release_ready and created date; "Delete" with
confirmation that removes the row AND its storage files.
Done when: edits persist, variations appear as linked tracks, deletion
removes files from storage.
Finish per AGENTS.md section 8.
```
**You verify:** rename a track, make a variation, delete a test track, and confirm in Supabase Storage that its files are gone.
**🏁 Stage gate:** **P8** for Stage 5. Tag `stage-5-done`.

---

# STAGE 6 — Draft → Release upgrade
**Goal:** once a cheap draft sounds right, recreate it on a release-grade provider with a provenance record.

### Step 6.1 — Finalize flow
**Prompt:**
```
Stage 6.1 — Finalize.
On a draft track, add "Finalize for release": regenerates the instrumental
with the SAME descriptors and prompt via the release provider, creates a
new track linked by parent_track_id, copies vocal and mixer settings, and
opens an A/B compare (draft vs release instrumental, switchable while
playing). If the release provider isn't on a paid plan, show a clear
warning before generating that the result will NOT be release-ready.
Done when: finalize produces a linked release-tier track and A/B works.
Finish per AGENTS.md section 8.
```
**You verify:** finalize a draft you like and A/B the two versions. The badge logic matches your plan.
**Checkpoint:** commit `stage 6.1: finalize`.

### Step 6.2 — Provenance record
**Prompt:**
```
Stage 6.2 — Provenance.
For every track, generate a provenance record (shown on the detail page and
downloadable as JSON): track id, title, created/updated dates, vocal take
timestamp, mode, descriptors, exact prompt_text, provider, tier, plan flag
at generation time, generation job ids and timestamps, release_ready,
ai_assisted, and a statement that the vocal performance is the owner's and
the instrumental was AI-generated from text descriptors without reference
audio. Store the plan flag on the job at generation time so it can't
change retroactively.
Done when: provenance downloads for a finalized track with accurate data.
Finish per AGENTS.md section 8.
```
**You verify:** download the provenance file for your finalized track and read it. It should match what you did.
**🏁 Stage gate:** **P8** for Stage 6, then **P7**. Tag `stage-6-done`.

---

# STAGE 7 — Reference song → inspired-by
**Goal:** borrow a song's vibe, never its audio, and make something clearly your own.

### Step 7.1 — On-device reference analysis
**Prompt:**
```
Stage 7.1 — Reference analysis (on-device only).
On /reference: pick an audio file, decode it in the browser, analyse it
with the existing essentia worker (BPM, key, energy, plus any other
descriptors essentia.js can provide cheaply such as danceability or
brightness — map them to our vocabulary). Then discard the audio from
memory. Show a prominent note: "Your file never leaves this device."
NO upload, NO storage, NO fetch involving the file — enforce this in code
and add a code comment referencing AGENTS.md rule 1. I'll manually choose
genre and mood (the app can suggest from descriptors).
Then tell me how to confirm in the browser's Network tab that nothing was
uploaded.
Done when: analysis works for an MP3/M4A/WAV and the Network tab shows no
upload of the file.
Finish per AGENTS.md section 8.
```
**You verify:** analyze a song on your computer with the Network tab open (the agent explains how). No large upload should appear.
**Checkpoint:** commit `stage 7.1: reference analysis`.

### Step 7.2 — "Make it my own"
**Prompt:**
```
Stage 7.2 — Inspired-by session.
From the reference results, "Start a session" pre-fills Beat settings and
lets me go to Sing first or Beat first. Add a "Make it my own" control
(default ON) that deliberately shifts descriptors so results don't
mirror the reference: e.g. tempo shifted a few percent, a different lead
instrument, a different production feel, and optionally a related key —
show me what was changed and let me adjust. Save tracks with mode
reference and store ONLY the descriptors, never the file name or any
reference identifiers.
Done when: a reference-inspired beat generates through the normal
pipeline and the track stores no info identifying the reference.
Finish per AGENTS.md section 8.
```
**You verify:** make one inspired-by track, check the track's data in the Library/provenance, and confirm there's no trace of the original song's name.
**🏁 Stage gate:** **P8** for Stage 7, then **P7**. Tag `stage-7-done`.

---

# STAGE 8 — Export & release prep
**Goal:** produce files and paperwork ready for mastering and distribution.

### Step 8.1 — Export
**Prompt:**
```
Stage 8.1 — Export.
On a track with a mix, add "Export": render the final mix, apply peak
normalisation to about -1 dBFS with a gentle limiter to avoid clipping
(note in the UI that final loudness is handled by external mastering),
then offer WAV (44.1 kHz, 24-bit) and MP3 (320 kbps) downloads, named
"Title - Owner name - YYYY-MM-DD". Also allow exporting the processed
vocal and instrumental separately (stems) for external mixing/mastering.
Done when: exported files open and sound correct in a normal media player
on my computer and phone, with no clipping.
Finish per AGENTS.md section 8.
```
**You verify:** download the WAV and MP3 and play them outside the app. Volume should be healthy, with no crackles or distortion.
**Checkpoint:** commit `stage 8.1: export`.

### Step 8.2 — Release package and checklist
**Prompt:**
```
Stage 8.2 — Release package.
On release_ready tracks, add a "Release checklist" panel with tickable
items saved per track: final mix exported; externally mastered (LANDR or
BandLab); listened on phone speaker, headphones and car; original cover
art (3000×3000, no artist names/logos you don't own); lyrics and melody
are my own original work; AI-assisted disclosure ready for the
distributor; credits written. Add "Download release package": a ZIP with
the WAV, MP3, stems, provenance JSON, and a credits.txt template
(title, performer, songwriter, producer: "[me] with AI-generated
instrumental via [provider]", ISRC to be assigned by distributor).
Draft-tier tracks show "Not release-ready — finalize first" instead.
Done when: the package downloads and opens correctly.
Finish per AGENTS.md section 8.
```
**You verify:** download a package and open the ZIP. All files are present, and credits.txt reads correctly.
**🏁 Stage gate:** **P8** for Stage 8. Tag `stage-8-done`.

---

# STAGE 9 — PWA, mobile hardening, backup
**Goal:** make it feel like a real app on your phone and protect your work.

### Step 9.1 — Installable app
**Prompt:**
```
Stage 9.1 — PWA.
Add a web app manifest (name "muziqobbiz", dark theme colour, standalone
display), an original simple icon set (generate a clean abstract
waveform icon in all required sizes, including Apple touch icon), and a
minimal service worker that caches ONLY the app shell (never audio,
signed URLs, or API calls). Add an offline fallback page.
Give me instructions to install it on iPhone (Share → Add to Home Screen)
and Android (Install app).
Done when: it installs on both, opens full-screen, and recording works in
the installed app.
Finish per AGENTS.md section 8.
```
**You verify:** install the app on your phone and record a take from the home-screen icon.
**Checkpoint:** commit `stage 9.1: pwa`.

### Step 9.2 — Mobile hardening
**Prompt:**
```
Stage 9.2 — Hardening.
Make the app robust: keep the screen awake while recording/generating
(Wake Lock API where supported); handle interruptions (phone call,
switching apps, headphones unplugged) by stopping safely and keeping
what was recorded; resume AudioContext after interruptions; global error
boundary with a friendly message and "copy error details" button;
consistent loading and empty states; prevent double-taps on Generate;
large tap targets; check layout on small and large phones.
Then list any remaining iOS/Android quirks you know of and how the app
handles each.
Done when: interruption tests don't lose recorded audio or crash the app.
Finish per AGENTS.md section 8.
```
**You verify:** start recording, then switch apps or have someone call you. The take up to that point is kept, and the app recovers.
**Checkpoint:** commit `stage 9.2: hardening`.

### Step 9.3 — Backup
**Prompt:**
```
Stage 9.3 — Backup.
On the Status page add "Back up my library": downloads a ZIP containing a
JSON export of all tracks + jobs metadata and all mix files (and
optionally vocals/instrumentals — let me choose, warn about size).
Also write docs/BACKUP.md explaining in plain language how to back up
and how I'd restore into a fresh Supabase project if ever needed.
Done when: a backup downloads and contains my tracks.
Finish per AGENTS.md section 8.
```
**Owner tasks:** do a backup once a month or after any great song, and store it in cloud storage.
**🏁 Stage gate:** **P8** for Stage 9, then a final **P7**. Tag `stage-9-done` (also tag it `v1.0`).
**🎉 The app is complete.**

---

# STAGE 10 — Release your first song (no code)

Do this when a track truly sounds good. Take your time, since a release is permanent.

- [ ] **1. Lyrics and melody are 100% yours.** If you sang someone else's song, it's a cover: it needs a cover license (DistroKid offers this) and a different process. Originals are simplest.
- [ ] **2. Upgrade ElevenLabs to a paid plan** (or MiniMax direct paid), set `ELEVENLABS_PLAN_IS_PAID=true` in Vercel, and redeploy. Plan status at generation time is what counts.
- [ ] **3. Finalize** your chosen draft (Stage 6) and make sure the track shows **Release-ready**.
- [ ] **4. Polish:** re-check the mix, and consider recording a cleaner vocal take with the beat now locked.
- [ ] **5. Export** the release package (Stage 8).
- [ ] **6. Master externally:** upload the WAV to **LANDR** or **BandLab Mastering** and download the mastered WAV. Streaming services normalize loudness, so aim for "balanced," not "as loud as possible."
- [ ] **7. Listening test:** phone speaker, earbuds, car, and laptop. Fix anything harsh or quiet.
- [ ] **8. Cover art:** original, 3000×3000 px JPG/PNG, with no other artists' names, logos, or copyrighted images. AI image tools are fine if their terms allow commercial use.
- [ ] **9. DistroKid:** create an account and choose a plan. Upload the mastered WAV and cover art, fill in title, artist name, and songwriter (your legal name), and **tick the AI-content disclosure honestly**. Don't name other artists in titles or tags. Choose a release date **2–4 weeks out** so stores have time to process it.
- [ ] **10. Songwriter royalties (optional):** register your song with a performing rights organization (BMI or ASCAP in the US) as the songwriter.
- [ ] **11. Keep the provenance package** (provenance JSON, vocal stem, prompts, dates) permanently. It's your evidence of what you made and how.
- [ ] **12. Before each release,** re-check DistroKid's and your provider's current AI policies. These rules are still changing.

I'm not a lawyer, and this checklist isn't legal advice. If a song starts earning real money or anyone challenges it, a music attorney is worth a consultation.

---

# Optional future stages (after v1.0)

Use **P9** to propose each one:
- **Vocal doubling and harmonies:** duplicate the vocal with slight pitch and time variation, or explore your provider's tools if the terms fit.
- **Take comping:** record several takes and pick the best line from each.
- **Vocal cleanup:** test a noise-reduction or voice-isolation API on singing (speech-focused tools can hurt singing, so A/B carefully).
- **Lyrics notepad:** write and attach lyrics per track, with timestamps.
- **Song structure builder:** generate intro/verse/chorus sections separately and arrange them.
- **Custom domain** for the app.

---

# Troubleshooting quick reference

| Symptom | Likely cause | What to do |
|---|---|---|
| Mic doesn't work on phone | Permission denied, or not on HTTPS | Use the live `https://` URL and re-enable mic permission in phone settings for the browser |
| No sound on iPhone | Silent switch on, or audio not started from a tap | Flip the ringer switch, tap play again; if it persists, use **P3** |
| Login link goes to the wrong site | Supabase redirect URLs | Re-check Supabase → Authentication → URL Configuration |
| "Missing" on Status page | Env var not set on Vercel, or not redeployed | Add it in Vercel and redeploy |
| Generation fails every time | Provider credit or key, or an API change | Check the FAL/ElevenLabs dashboard for credit; ask the agent to re-read provider docs (**P3**) |
| Generation times out | Long synchronous request | Ask the agent to review Stage 3.3's job pattern against current Vercel limits |
| Beat doesn't match my vocal's tempo | Generators approximate BPM | Use the offset control, regenerate, or switch to beat-first mode |
| App stopped loading after weeks away | Supabase free project paused | Log into Supabase and restore the project |
| The agent "fixed" something and broke something else | Too-large change | **P5** to roll back to the last checkpoint, then redo in smaller steps |
| The agent goes in circles | Stuck context | **P6**, then switch agents and start with **P1** |
| Build fails on Vercel but works locally | Missing env var or type error | Paste the Vercel build log into **P3** |
