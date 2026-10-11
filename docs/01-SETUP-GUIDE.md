# 01 — Setup Guide (Start Here)

**Project:** Personal AI Music Producer ("muziqobbiz")
**Who this is for:** a solo builder with limited coding experience, building with AI coding agents.
**What this file does:** gets everything in place *before* any code is written. When you finish this file, you open `02-BUILD-ROADMAP.md` and start Stage 1.

Do the parts in order. Tick each box as you go. Expect this to take **one or two evenings**.

---

## How the four files fit together

| File | Where it lives | Purpose |
|---|---|---|
| `01-SETUP-GUIDE.md` | `docs/` in your project | This file. Requirements and setup, done once. |
| `02-BUILD-ROADMAP.md` | `docs/` in your project | Stage-by-stage build with every prompt you need, from empty folder to released song. |
| `AGENTS.md` | Project root | The "rulebook" every AI agent reads. Describes the app, stack, rules, and guardrails. **This is what makes the plan work with any agent.** |
| `PROGRESS.md` | Project root | The shared logbook. Every agent updates it at the end of a session, so the next agent (same tool or a different one) knows exactly where things stand. |

The core idea: **your project folder on GitHub is the source of truth, not any single AI tool.** Agents come and go; `AGENTS.md` + `PROGRESS.md` + the code stay. You can switch from Claude Code to Cursor to Codex mid-build without changing anything in the plan.

---

## Part A — What you're building (one-minute version)

A private web app you open on your phone or computer that:

1. **Records your voice** (optionally with a metronome click so timing is predictable).
2. **Detects tempo and key** of what you sang, which you can correct.
3. **Generates a brand-new instrumental** from plain-text descriptors (genre, mood, tempo, key) using an AI music API. It never sends anyone else's audio to the AI.
4. **Mixes** your vocal over the beat, with volume, timing nudge, and a simple vocal polish.
5. **Saves** everything to your personal library.
6. **Upgrades** a cheap "draft" beat to a "release-grade" version from a provider with clear commercial rights.
7. **Analyzes a reference song you upload, on your device only,** to borrow its vibe as descriptors. The song file is never uploaded or stored.
8. **Exports** a WAV/MP3 plus a release checklist, ready for mastering and DistroKid.

```
Phone/Computer browser (the app)
 ├─ record vocal, analyze tempo/key on-device, mix, export
 └─ talks to ──► Vercel (hosting + small server functions that hold your secret keys)
                   ├─► Supabase (login, database of tracks, audio file storage)
                   ├─► FAL.AI → MiniMax Music   (cheap DRAFT beats)
                   └─► ElevenLabs Music          (RELEASE-grade beats)
```

---

## Part B — Decisions (recommended defaults already chosen)

You can change these, but the whole plan assumes the defaults. If you change one, write it in `PROGRESS.md` under "Decisions."

| Decision | Recommended default | Why it's the best fit for you |
|---|---|---|
| App framework | **Next.js + TypeScript + Tailwind CSS** | The framework AI agents know best. Pages and server functions live in one project, and TypeScript lets agents catch their own mistakes. |
| App type | **Responsive web app, installable as a PWA** | One codebase works on phone and desktop. No App Store needed. |
| Hosting | **Vercel (Hobby, free)** | Made by the creators of Next.js, with near-zero configuration. Auto-deploys every time code is pushed to GitHub. The Hobby plan is meant for personal, non-commercial projects, which fits this one. |
| Login, database, file storage | **Supabase (free tier)** | One account covers three needs: auth, Postgres database, and audio file storage. Fewer accounts means fewer things to manage. |
| Draft beat generation | **FAL.AI running MiniMax Music** | Very cheap per generation and prepaid credits, so you can't overspend. |
| Release-grade generation | **ElevenLabs Music (paid plan)** | Clear commercial-use terms on paid plans. Optional alternative: MiniMax's own paid plan directly. |
| Tempo/key detection | **essentia.js** (runs in the browser) | Free, private, no server cost. |
| Mastering for releases | **External: LANDR or BandLab Mastering** | Don't build what already exists. The app only does a basic loudness pass. |
| Distribution | **DistroKid** | The most practical option for AI-assisted tracks with honest disclosure. Only needed at the very end. |
| Primary AI agent | **A repo-based agent:** Claude Code, Cursor, OpenAI Codex, or similar | These work directly on your project files and GitHub, so switching between them is seamless. See Part H about browser builders. |

