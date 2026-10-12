# Published-source verification and widget removal — October 12, 2026

Lovable's published `/version.json` reports `commit: unknown`; project metadata identifying main is not evidence that the hosted artifact contains it. Builds now emit a deterministic SHA-256 source digest alongside honest commit metadata. Strict builds can still require a real SHA with `REQUIRE_COMMIT_SHA=1`.

The versioned digest covers application sources, public assets, scripts, migration files, package manifests/lockfiles and listed build/test configurations. It uses sorted paths and length-delimited content. It excludes environment files, git metadata, dependencies, generated build output and docs. Symbolic links are refused. It verifies those source inputs; it does not verify deployed database migrations, runtime secrets, external provider configuration or physical-device behavior.

Run from the checkout being released:

```sh
node scripts/source-digest.mjs
node scripts/verify-published-source.mjs https://pattern-proof.tech
```

The verifier rejects absent/unsupported markers, mismatched source, malformed commit metadata and invalid build-instance metadata. A host without git can pass only with the matching source digest and an honestly unavailable commit. Network access respects configured proxies. GitHub launch checks print the digest for comparison. The existing `/version` diagnostic also displays it.

Leave a Dot is omitted from the launch build entirely. The old loader removed DOM nodes and reloaded after navigation, but that could not guarantee previously loaded script observers stopped before private content rendered. Its obsolete route-loader tests and modules are removed; the browser regression checks marketing-to-sign-in navigation and records any widget request. Public Google Analytics remains behind its existing route allowlist and kill switch.

Validation: 121 unit files / 1,184 tests pass; six new source/verification checks replace eight obsolete widget-loader tests. TypeScript, changed-file ESLint, production Worker build, database isolation suites and 85 SEO checks pass. Production preview runs 51 browser cases successfully across Chromium, Android emulation and iOS WebKit; 12 credential-gated cases skip. The verifier accepts the built preview and rejects the current hosted site for its missing source digest. All browser tracker requests are blocked; no production analytics hits are sent.

No hosted deployment or provider setting change occurred. Lovable Visitor analytics still injects `~flock.js` on private-route HTML; a publish alone does not disable it. GA enhanced-measurement history events still need provider verification. Production migration/history coordination is tracked in [the annotation continuation report](readiness-2026-10-12.md) and draft PR #214. Credential-dependent portal, inbox, billing, Clio and physical-device checks remain open as recorded in [the October 11 report](readiness-2026-10-11.md).
