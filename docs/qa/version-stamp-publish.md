# Build-time version stamp (Publish)

`/version.json` embeds `__GIT_COMMIT_SHA__`, `__BUILD_ID__`, `__BUILD_TIME__`, and `__COMMIT_SOURCE__` at **build time**.

## Fail-closed rule

The Vite config **refuses to build** unless it can resolve a **full 40-character** git SHA from:

1. Full SHA in env (preferred for Lovable Publish): `LOVABLE_COMMIT_SHA`, `LOVABLE_GIT_COMMIT`, `LOVABLE_GIT_COMMIT_SHA`, or
2. Other CI envs: `CF_PAGES_COMMIT_SHA` / `WORKERS_CI_COMMIT_SHA` / `CLOUDFLARE_COMMIT_SHA` / `GITHUB_SHA` / `VERCEL_GIT_COMMIT_SHA` / `CI_COMMIT_SHA` / `COMMIT_SHA` / `GIT_COMMIT` / `GIT_COMMIT_SHA`, or
3. A 7–39 hex short SHA in those envs **expanded** via `git rev-parse <short>` when `.git` exists (never invented), or
4. `git rev-parse HEAD` / readable `.git` refs.

There is **no** `public/COMMIT` stamp-file fallback and **no** `"unknown"` commit value. Those previously allowed live to show a lagging SHA (e.g. `b175144…` while `main` had moved on).

## Publish checklist

1. Prefer Publish injecting `LOVABLE_COMMIT_SHA=<full sha of the tree being published>`. A normal git checkout also works via `git rev-parse HEAD` (no Lovable env required).
2. After Publish, open `/version.json` and confirm:
   - `commit` is the expected 40-char SHA
   - `commit_source` starts with `build-env:` or `git`
   - `build_id` is present
3. If Publish fails with "Build refused: cannot resolve…", fix the env injection or ensure `.git` is present — do not reintroduce a stamp-file fallback.

## Node 20 / undici (Publish build)

Lovable Publish / local CI often run **Node 20**. `undici@8` uses `webidl.util.markAsUncloneable`, which **does not exist on Node 20**, and crashes config load with:

`TypeError: webidl.util.markAsUncloneable is not a function`

`overrides` / `resolutions` (and a direct `dependencies` pin) set `undici` to **7.29.1** (engines: Node `>=20.18.1`) so Publish and local Node 20 builds stay compatible. Do not bump to undici 8 until Publish/CI standardize on Node 22+ (`undici@8` requires `>=22.19.0`).
