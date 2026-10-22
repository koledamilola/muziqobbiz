# Stage 2 — Recorder, analysis, and saving

The owner has authorized publishing the verified implementation to main, superseding the earlier push hold. Do not tick Stage 2 or tag `stage-2-done` while the remaining acceptance checks below are unverified.

## Owner check on this computer

1. Open http://localhost:3000/muziqobbiz. If asked to sign in, request the link from **localhost**, then open the newest email in the same browser. Production login does not sign you into localhost.
2. Use wired headphones and record 10–20 seconds of singing. Stop and play the take.
3. Wait for analysis. Tempo, key, and energy should appear without freezing the page. Try a song whose key you know. These are estimates on solo vocals; an unknown or related key can happen.
4. Edit BPM, select one of the 24 major/minor keys, and change energy. Each edited field should say **Set by you**. Empty BPM/key means unknown; valid tempo is 40–250 BPM.
5. Before saving, click Library. Expect a warning; cancel it and confirm the take remains. Reloading/closing the tab and signing out also warn while unsaved. Browser Back behavior can vary; save before using browser history controls.
6. Click **Keep & save take**. Expect upload progress, then **Take saved ✓**, a title, and a player for the stored vocal. Play it. Retake is disabled during saving so a pending save cannot be accidentally discarded.
7. Check Supabase: one new `tracks` row should have your edited BPM/key/energy, `tier=draft`, `release_ready=false`, `ai_assisted=true`, and a `vocal_path`. A private file should exist at `vocals/<your user ID>/<take ID>/vocal.wav`. File MIME type, size, and duration are stored in `vocal_fx.capture`; source labels are in `vocal_fx.analysisSources`.
8. Record again with the metronome set to a different tempo. The one-bar count-in should work and analysis should preserve that BPM as **Known · metronome**. Confirm the click is not audible in the recorded vocal.

An unsaved take still exists only in this tab. If saving fails, keep the tab open and use **Retry saving take**. A lost response does not require re-recording or create a second row. If the session expired, sign in in a separate localhost tab, then return and retry. Temporary saved-file playback links last one hour; the private file itself remains stored. Library browsing comes in Stage 5.

## Phone checks still needed

Repeat the recording/count-in, analysis/editing, and save/playback checks in the target phone browser. Confirm the analyzer finishes in a reasonable time and the page remains responsive. Cover iPhone Safari and Android Chrome as available; do not assume a desktop Chrome fixture verifies either.

Microphone capture requires a secure context. `localhost` is suitable on this computer, but an ordinary `http://<computer-IP>:3000` address on a phone will generally block the microphone. After the authorized push, confirm Vercel has deployed the new commit before testing at https://muziqobbiz.vercel.app/muziqobbiz. Phone acceptance remains pending until these checks pass there or in another trusted HTTPS environment.

## Implementation notes

- Essentia 0.1.3 runs in a dedicated worker, loaded only after recording. Mono audio is resampled with OfflineAudioContext to 44.1 kHz. Analysis uses at most the first 45 seconds; playback and upload retain the entire take. Silent/very short recordings can be filled in manually. Key strength and rhythm confidence are estimator outputs, not probabilities of being correct. Energy is based on recording loudness, which normalization can affect.
- Pinned Essentia ES assets and its license are copied from `node_modules` by `postinstall`, `predev`, and `prebuild`; these generated files are ignored by Git and ESLint. There is no runtime CDN or audio upload for analysis.
- Only the vocal save path uploads audio. `/api/takes` verifies the owner, validates settings and WAV details, and issues an owner-scoped signed upload token. The browser uses TUS directly to Storage, including the signed `/storage/v1/upload/resumable/sign` endpoint. Six-MiB chunks, metadata-request timeouts, progress, and retries avoid Vercel request-body limits.
- Finalization checks object size/type before inserting metadata. A take UUID is stable across retries; existing uploads and rows are reused. The enhanced WAV is the saved vocal. No database migration was needed.
- Incomplete uploads/unsaved metadata are not automatically deleted, so retry can recover them. If the tab is discarded before completion, an orphaned vocal file may need later housekeeping. No broad storage cleanup was added.

## Agent verification

Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.

`node scripts/verify-stage2-browser.mjs` requires a completed build and local Chrome (override `CHROME_PATH` if needed). It serves isolated built assets on loopback, uses generated audio and the actual worker, and uses fixture save responses. It checks detected values, all key options, edits, retry with a stable ID, navigation cancellation, saved-player rendering, and metronome BPM priority. It does **not** verify real owner login or client-to-hosted saving.

`node --env-file=.env.local scripts/verify-stage2-storage.mjs` uses the server key in Node only. It uploads a generated 70-second WAV (over 6 MiB), finalizes one temporary row, reads/playbacks the file, checks idempotent retry, and removes only that invocation's exact UUID/path. It verifies Storage POST/PATCH and backend behavior with admin privileges; it does **not** verify session-client RLS or the owner's browser session. No auth account/session is created or modified by the check.

## P8 stage gate — current evidence

| Step / criterion | Result | Evidence or remaining check |
|---|---|---|
| 2.1 record, meter, playback, retake | PASS for owner-reported use; full device matrix UNTESTED | Prior owner confirmation; current generated-audio browser checks pass. Explicit Safari/Android coverage remains pending. |
| 2.2 count-in and remembered BPM | PASS in automated browser check | Actual Web Audio recording with 90 BPM count-in keeps 90 BPM after analysis. |
| 2.2 steady audible click and no bleed on phone | UNTESTED | Owner listening test needed; scheduled clock timestamps are unit tested. |
| 2.3 plausible analysis and overrides | PASS for synthetic fixture; real phone take UNTESTED | Pinned engine and built worker return C major/about 120 BPM for the generated C-major/120 BPM fixture. All three fields can be changed and submitted. |
| 2.3 background processing and loading state | PASS in desktop browser fixture; phone speed UNTESTED | Dedicated worker, progress messages, bounded excerpt, abort/timeout handling; owner phone check needed. |
| 2.4 stored row and playable vocal | PASS for hosted backend fixture; real signed-in UI UNTESTED | 6,720,044-byte upload uses one POST and one PATCH; row, signed playback bytes, retry reuse, and cleanup pass. |
| 2.4 progress/retry and unsaved warning | PASS in automated UI/logic checks; owner check pending | Fixture failure preserves take/settings; retry reuses ID; navigation warning cancels leaving. |
| Owner-only routes and storage | PASS in code/tests; session-client save UNTESTED | Owner verification before input/storage access, scoped paths, existing RLS unchanged, matching upload required, expired/wrong-owner API sessions return JSON 401. |
| Server secrets excluded from client | PASS | Compiled client assets scanned against configured server-only values, with no matches. |
| Required quality checks | PASS | 36 tests, lint, typecheck, production build. |

Stage 2 is **not yet tagged complete** because manual acceptance is still pending. Publication to main is authorized; a Git push does not establish deployment success or manual acceptance.

Dependency review: `npm audit --omit=dev` reports zero vulnerabilities. Full audit reports a pre-existing development-only `braces`/`micromatch` chain in Next's ESLint tooling (five high-severity entries). npm proposes downgrading `eslint-config-next` to Next 14, which conflicts with this project's Next 16 setup; no forced downgrade was applied.
