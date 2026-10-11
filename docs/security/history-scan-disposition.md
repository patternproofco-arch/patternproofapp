# Historical secret-scan findings — October 11, 2026

Gitleaks 8.21.2 scanned 2,662 commits before this change and reported ten findings.
Each original line was inspected at its immutable commit. The reviewed findings
are public identifiers, not privileged credentials:

| Commit                                     | File and lines                         | Classification                               |
| ------------------------------------------ | -------------------------------------- | -------------------------------------------- |
| `b0fe38c7cbf427078325e0f34db09850a230b81c` | `src/lib/attorney-offer.ts:9,18,27,36` | Four Stripe plan lookup identifiers          |
| `a3d6d997c5f08120011fb13cf2db883020ed8fd3` | `vite.config.ts:62`                    | Supabase JWT; decoded payload role is `anon` |
| `a7a4c8bec92b17c44145e2076f4e1e8549933edb` | `.env.production:1`                    | Stripe publishable key (`pk_live_`)          |
| `94ff1913456636fa8ab69b14b891612b0a3a27b1` | `.env:4`                               | Supabase publishable key (`sb_publishable_`) |
| `65b592ef24f24bd41ed43004a614b22c58ac565e` | `.env:4`                               | Supabase publishable key (`sb_publishable_`) |
| `746c381363bfd3497c65945d90ef9e0055fcf560` | `.env.production:1`                    | Stripe publishable key (`pk_live_`)          |
| `5ed1fd69e4041cf56aed8f9639fab886d9a18788` | `.env.development:1`                   | Stripe publishable key (`pk_test_`)          |

`.gitleaksignore` contains only these ten exact commit/path/rule/line fingerprints.
No rule, file, key family, or future commit is exempted. The existing tip checks
for anonymous-role JWTs and the allowed browser environment variables remain in
place. No Git history was rewritten and no credential values are recorded here.

The full history rescan reports no findings. This disposes of these scanner
false positives; it does not attest to provider configuration, past credential
rotation, or secrets outside the repository. Any privileged credential finding
still requires rotation and the process in SECURITY.md.
