# Build-time version stamp (Publish)

`/version.json` embeds `__GIT_COMMIT_SHA__`, `__BUILD_ID__`, `__BUILD_TIME__`, and `__COMMIT_SOURCE__` at **build time**.

## Fail-closed rule

The Vite config **refuses to build** unless it can resolve a **full 40-character** git SHA from:

1. `LOVABLE_COMMIT_SHA` (preferred for Lovable Publish), or
2. `CF_PAGES_COMMIT_SHA` / `WORKERS_CI_COMMIT_SHA` / `GITHUB_SHA` / `VERCEL_GIT_COMMIT_SHA` / `COMMIT_SHA`, or
3. `git rev-parse HEAD` / readable `.git` refs.

There is **no** `public/COMMIT` stamp-file fallback and **no** `"unknown"` commit value. Those previously allowed live to show a lagging SHA (e.g. `b175144…` while `main` had moved on).

## Publish checklist

1. Ensure Publish injects `LOVABLE_COMMIT_SHA=<full sha of the tree being published>`.
2. After Publish, open `/version.json` and confirm:
   - `commit` is the expected 40-char SHA
   - `commit_source` starts with `build-env:` or `git`
   - `build_id` is present
3. If Publish fails with "Build refused: cannot resolve…", fix the env injection — do not reintroduce a stamp-file fallback.