---

## Part C — Gear checklist

- [ ] **A computer** (Mac, Windows, or Linux) for building. Agents run here.
- [ ] **A smartphone** (iPhone and/or Android) for testing mic recording and the installed app.
- [ ] **Wired headphones or earbuds.** You need these whenever you record over a beat or a metronome, so the beat doesn't bleed into your vocal mic. Wired matters: Bluetooth headphones add delay, which throws off timing.
- [ ] **A quiet, soft-surfaced room** (a closet with clothes or a carpeted room with curtains) for test recordings.
- [ ] *(Optional, later)* A USB microphone for better quality. The app works with a phone mic.

---

## Part D — Accounts (in this order)

For each account, store every key and password in a password manager as you go.

**Golden rule for API keys: never paste a secret key into an AI chat.** You'll put keys into a local file and into Vercel yourself (Part G). Agents only ever see the variable *names*, never the values.

### D1. Password manager
- [ ] Set up a password manager (Bitwarden is free; 1Password, Apple Passwords, and Google Password Manager also work).
- [ ] Create a secure note called **"muziqobbiz app keys"**. Every key below goes there.

### D2. GitHub (free)
- **Why:** stores your code and its full history, so you can roll back any mistake. Every agent and Vercel connect to it.
- [ ] Sign up at github.com.
- [ ] Turn on two-factor authentication (Settings → Password and authentication).
- [ ] *(Recommended for non-coders)* Install **GitHub Desktop**, a visual app to see changes and undo things without typing commands.

### D3. Vercel (free Hobby plan)
- **Why:** puts your app on the internet at an `https://` address. HTTPS is required for the mic to work on phones.
- [ ] Sign up at vercel.com using **"Continue with GitHub."**
- [ ] Nothing else yet. You'll connect the project in Stage 1.

### D4. Supabase (free tier)
- **Why:** login (just you), the database of your tracks, and storage for audio files.
- [ ] Sign up at supabase.com (sign in with GitHub is easiest).
- [ ] Create a new project named `muziqobbiz`. Pick the region closest to you (US East for Virginia).
- [ ] Save the **database password** it generates to your password manager.
- [ ] Wait for the project to finish setting up. Then go to Project Settings → API (or "API Keys") and save these three values to your note:
  - **Project URL**
  - **anon / publishable key** (safe for the browser)
  - **service_role / secret key** (server only, never shared)
- [ ] Authentication → Sign In / Providers: make sure **Email** is enabled.
- [ ] Authentication settings: **turn off "Allow new users to sign up"** once you've created your own account in Stage 1. The roadmap reminds you when.
- Note: free Supabase projects pause after a period of inactivity. If the app stops loading after you've been away for a while, log into Supabase and click "Restore project."

### D5. FAL.AI (pay-as-you-go, draft beats)
- **Why:** cheap access to MiniMax Music for drafts. Generate lots of ideas for pocket change.
- [ ] Sign up at fal.ai.
- [ ] Add a **small prepaid credit** ($5–10). Prepaid credit is your spending cap.
- [ ] Create an API key and save it as `FAL_KEY` in your note.
- [ ] In the model gallery, search "MiniMax music" and note the exact model name or ID of the newest version. Save it in your note too.

