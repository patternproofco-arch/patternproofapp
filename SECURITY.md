# SECURITY.md — PatternProof

## Overview

PatternProof handles sensitive documentation for survivors of domestic violence, coercive control, and post-separation abuse. Security is not a checkbox — it is a core requirement of this platform. This document defines our vulnerability management process, remediation timelines, and security practices.

---

## Reporting a Vulnerability

If you discover a security vulnerability in PatternProof, please report it responsibly.

**Contact:** gracieburns200@gmail.com  
**Subject line:** `[SECURITY] Vulnerability Report — PatternProof`

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested remediation (optional)

We will acknowledge your report within 48 hours and provide a remediation timeline within 5 business days.

**Please do not publicly disclose the vulnerability until we have confirmed a fix is in place.**

---

## Severity-Based Remediation Timelines

| Severity | Definition | Target Remediation |
|----------|------------|-------------------|
| **Critical** | Active exploit, data breach, auth bypass, exposed secrets | Immediate — within 24 hours |
| **High** | Significant risk to user data or platform integrity | Within 48 hours |
| **Medium** | Limited impact, no active exploit, mitigations possible | Within 7 business days |
| **Low** | Minimal risk, informational, hardening improvements | Within 30 days |

These timelines apply to both externally reported vulnerabilities and internally detected issues.

---

## Dependency Vulnerability Management

### Scanning

This project uses **Bun** as the package manager. Run dependency audits with:

```bash
# Check for known vulnerabilities in dependencies
bun audit

# If npm audit is preferred (works on package-lock.json):
npm audit

# For detailed output:
npm audit --json
```

### When to Run

- Before every production deployment
- Weekly as part of routine maintenance
- Immediately when a CVE is announced affecting any dependency in `package.json`

### Key Dependencies to Monitor

Given the sensitivity of this platform, pay particular attention to vulnerabilities in:
- `@supabase/supabase-js` — database and auth
- `@stripe/stripe-js` / `stripe` — payment processing
- `react` / `react-dom` — frontend framework
- `@tanstack/react-router` / `@tanstack/react-start` — routing
- `jszip` — file processing (common CVE target)
- `ai` / `@ai-sdk/*` — AI processing
- `vite` — build tool (supply chain risk)
- Any package that touches file upload or parsing

---

## Dependabot / Automated Alerts

If this project is connected to GitHub:

1. Enable **Dependabot alerts** in the repository Settings → Security → Code security and analysis
2. Enable **Dependabot security updates** to auto-create PRs for vulnerable dependencies
3. Enable **Secret scanning** to catch accidentally committed credentials
4. Review Dependabot PRs within the remediation timelines above — do not let them accumulate

If GitHub is not connected, subscribe to security advisories manually:
- [GitHub Advisory Database](https://github.com/advisories)
- [npm Security Advisories](https://www.npmjs.com/advisories)

---

## Vulnerability Log

Track all identified vulnerabilities and their resolution here. Add a new entry for each issue.

| Date | Severity | Package / Component | CVE / Description | Status | Resolved Date |
|------|----------|---------------------|-------------------|--------|---------------|
| — | — | — | No vulnerabilities logged yet | — | — |

**How to log:** When a vulnerability is identified (via audit, Dependabot, or report), add a row immediately — even before it is resolved. Update the Status column as work progresses: `Identified → In Progress → Resolved`.

---

## Standard Package Update Workflow

Follow this process when updating dependencies, especially security patches:

1. **Check the audit** — run `bun audit` or `npm audit` to see current issues
2. **Review the changelog** — before updating any package, read the release notes for breaking changes
3. **Update in a branch** — never update dependencies directly on main/production
4. **Test locally** — run the full app locally and verify core flows work:
   - Sign in / PIN entry
   - Incident logging
   - Evidence upload
   - Export / case packet generation
   - Stripe payment flow (use test mode)
5. **Deploy to preview** — verify on the Lovable preview URL before publishing
6. **Merge and deploy** — only after preview passes

For **critical/high severity patches**, the test cycle above is still required — but completed within the 24–48 hour window. Do not skip testing even under time pressure.

---

## Security Checklist

Run this checklist before each production deployment:

### Dependency Scanning
- [ ] Run `bun audit` — no critical or high vulnerabilities outstanding
- [ ] Dependabot alerts reviewed (if GitHub connected)
- [ ] No new packages added without vetting the publisher and download count

### Supabase
- [ ] Supabase dashboard checked for security alerts or warnings
- [ ] Row Level Security (RLS) enabled on all tables containing user data
- [ ] No public Supabase tables that should be private
- [ ] Supabase service role key is NOT exposed in client-side code
- [ ] Auth settings reviewed — email confirmation enabled, weak password protection on

### Hosting / Lovable / Cloudflare
- [ ] No secrets or API keys committed to the repository
- [ ] Environment variables set in Lovable/Cloudflare dashboard, not in code
- [ ] Preview deployments are not publicly indexed (check robots.txt)
- [ ] HTTPS enforced — no mixed content warnings

### Stripe
- [ ] Live Stripe keys are NOT in any client-side code
- [ ] Test mode keys are not deployed to production
- [ ] Stripe webhook signature verification is implemented

### Vendor Security Notifications
- [ ] Check email (gracieburns200@gmail.com) for security notices from:
  - Lovable
  - Supabase
  - Stripe
  - Anthropic / OpenAI
  - Cloudflare
- [ ] Any vendor security notices actioned or scheduled

### Critical / High Vulnerability Patching
- [ ] All Critical CVEs resolved before this deployment
- [ ] All High CVEs resolved or a written exception logged in the Vulnerability Log above
- [ ] Exception rationale documented if a High CVE is being deferred

### Pre-Deployment Testing
- [ ] Sign in / PIN works
- [ ] Incident log creates and saves correctly
- [ ] Evidence upload functions (photo, PDF, message export)
- [ ] Export / ZIP download works
- [ ] Stripe test payment completes (if payment flow changed)
- [ ] Privacy Policy page is publicly accessible at /privacy
- [ ] No console errors in production build

---

## Secrets Management

**Never commit the following to the repository:**
- Supabase service role key
- Stripe secret key (live or test)
- Any API key for Anthropic, OpenAI, or other AI providers
- Any third-party OAuth secrets

All secrets must be stored in:
- Lovable environment variables (for Lovable-hosted builds)
- Cloudflare environment variables / secrets (for Cloudflare Workers/Pages)

If a secret is accidentally committed, rotate it immediately — do not just delete the commit.

---

## Contact

Security contact: Grace Burns — gracieburns200@gmail.com  
Response time: 48 hours for acknowledgment, 5 business days for remediation plan.
## Breach / Security Incident Response

This is separate from the vulnerability-remediation SLAs above.

If we become aware of a security incident affecting user data, we:

1. Investigate and contain the issue, and revoke any credentials involved.
2. Preserve relevant logs and evidence before remediation where possible.
3. Assess what data and which users are affected.
4. Notify affected users and any regulators or authorities as required by
   applicable law, with what we know and what we are still determining.
5. Publish a remediation summary once the issue is resolved.

We do not commit to a fixed notification deadline beyond what applicable law
requires.
