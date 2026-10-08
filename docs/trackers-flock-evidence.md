# Lovable `~flock.js` evidence (Guardian tracker gate)

**Status: NOT VERIFIED in production.** Investigation only — no in-repo config option found that can disable or scope the script to public routes. Action for Grace is a Lovable project setting (below).

## What is injected on the live site

Live HTML on `https://pattern-proof.tech/` and `https://pattern-proof.tech/dashboard` both include:

```html
<script defer src="/~flock.js" data-proxy-url="/~api/analytics"></script>
```

Observed on 2026-10-08 (ET) via `curl` of the published HTML. The same tag appears on a private path (`/dashboard`) as on the marketing home page — injection is not route-scoped.

The script itself (`/~flock.js`, ~21 KB) is Lovable's visitor-analytics client. It:

- Reads `data-proxy-url` / `data-proxy` / `data-host` / `data-token` / `data-domain` / `data-datasource` / `data-storage` / `data-web-vitals` / `tb_*` attributes from `document.currentScript`.
- Sends `page_hit` events (and optional web-vitals) via `XMLHttpRequest` to the proxy URL, including `pathname`, full `href`, `referrer`, `user-agent`, locale/country.
- Hooks `history.pushState` / `popstate` / `hashchange` so SPA navigations are counted.
- Masks a fixed set of keys (`username`, `password`, `email`, `token`, …) in payloads, but **does not strip pathnames or query strings from `href`/`pathname`**.
- Skips collection only when `__nightmare` / `navigator.webdriver` / `Cypress` is present — **no public-route or signed-in opt-out**.

## Where it does *not* come from (in-repo)

| Candidate | Finding |
|---|---|
| `src/routes/__root.tsx` head scripts | No `flock` reference. |
| App `index.html` | TanStack Start — no static index with flock. |
| `@lovable.dev/vite-tanstack-config@2.25.3` | `LovableViteTanstackOptions` in `node_modules/@lovable.dev/vite-tanstack-config/dist/index.d.ts` exposes `nitro`, `tanstackStart`, `react`, `envDefine`, `hmrGate`, `buildExitWatchdog`, `serverFnErrorLogger`, `ssrErrorLogger`, `plugins`, `vite`. **No analytics / flock / visitor-tracking option.** Dist JS has no `flock` / `~api/analytics` string. |
| `lovable-tagger` / componentTagger | Dev-only tagging mentioned in vite config comments; not the published flock script. |
| App source / `public/` | No flock assets checked in. |

**Conclusion (labeled, not guessed):** flock.js is injected by the **Lovable publish / hosting pipeline** for the published deployment, not by an application or vite-plugin option we can flip in this repository.

## Official Lovable docs (exact setting)

- [Project analytics](https://docs.lovable.dev/features/analytics): "Tracking is enabled by default. To disable it, use the Visitor analytics setting in project settings."
- [Project settings → General → Publishing](https://docs.lovable.dev/features/projects/settings): **"Visitor analytics**: Collect visitor data for your published app, which powers the Analytics view in the editor. Enabled by default. When you disable it, Lovable stops collecting and the Analytics view shows no new data."

### Exact recommended action (Grace)

1. Open the PatternProof project in Lovable.
2. **Project settings → General → Publishing → turn off "Visitor analytics".**
3. Confirm after the next publish (or immediately, if Lovable applies without republish) that `/~flock.js` is no longer in the HTML of `/` and of a private route (e.g. `/dashboard` after sign-in), and that `/~api/analytics` is not called.
4. There is **no documented route-scoped** option (public-only). The documented control is on/off for the whole published project.
5. If marketing still needs visit counts, keep GA4 (allowlisted in this PR) and/or Leave a Dot on public paths only — do not leave Lovable Visitor analytics on while private routes exist.

## Out of scope / do not do in this PR

- Do not strip flock with a client-side DOM remover as the primary fix (race: flock fires on load; SPA hooks already wrap history). The sanctioned control is the Lovable setting.
- Do not claim VERIFIED until Verifier re-checks the network panel on a private route after Grace toggles the setting.
