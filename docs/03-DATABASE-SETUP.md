# Stage 1.4: database and private audio storage

This step creates `tracks`, `generation_jobs`, and three private buckets:
`vocals`, `instrumentals`, and `mixes`. There is no reference-song bucket.

**Applied on 2026-10-22:** Both migrations have already been applied to
`muziqobbiz` through the management connection, and the hosted SQL verification
passed. Do not apply them again. Continue with **section 3**, the signed-in app
check. The instructions below are retained for rebuilding a fresh project.

**Owner acceptance on 2026-10-22:** The owner supplied the successful Status
database-check result following the local instructions. The server action saved,
read back, and removed its test records. A production/phone repeat remains unverified.

## 1. Apply the migration once

1. Open the **muziqobbiz** project in Supabase. Its project reference is
   `wwgzvepbuisjbaodcrpc`; check this in the dashboard URL so you do not use
   `imagineos-dev` by mistake.
2. Open **SQL Editor**, then **New query**. Use the default `postgres` role.
3. In VS Code, open
   [`20261022161122_stage_1_4_database.sql`](../supabase/migrations/20261022161122_stage_1_4_database.sql).
   Copy the entire file, including `begin;` and `commit;`, into the query.
4. Click **Run**. Expect a success message. The migration creates empty tables,
   access rules, and buckets. It does not insert music or send emails.
5. In **Table Editor**, look for `tracks` and `generation_jobs`. Both should have
   RLS enabled. In **Storage**, confirm that all three buckets are **Private**.
6. On a fresh project, also run
   [`20261022161241_restrict_rls_helper_execution.sql`](../supabase/migrations/20261022161241_restrict_rls_helper_execution.sql).
   It removes unnecessary API execution grants from Supabase's existing
   automatic-RLS event-trigger helper, if that helper exists.

Do not run the migration twice. It deliberately fails if a table or bucket
already exists, rather than silently accepting a different schema. If it fails,
copy the error text (no keys or tokens) and stop; do not delete existing objects.
The transaction prevents a partially applied setup. If the editor reports an
aborted transaction, run `rollback;` in that session before trying a correction.

## 2. Verify the database rules

Open a **new query** and run the entire contents of
[`stage_1_4_verify.sql`](../supabase/tests/stage_1_4_verify.sql), still as `postgres`.
It expects exactly one existing Auth user, consistent with this private app.
It temporarily switches into ordinary authenticated and anonymous roles to test
access; a query run only as `postgres` would bypass row security.

Expect a final row beginning **PASS: tables, private buckets, owner CRUD**.
The script checks owner create/read/update/delete, the timestamp trigger,
ownership-transfer denial, another identity's access, and anonymous denial.
All test records are rolled back. This verifies database rules, not browser
login or actual audio upload/download. If it reports more than one Auth user,
ask for an adapted verification query; do not delete accounts to satisfy it.

Also open Supabase's **Advisors** and review the security findings for the new
tables. Share any finding about these tables or storage policies.

## 3. Run the signed-in app check

The new check is available only in a build containing these Stage 1.4 changes.
Until they are committed, pushed, and deployed, use the local build:

```powershell
cd C:\Users\koled\git\muziqobbiz
npm run build
npm run start
```

Open `http://localhost:3000`, sign in from that browser, and open the newest
magic link in the same browser on the same device. Choose **Status**, then
**Run database check**. Expect:

> Database check passed. Your test track and job were saved, read back, and removed.

This action runs on the server using your session and the normal Supabase
client, so row security applies. It checks both tables, updates the temporary
track, and cleans up only the random IDs it created. It never calls a music
provider. Merely opening Status does not write any data.

If the migration has not been applied, the check shows an error. If cleanup
cannot be confirmed, it shows the temporary record IDs to inspect in Table
Editor. Do not remove any other tracks. A successful cleanup cannot be guaranteed
if the server is terminated mid-request; the temporary records are titled
`Stage 1.4 connection test` / `Stage 1.4 update test` and jobs use provider
`connection_test`.

After deployment, repeat on `https://muziqobbiz.vercel.app/status`. On your
phone, use the deployed site, tap **Status**, and run the same check. The button
should show **Checking…**, then the result. No new environment variables are
needed for this stage.

## Schema choices for later stages

- Each row belongs to `user_id = auth.uid()`. Anonymous roles have no table
  grants. The app additionally checks `ALLOWED_EMAIL`; leave new-user signup
  disabled. The server-only admin client is privileged and bypasses row security.
- A parent track or a job's linked track must belong to the same user. Linked
  records must be detached/deleted deliberately before deleting their track.
- New tracks are drafts with `release_ready = false`, `ai_assisted = true`,
  gain 1, offset 0, and empty instrumentation/effects. Drafts cannot be marked
  release-ready; `ai_assisted` cannot be set false. Future release code must
  verify the provider's commercial license and paid plan before setting
  `release_ready`; the database cannot read Vercel's paid-plan setting.
- Paths are relative to a bucket: `<user UUID>/<track UUID>/<filename>`.
  Select, insert, update (including upsert), and delete are restricted to the
  user's first path segment. A restrictive policy protects these three buckets
  even if an unrelated permissive storage policy exists.
- `tracks.updated_at` is set by a trigger. Jobs use `created_at` and
  `completed_at`, matching the planned data model. Indexes cover ownership,
  creation time, and foreign-key lookups.
- TypeScript definitions in `src/lib/types.ts` are hand-maintained until hosted
  type generation is available. No app dependencies were added.
- Both migrations are recorded in the hosted migration history. Local filenames
  match the recorded versions `20261022161122` and `20261022161241`. If rebuilding
  another project by pasting SQL into its dashboard, that method does not record
  CLI migration history; reconcile history before adopting `supabase db push`.

## Hosted verification on 2026-10-22

- Both tables and `storage.objects` have RLS enabled; all three buckets are private.
- The rollback SQL test passed on hosted PostgreSQL, including owner CRUD and
  anonymous/other-identity denial. Zero test rows remain.
- The helper's public-execution warnings cleared after the follow-up migration.
- Security Advisors still reports
  [leaked password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
  This app currently uses magic-link login; password settings were not changed.
- Performance Advisors reports two
  [unused creation-time indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
  They were just created and are retained for the planned track/job queries.
- The owner confirmed the signed-in browser database check. A production/phone
  repeat and actual Storage API upload/download remain untested.

## References checked on 2026-10-22

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Data API grants and RLS](https://supabase.com/docs/guides/api/securing-your-api)
- [Storage access rules](https://supabase.com/docs/guides/storage/security/access-control)
- [Creating buckets](https://supabase.com/docs/guides/storage/buckets/creating-buckets)
- [TypeScript database types](https://supabase.com/docs/guides/api/rest/generating-types)