### D6. ElevenLabs (release-grade beats)
- **Why:** clear commercial rights on paid plans, for tracks you might release.
- [ ] Sign up at elevenlabs.io.
- [ ] While building, the free tier is fine for testing. **Before you generate any track you plan to release, upgrade to a paid plan.** Commercial rights depend on the plan you're on *when the audio is created*.
- [ ] Profile → API Keys: create a key and save it as `ELEVENLABS_API_KEY`.
- [ ] Before upgrading, read the current plan and terms page and confirm commercial use of Music output is included. Terms change.

### D7. *(Optional)* MiniMax direct
- Only if you'd rather use MiniMax's own paid plan as your release-grade provider instead of, or in addition to, ElevenLabs.
- [ ] Sign up on MiniMax's platform, get an API key, save it as `MINIMAX_API_KEY`, and read the commercial-use terms of the paid plan.

### D8. Not yet
- [ ] ~~DistroKid~~: create it in Stage 10, when you have a finished song.
- [ ] ~~LANDR / BandLab~~: Stage 10.
- [ ] ~~Custom domain~~: optional. The free `yourapp.vercel.app` address works fine.

---

## Part E — Set up your computer

Ask for help with any of these from any AI chat assistant. These are standard installs.

- [ ] **Node.js (LTS version)** from nodejs.org. To check: open Terminal (Mac) or PowerShell (Windows) and type `node -v`. You should see `v20.x` or higher.
- [ ] **Git** from git-scm.com (Macs often already have it). To check: `git --version`.
- [ ] **A code editor:** VS Code (free). If you choose Cursor as your agent, Cursor *is* your editor.
- [ ] **Your primary AI agent**, installed and logged in. Pick one to start; you can add others any time:
  - **Claude Code**: install per Anthropic's docs and run it inside your project folder.
  - **Cursor**: install the desktop app and open your project folder.
  - **OpenAI Codex CLI** or a similar repo-based agent: install per its docs.
- [ ] Confirm the agent can see files: open it in any folder and ask "List the files in this folder." If it lists them, you're set.

---

## Part F — Create the project folder and repository

- [ ] On GitHub, click **New repository**:
  - Name: `muziqobbiz`
  - **Private** ✔
  - Add a README ✔
  - .gitignore template: **Node**
- [ ] Clone it to your computer: GitHub Desktop → File → Clone repository → `muziqobbiz`. Pick a simple location like `Documents/muziqobbiz`.
- [ ] Add the planning files to it:
  ```
  muziqobbiz/
  ├── AGENTS.md          ← from this package
  ├── PROGRESS.md        ← from this package
  ├── README.md
  ├── .gitignore
  └── docs/
      ├── 01-SETUP-GUIDE.md
      └── 02-BUILD-ROADMAP.md
  ```
- [ ] Open `PROGRESS.md` and fill in the "Decisions" section with anything you changed from Part B. If you kept everything, write "Defaults from setup guide."
- [ ] Commit and push: in GitHub Desktop, type the summary "Add planning docs," then click **Commit to main** and **Push origin**.

---

## Part G — Secrets: where each key goes

Your app reads secrets from **environment variables**. You'll set them in two places:

1. **On your computer:** a file named `.env.local` in the project root. The agent creates an empty template called `.env.example` in Stage 1. You copy it to `.env.local` and paste values in **yourself**. This file is ignored by git and never uploaded.
2. **On Vercel:** Project → Settings → Environment Variables. Same names, same values.

| Variable name | Value from | Secret? | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | No | Safe in the browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key | No | Safe in the browser, protected by database rules |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role/secret key | **YES** | Server only. Never prefix with `NEXT_PUBLIC_` |
| `ALLOWED_EMAIL` | Your email address | Mild | The only email allowed to use the app |
| `FAL_KEY` | FAL.AI | **YES** | Draft provider |
| `FAL_MINIMAX_MODEL_ID` | FAL.AI model page | No | The model ID you noted in D5 |
| `ELEVENLABS_API_KEY` | ElevenLabs | **YES** | Release provider |
| `MINIMAX_API_KEY` | MiniMax (optional) | **YES** | Leave blank if unused |
| `ELEVENLABS_PLAN_IS_PAID` | `true` or `false` | No | Set to `true` only after you upgrade. Controls the "release-ready" label |
| `DAILY_GENERATION_LIMIT` | e.g. `25` | No | App-level spending safety net |

