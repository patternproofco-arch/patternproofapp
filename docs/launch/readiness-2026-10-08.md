# Launch readiness — October 8, 2026

Status: **launch remains blocked**. The local code checks below pass; authenticated
production journeys and release controls are not certified by this pass.

Initial repository baseline: `10cd3ac25d81cad5ec2f314f09c67d336020e6b9` on `main`.
The `codex/launch-readiness` review branch was rebased onto current `main` on
October 10. GitHub authentication and repository push permission are now verified.
The outstanding release checks below remain required.

## Changes prepared

- Guard the server environment fallback in the browser Supabase configuration
  reader. Missing browser configuration previously accessed `process.env` even
  when `process` did not exist, throwing before the configuration recovery UI
  could render. Five new tests exercise incomplete and complete browser values
  in an isolated JavaScript context and preserve the SSR fallback.
- Require patched versions of the MCP SDK, proxy-addr, sharp, source-map-js and
  shell-quote through the existing npm overrides and Bun resolutions. Both
  lockfiles are updated. The npm audit now reports zero vulnerabilities,
  including development dependencies. The existing Lovable, TanStack and
  Cloudflare package versions are retained.
- Replace the broken `vite preview` script with local Wrangler using the generated
  `.output/server/wrangler.json` configuration. The former
  returned HTTP 500 because it looked for nonexistent `dist/server/server.js`;
  Wrangler previews the actual Cloudflare output. Nitro's beta preview wrapper
  crashed when the browser runner polled it before initialization; calling
  Wrangler directly avoids that startup race.
- Run the Launch Readiness browser suite against that production bundle in CI
  using `E2E_PREVIEW=1`. The default developer browser suite still uses the dev
  server. A preview run refuses to reuse a running dev server.

## Executed checks

| Check                                                   | Result                               |
| ------------------------------------------------------- | ------------------------------------ |
| `npm ci --no-fund --no-audit` with the updated lockfile | Pass                                 |
| `npm test -- --reporter=dot`                            | 1,060 passed, 100 files              |
| `npx tsc --noEmit`                                      | Pass                                 |
| `NODE_OPTIONS=--max-old-space-size=4096 npm run build`  | Pass                                 |
| `npm run seo:check`                                     | 85 passed                            |
| `npm audit --audit-level=high`                          | Zero vulnerabilities                 |
| Bun 1.3.14 frozen lockfile validation                   | Pass                                 |
| Public browser suite against dev server                 | 24 passed, 12 credential-gated skips |
| Public browser suite against built Cloudflare Worker    | 24 passed, 12 credential-gated skips |
| Changed TypeScript files: ESLint and Prettier           | Pass                                 |
| `git diff --check`                                      | Pass                                 |

Browser coverage is desktop Chromium, Pixel 7 Chromium emulation and iPhone 14
WebKit emulation. The sandbox lacked WebKit system libraries; Debian libraries
were extracted locally, and the cached browser launcher was adjusted to retain
their library path. Host-library preflight was skipped after verifying the
actual browser launches. These environment adjustments are not repository
changes; CI installs browser dependencies normally. No physical phone was used.

## Published build observation

A read-only request to `https://pattern-proof.tech/version.json` returned:

- Commit: `932efb3831aa1d4f400dd7fe84bb51f3c4201724`
- Build ID: `25164bf82d38`
- Built at: `2026-10-08T12:27:58.582Z`

This predates the inspected `main` commit and its merged launch batch 1 (#203).
It also does not contain this working branch. Publication has not been performed.
The local built-bundle tests above do not prove the published database, auth,
email, billing or storage configuration.

On October 10, a second read-only request returned commit
`10cd3ac25d81cad5ec2f314f09c67d336020e6b9`, build ID `6d851abbba7c`, built at
`2026-10-08T15:03:59.645Z`. Launch batch 1 is now published, but the site still
predates current `main` (`964ab2aeda7d6641a1e1ce70336a82404649b693`) and does not
contain this branch's fixes.

## Remaining work

1. Obtain and review the repository CI results for the current review branch.
2. Review the existing release candidates before assembling a release. Open
   proposals observed include [large-upload preservation (#204)](https://github.com/patternproofco-arch/patternproofapp/pull/204),
   [tracker isolation (#201)](https://github.com/patternproofco-arch/patternproofapp/pull/201),
   [subscription link lifecycle (#198)](https://github.com/patternproofco-arch/patternproofapp/pull/198),
   [client-side link update restrictions (#197)](https://github.com/patternproofco-arch/patternproofapp/pull/197),
   and the [release control candidate (#181)](https://github.com/patternproofco-arch/patternproofapp/pull/181).
   Their proposals are not proof of deployed protection. No candidate was merged
   or copied into this branch.
3. Close the outstanding controls documented in #181: existing OAuth token
   access, professional verification/suspension, processing consent and provider
   terms, original-file round trips, policy review and historical credential
   finding disposition. This pass did not independently reverify its database
   or legal findings.
4. Run deployed synthetic account checks using fictional Survivor A, Survivor B,
   Attorney, Advocate and Organization accounts. The 12 skipped portal tests
   require `E2E_*` credentials. Prove sharing selection, cross-account denial,
   expiry, revocation, direct downloads, exports, recovery, deletion and the
   checkout/webhook lifecycle before accepting real survivor material.
5. Exercise uploads, Quick Exit and recovery on physical iPhone Safari and
   Android Chrome; browser emulation does not certify those device workflows.
6. After release review, publish an identifiable reviewed commit and verify its
   `/version.json`, then repeat the deployed smoke checks.

No production data, database policies or migration state was inspected or changed
in this pass. No email, checkout, merge, deployment or outreach was performed.
