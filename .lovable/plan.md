# Investigation findings: published build missing sign-in values

Read-only investigation. No files were edited, nothing was published, and no migrations were run. No secret values are shown here.

## 1. Root .env in the sandbox
The file exists, written Sep 29 at 13:43 UTC. It holds these names:
- SUPABASE_PROJECT_ID: filled in (yes)
- SUPABASE_PUBLISHABLE_KEY: filled in (yes)
- SUPABASE_URL: filled in (yes)
- VITE_SUPABASE_PROJECT_ID: filled in (yes)
- VITE_SUPABASE_PUBLISHABLE_KEY: filled in (yes)
- VITE_SUPABASE_URL: filled in (yes)

`.env.production` and `.env.development` each hold only VITE_PAYMENTS_CLIENT_TOKEN, and it is filled in.

## 2. Is .env tracked in git, and what does publish read?
- Git tracks only `.env.example`. `.gitignore` lines 35–37 (`.env`, `.env.*`, `!.env.example`) exclude `.env`, `.env.production` and `.env.development`.
- Publish can only see what gets committed. The platform writes the managed `.env` into the sandbox, and `.gitignore` then keeps that file out of the commit the publish build uses. So the published build has no VITE_SUPABASE_* values.
- This matches the regression history: the security fix (issue #59) deleted `.env` and `.env.production` from git and removed the fallback values in `vite.config.ts`. After that, published builds came out with empty values.
- Two things are inferred, not directly seen: that the publish builder uses only committed files, and that it does not add these values on its own. The evidence supports both: the sandbox has the values, and the live bundle doesn't.

## 3. Connected backend
- The connected Lovable Cloud backend is **muynotmkcmehxnkhffzl**. It is the only project ref in `.env`, where it appears 4 times.
- It is not obljoemiijkryjlxihic and not xislyfqrcfpwtzonyhcr.
- A mismatch to note: `supabase/config.toml` says `obljoemiijkryjlxihic`. That file is generated and is not what the app connects to. The test `supabase-production-env.test.ts` only checks that the file has some ref. Do not point the app at obljoe.

## 4. Are VITE_* values passed into the publish build?
- In the sandbox, yes: `vite.config.ts` runs `loadEnv(...)` and `Object.assign(process.env, ...)`, which read `.env` from disk.
- In publish, no: `.env` is git-ignored, so it is missing from the build, and `requiredBuildEnv()` returns nothing, so no values get set.
- The supported Lovable Cloud setup is a committed `.env` holding only the URL, the project ID and the publishable key. These values are designed to be public and end up inside the site's scripts anyway. Private keys stay in Secrets. The reserved SUPABASE_* names can't be set by hand in Secrets, which confirms that the committed `.env` is how they get in.

## 5. Smallest change (proposal only)
Change `.gitignore` so the managed `.env` is committed and every other env file stays ignored:

```text
# replace lines 35-37
.env.*
!.env.example
```
In short: remove the bare `.env` line and keep `.env.*` and `!.env.example`. `.env.production` and `.env.development` stay ignored. They hold only the payment token meant for the browser, but per #59 they should stay out of git unless you decide otherwise.

These tests conflict with that change and would need updating:
- `src/__tests__/supabase-production-env.test.ts` currently requires that `.env` does not exist. Change it so `.env` may exist but may hold only VITE_SUPABASE_URL, VITE_SUPABASE_PROJECT_ID, VITE_SUPABASE_PUBLISHABLE_KEY and the matching non-VITE names. Nothing with a SERVICE_ROLE or SECRET name is allowed.
- `src/__tests__/no-hardcoded-credentials.test.ts` and the gitleaks tip scan should be checked. A publishable key in `.env` may be flagged, and would need an allow rule limited to publishable keys in `.env`.

`vite.config.ts` needs no change. Once `.env` reaches the build, `loadEnv` plus `requiredBuildEnv` set the values correctly. An optional extra guard: when `NODE_ENV=production` and VITE_SUPABASE_URL is missing, print a loud build warning so this can't slip through silently again.

Other option if you want to keep `.env` out of git: ask Lovable support to supply these values in the publish build. That depends on the platform, not the code.

## Rate-limit (ip_hash) migration status on the connected backend
- `support_requests.ip_hash`: exists
- `ai_chat_requests.ip_hash`: exists
- Signed-in users can run `record_audit_event`: yes
- The contents of `drizzle/migrations/0001_rate_limit_columns_and_audit_grant.sql` and `supabase/migrations/20260924161000_guide_chat_support_rate_limit_columns.sql` are both live on muynotmkcmehxnkhffzl. The changes are in place, which is what matters. Neither version number appears in the migration history table, because the changes were applied through the managed migration path under a different name.

## After approval (build mode)
1. Apply the `.gitignore` change and update the two tests.
2. Run the test suite and a production build without the sandbox env loaded, to confirm the values come only from `.env`.
3. Publish only when you say so, then confirm the live bundle contains the backend address and that sign-in finishes.