Rule of thumb: anything starting with `NEXT_PUBLIC_` is visible in the browser, so **only** the Supabase URL and anon key get that prefix.

---

## Part H — Configure your AI agents (agent-agnostic setup)

Every agent must read `AGENTS.md` and `PROGRESS.md` at the start of every session. Different tools pick these up differently:

| Tool | How it picks up the rules | What you do |
|---|---|---|
| Claude Code | Reads `CLAUDE.md` automatically | Create a `CLAUDE.md` in the project root containing one line: `Read and follow AGENTS.md and PROGRESS.md before doing anything.` |
| Cursor | Recent versions read `AGENTS.md`; also supports project rules | Nothing extra. If it seems to ignore the rules, add a project rule with the same one line. |
| OpenAI Codex and many others | Read `AGENTS.md` natively | Nothing extra. |
| Gemini CLI | Reads `GEMINI.md` | Create `GEMINI.md` with the same one line. |
| Any other tool | Unknown | Always start with the **Session Start prompt** from the roadmap. This works everywhere. |

**About browser builders** (bolt.new, Lovable, v0, Replit Agent): they're fast, but some impose their own project structure or hosting, which makes switching agents harder. If you use one, only use it if it **syncs to your GitHub repo**, and paste the contents of `AGENTS.md` into its project instructions. Recommendation: use a repo-based agent as your main builder, and use browser builders only for quick UI experiments.

**Using multiple agents safely:**
- Only **one agent works on the project at a time.** Never run two at once on the same files.
- Every session ends with the **Session End prompt** from the roadmap. That updates `PROGRESS.md` and creates a checkpoint, so the next agent starts clean.
- When an agent gets stuck going in circles on a bug, switching to a different agent with the same handoff is a legitimate and often effective move.

---

## Part I — Spending guardrails (set these now)

- [ ] **FAL.AI:** prepaid credit only, with no auto-top-up. That's a hard cap.
- [ ] **ElevenLabs:** a subscription has a built-in monthly quota. Check that any "usage-based billing" or overage option is **off** if you want a hard cap.
- [ ] **AI agent subscription:** know your plan's limits so you aren't surprised mid-stage.
- [ ] **In-app:** the build includes a daily generation limit (`DAILY_GENERATION_LIMIT`) and requires login, so nobody else can spend your credits.

**Rough monthly budget while building:** about $5–10 in FAL credit, your agent subscription, $0 for Vercel and Supabase on free tiers, and $0 for ElevenLabs until you're ready to make release-grade tracks (then roughly the price of an entry paid plan; check current pricing).

---

## Part J — Ready-to-build check

All of these should be ✔ before Stage 1:

- [ ] Wired headphones and a phone ready for testing
- [ ] Password manager note holds: Supabase URL, anon key, service key, DB password, FAL key and model ID, ElevenLabs key
- [ ] GitHub repo `muziqobbiz` exists (private), is cloned locally, and contains `AGENTS.md`, `PROGRESS.md`, and `docs/` with both guides
- [ ] Vercel account linked to GitHub
- [ ] Supabase project created, Email login enabled
- [ ] Node `v20+` and Git installed and verified
- [ ] At least one AI agent installed and able to read your project folder
- [ ] Agent-specific pointer file created if needed (`CLAUDE.md` / `GEMINI.md`)
- [ ] Spending caps set on FAL.AI and ElevenLabs

**Done? Open `docs/02-BUILD-ROADMAP.md` and start with "How to use this roadmap," then Stage 1.**
