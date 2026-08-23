# Mocked-session QA harness

Screenshot and click-test authenticated pages (survivor, attorney, advocate
portals) against a running dev server, without needing a real Supabase login
— useful in any environment where the real backend isn't reachable (e.g. a
sandboxed agent session with restricted network egress), or just for fast
local iteration without creating real accounts.

## How it works

`mock-session.mjs` fakes a logged-in session end-to-end:

1. Seeds `localStorage` with a fake Supabase session (matching
   `@supabase/supabase-js`'s storage format) before any app code runs, so
   `useAuth()` sees a signed-in user immediately.
2. Intercepts Supabase REST/Auth/Realtime calls the browser makes directly.
3. Intercepts TanStack Start server functions (`/_serverFn/**`) — these run
   on the dev server's own Node process, which can't reach a blocked
   Supabase host either, so they're faked at the network layer the same way.
   Responses are encoded with the real `seroval` cross-JSON format the
   framework actually uses (plain JSON isn't enough — the client's
   deserializer silently produces `undefined` for a plain-JSON body, and at
   least one caller has no error handling for that).

A handful of "gatekeeper" server functions (role checks, subscription
status) have fixture responses built in per persona, since those are what
decide whether a portal layout renders its children or redirects away.
Everything else defaults to an empty response; add a handler (see
`mockLoggedIn`'s `serverFnHandlers`/`restHandlers` options) for any function
a specific page needs a non-empty shape from.

## Setup

Playwright isn't a project dependency (keeping it out avoids drift in
`bun.lock`, which this sandbox/environment can't regenerate). Install it
once, without touching the lockfile:

```sh
npm install --no-save playwright
```

If Chromium isn't already available to Playwright in your environment, also
run `npx playwright install chromium` (or point `PLAYWRIGHT_BROWSERS_PATH`
at an existing install).

## Usage

```sh
npm install --registry=https://registry.npmjs.org   # if bun install isn't available
npx vite dev --port 4174 --host 127.0.0.1 &

node scripts/qa/shot.mjs survivor /dashboard /tmp/dashboard.png
node scripts/qa/shot.mjs attorney /clients /tmp/clients.png
node scripts/qa/shot.mjs advocate /advocate-cases /tmp/advocate.png
```

Or use `mock-session.mjs` directly in a custom Playwright script for
click-through testing, not just screenshots:

```js
import { chromium } from "playwright";
import { mockLoggedIn } from "./scripts/qa/mock-session.mjs";

const browser = await chromium.launch();
const page = await browser.newPage();
await mockLoggedIn(page, { persona: "attorney" });
await page.goto("http://127.0.0.1:4174/clients");
await page.click("text=Single invite");
// ...assert on the resulting UI
```

## Known limitations

- Coverage of page-level data fetching is incremental — only the functions
  a page has actually been exercised against have fixtures. An unhandled
  server function returns `{}`, which most pages render as their real empty
  state; a page expecting a specific shape may hit its error boundary
  instead. Extend `gatekeeperHandlers` in `mock-session.mjs`, or pass
  `serverFnHandlers`/`restHandlers` to `mockLoggedIn`, as you find gaps.
- This verifies "does the page render and do buttons work client-side," not
  "does a write actually reach production Supabase correctly." That last
  mile still needs either real backend access or a deployed environment.
