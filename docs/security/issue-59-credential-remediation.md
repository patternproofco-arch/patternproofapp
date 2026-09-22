# Issue #59 — Credential exposure remediation (repository side)

**Status:** Repository tip remediation is in progress via draft PR.  
**#59 stays OPEN** until provider rotations are verified on the live host and history risk is accepted or rewritten.

This document never contains secret values — only provider + credential **types**.

---

## 1. Redacted inventory

### Tip (current tree) — before this remediation

| Location | Credential / risk type | Notes |
| --- | --- | --- |
| `vite.config.ts` | Supabase URL OR-fallback | Production project host embedded |
| `vite.config.ts` | Supabase project ref OR-fallback | Production project ref embedded |
| `vite.config.ts` | Supabase publishable / anon key OR-fallback | Production publishable key literal |
| `scripts/qa/mock-session.mjs` | Supabase URL OR-fallback | Same production host as soft default |
| `.lovable/mcp/manifest.json` | Supabase Auth issuer URL | Production project host |
| `supabase/config.toml` | Supabase project ref | Non-key identifier for CLI; retained |

Prefix-only mentions of Stripe `pk_test_` / `pk_live_` in source (mode checks) are **not** embedded key values.

### Git history (`.env` / `.env.production`)

`.env` / `.env.production` are **absent from `main` tip** (deleted in `2bd57860` and `beed8ca1`) but remain recoverable from history.

**Commits that added `.env`:**

- `666626c32e17ad54e3aa12b596bd8ccd8cf676c8` (2026-05-16)
- `65b592ef24f24bd41ed43004a614b22c58ac565e` (2026-09-01)

**Commits that added `.env.production`:**

- `746c381363bfd3497c65945d90ef9e0055fcf560` (2026-06-23)
- `a7a4c8bec92b17c44145e2076f4e1e8549933edb` (2026-09-08)

**Key names observed in `.env` history (values never recorded here):**

| Provider | Key names | Value shapes seen |
| --- | --- | --- |
| Supabase | `SUPABASE_URL`, `VITE_SUPABASE_URL` | project URL |
| Supabase | `SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PROJECT_ID` | project ref |
| Supabase | `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY` | JWT anon **and** `sb_publishable_*` |
| Stripe / payments | `VITE_PAYMENTS_CLIENT_TOKEN` | Stripe publishable (`pk_*`) shape |

**Two distinct Supabase project refs** appear across history (live site may use an older project than the current repo tip).

**Not found as `KEY=value` assignments in `.env` blobs:** Clio client secret, Lovable/AI gateway key, Supabase service-role key, Stripe restricted secret / webhook secret.  
Those are still on the **rotation checklist** (issue body + defense in depth; may exist in host stores or other channels).

Removing files from the tip does **not** make historical credentials safe.

---

## 2. Repository changes in this remediation

- Fail closed in `vite.config.ts` when `VITE_SUPABASE_*` are missing (extends draft PR #103 intent on current `main` after #104).
- GitHub `pull_request` CI may use **inert** placeholders only (`example.invalid` / `ci-placeholder-*`) — never production.
- Scrubbed production host fallbacks from QA mock session and Lovable MCP manifest issuer.
- Expanded `.env.example` (placeholders / empty values only).
- Strengthened `.gitignore` for env backups and credential dump filenames.
- Added gitleaks CI (workdir + full history). **No allowlist of legitimate findings.**

---

## 3. History cleanup options (DO NOT run from this PR)

History still contains `.env` blobs. Choose one **human-operated** path after rotations:

### Option A — `git filter-repo` (recommended)

```bash
# Fresh clone, then (example — review paths before running):
git filter-repo --path .env --path .env.production --invert-paths
```

Then force-push all affected branches/tags (**coordination required**; rewrites SHAs).

### Option B — BFG Repo-Cleaner

```bash
bfg --delete-files .env
bfg --delete-files .env.production
git reflog expire --expire=now --all && git gc --prune=now --aggressive
```

Then force-push as above.

### After rewrite

1. Invalidate every credential that was ever in history (see checklist).
2. Ask collaborators to re-clone (old clones retain objects).
3. Confirm GitHub secret scanning / gitleaks **history** job goes green.
4. Only then consider closing #59.

**This PR deliberately does not rewrite history or force-push.**

---

## 4. Provider rotation checklist (human / Grace only)

**Policy:** Treat all exposed credentials as **compromised**. Tip deletion ≠ safe.  
Do **not** deactivate an old key until the replacement is configured on the live host — unless there is an immediate active abuse threat (then prioritize containment).

### Supabase (dashboard)

- [ ] Identify which project(s) the live site (`pattern-proof.tech`) actually uses (may differ from repo tip).
- [ ] Rotate **publishable / anon** key(s).
- [ ] Rotate **service-role** key(s) even if not seen in `.env` blobs.
- [ ] Update host env only (Lovable / Cloudflare): `VITE_SUPABASE_*` + server-side privileged vars.
- [ ] Redeploy / republish so bundles pick up new publishable values.
- [ ] Confirm old publishable key no longer works against the project API.

### Stripe

- [ ] Rotate / roll publishable client token used as `VITE_PAYMENTS_CLIENT_TOKEN`.
- [ ] Rotate restricted / secret keys and webhook signing secrets in the host store (even if not in `.env` history).
- [ ] Update live host; confirm test vs live mode intentionally.

### Clio

- [ ] Regenerate OAuth client secret in Clio developer app.
- [ ] Update host secrets (`CLIO_CLIENT_SECRET`, related enc key if applicable).
- [ ] Keep integration labeled unverified beta until re-tested.
- [ ] Confirm redirect URI still matches `CLIO_REDIRECT_URI`.

### AI / Lovable gateway

- [ ] Rotate Lovable / AI gateway credentials in the host secret store.
- [ ] Confirm no `VITE_` exposure of gateway credentials.

### Live host verification

- [ ] `pattern-proof.tech` (and www) serves **only** post-rotation values.
- [ ] No silent fallback to historical publishable keys (this PR removes tip fallbacks; host must still supply env).
- [ ] Reply on #59 with one line when done: **old keys are dead; live host uses rotated values only.**

Builder agents must not rotate production keys or paste secret values into chat or git.

---

## 5. CI secret scanning

- Workflow: `.github/workflows/secret-scan.yml`
- **Workdir job:** must pass on a clean tip.
- **History job:** expected to **fail** until history rewrite; do not “fix” by allowlisting real historical secrets.

GitHub Advanced Security secret scanning remains disabled on this repo (API 404); gitleaks provides an equivalent gate without GHAS.


### Additional history scan notes (gitleaks)

- Full-history gitleaks currently fails with findings in historical `.env`, `.env.production`, `.env.development`, historical `vite.config.ts` fallbacks, and at least one historical path under `src/lib/` (generic-api-key rule). **Do not allowlist these.**
- Workdir (tip) gitleaks is clean after this remediation.
