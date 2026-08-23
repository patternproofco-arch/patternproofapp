// Shared mock-session helpers for Playwright QA against PatternProof.
//
// The real Supabase backend isn't reachable from every environment this
// might run in (in particular, sandboxed agent sessions with restricted
// egress) — this module fakes a logged-in client-side session and
// intercepts every network call the app would otherwise make to Supabase,
// so authenticated pages render their real component tree against fake
// data instead of redirecting to sign-in or hanging on a blocked request.
//
// Three layers are faked:
//  1. A Supabase auth session, seeded into localStorage before any app JS
//     runs (matching @supabase/supabase-js's default storage key format).
//  2. Supabase REST/Auth/Realtime calls the browser makes directly.
//  3. TanStack Start server functions (/_serverFn/**) — these run on the
//     dev server's own Node process, which itself can't reach a blocked
//     Supabase host either, so they're intercepted at the browser/network
//     layer the same way REST calls are.
//
// See scripts/qa/README.md for setup (Playwright isn't a project
// dependency) and scripts/qa/shot.mjs for a runnable example.

import { toCrossJSONAsync } from "seroval";

const PROJECT_REF = (process.env.VITE_SUPABASE_URL || "https://muynotmkcmehxnkhffzl.supabase.co")
  .replace(/^https?:\/\//, "")
  .split(".")[0];
const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function fakeUser(overrides = {}) {
  const id = overrides.id || "00000000-0000-4000-8000-000000000001";
  const email = overrides.email || "qa-fixture@example.com";
  const now = new Date().toISOString();
  return {
    id,
    aud: "authenticated",
    role: "authenticated",
    email,
    email_confirmed_at: now,
    phone: "",
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: { provider: "email", providers: ["email"] },
    // Skips the onboarding redirect — _authenticated.tsx sends any user
    // without this flag straight to /onboarding regardless of what page
    // was requested.
    user_metadata: { onboarding_complete: true },
    identities: [],
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

export function fakeSession(user) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365; // 1yr out, no refresh needed
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    aud: "authenticated",
    exp,
    sub: user.id,
    email: user.email,
    role: "authenticated",
  };
  const access_token = `${b64url(header)}.${b64url(payload)}.fixture-signature`;
  return {
    access_token,
    token_type: "bearer",
    expires_in: exp - Math.floor(Date.now() / 1000),
    expires_at: exp,
    refresh_token: "fixture-refresh-token",
    user,
  };
}

/** Seed localStorage with a fake Supabase session before any app JS runs. */
export async function seedAuth(page, user = fakeUser()) {
  const session = fakeSession(user);
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, JSON.stringify(value)),
    [STORAGE_KEY, session],
  );
  return { user, session };
}

/** Intercept Supabase REST + Auth + Realtime calls so the app never tries
 *  the real (blocked) backend directly from the browser. `handlers` lets a
 *  caller override specific REST tables by name; everything else gets a
 *  safe empty-array/empty-object default (GET → [], everything else → {}). */
export async function mockSupabaseNetwork(page, { session, handlers = {} } = {}) {
  await page.route("**/auth/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/user")) return route.fulfill({ status: 200, json: session.user });
    if (url.pathname.includes("/token")) return route.fulfill({ status: 200, json: session });
    return route.fulfill({ status: 200, json: {} });
  });

  await page.route("**/rest/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const table = url.pathname.split("/").pop() || "";
    if (handlers[table]) return handlers[table](route, url);
    if (req.method() === "GET") return route.fulfill({ status: 200, json: [] });
    return route.fulfill({ status: 200, json: {} });
  });

  // Realtime websockets just hang retrying against the blocked host
  // otherwise — abort them outright.
  await page.route("**/realtime/v1/**", (route) => route.abort());
}

/** Gatekeeper server-fn responses per persona — the small set of role/
 *  subscription checks that decide whether a portal layout even renders
 *  its children, vs. redirecting away (e.g. the attorney portal's paywall
 *  gate, or the advocate role check). Page-level data-fetching functions
 *  aren't all covered here; unlisted ones fall back to an empty {}
 *  response, which most pages render as their own real empty state — but
 *  some expect a specific shape (e.g. { clients: [] }) and will hit their
 *  error boundary on a bare {}. Add a handler here (or via mockLoggedIn's
 *  serverFnHandlers option) as you discover which ones a given page needs. */
function gatekeeperHandlers(persona) {
  const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();
  return {
    ensureSurvivorRole: () => ({
      roles: [persona],
      is_survivor: persona === "survivor",
      is_org_partner: false,
      created: false,
    }),
    getAppLockState: () => ({ app_lock_enabled: false }),
    getMyRole: () => ({
      role: persona === "attorney" ? "attorney" : "survivor",
      roles: persona === "attorney" ? ["attorney"] : [],
      hasCollaborations: false,
      is_org_partner: false,
    }),
    getAttorneyProfile: () => ({
      profile:
        persona === "attorney"
          ? { onboarded: true, firm_name: "QA Fixture Firm", full_name: "QA Attorney" }
          : null,
    }),
    getMySubscription: () => ({
      subscription:
        persona === "attorney"
          ? {
              status: "active",
              price_id: "price_fixture_solo",
              current_period_end: future,
              cancel_at_period_end: false,
            }
          : null,
    }),
    getMyAdvocateRole: () => ({
      isAdvocate: persona === "advocate",
      profile:
        persona === "advocate"
          ? { full_name: "QA Advocate", org_name: "QA Org", email: "qa-fixture@example.com" }
          : null,
    }),
    // Common page-level list/read endpoints — safe empty defaults so a
    // page's list view renders its real empty state instead of crashing
    // on an unexpected shape. Add more here as new pages get exercised.
    listMyClients: () => ({ clients: [] }),
    listAdvocateClients: () => ({ clients: [] }),
    getClioAvailability: () => ({ available: false, reason: "not_enabled" }),
    getClioStatus: () => ({ connected: false }),
    listClioMatterLinks: () => ({ links: [] }),
    listSurvivorInvites: () => ({ invites: [] }),
    listContentSuggestions: () => ({ suggestions: [] }),
    getDashboardStats: () => ({
      incident_count: 0,
      unconfirmed_ai_count: 0,
      evidence_count: 0,
      uncertain_date_count: 0,
      has_pattern_analysis: false,
      voice_note_count: 0,
      has_case: false,
      upcoming_court_dates: 0,
      ever_had_court_date: false,
      last_activity: null,
      unreviewed_severity_indicator_count: 0,
      contradiction_count: 0,
    }),
  };
}

// TanStack Start server functions don't return plain JSON — successful
// non-streaming responses are `JSON.stringify({ result, error, context })`
// run through seroval's cross-JSON encoding, with an `x-tss-serialized:
// true` header (see @tanstack/start-server-core's
// server-functions-handler.js and start-client-core's
// client-rpc/serverFnFetcher.js). Encode fake return values the same way,
// using the real seroval package the app itself depends on, so the
// client's deserializer accepts them instead of silently resolving to
// `undefined` — which is what a plain-JSON body produces, and at least one
// of the app's server-fn callers (useSubscription) has no .catch() at all,
// so an unrecognized response shape crashes the whole component tree.
async function encodeServerFnResult(value) {
  const node = await toCrossJSONAsync(value, { refs: new Map() });
  return JSON.stringify(node);
}

/** Intercept /_serverFn/** calls. The URL's last path segment is a
 *  base64url-encoded {file, export} descriptor TanStack Start generates —
 *  decode it to find which server function is being called. */
export async function mockServerFunctions(page, { persona = "survivor", handlers = {} } = {}) {
  const all = { ...gatekeeperHandlers(persona), ...handlers };
  await page.route("**/_serverFn/**", async (route) => {
    const url = new URL(route.request().url());
    const seg = decodeURIComponent(url.pathname.split("/").pop() || "");
    let exportName = null;
    try {
      const json = JSON.parse(Buffer.from(seg, "base64url").toString("utf8"));
      exportName = (json.export || "").replace(/_createServerFn_handler$/, "");
    } catch {
      /* not a recognizable descriptor — fall through to the generic default */
    }
    const result = exportName && all[exportName] ? all[exportName]() : {};
    const body = await encodeServerFnResult({ result });
    return route.fulfill({
      status: 200,
      headers: { "content-type": "application/json", "x-tss-serialized": "true" },
      body,
    });
  });
}

/** One-call setup: seed auth + mock Supabase + mock server functions for a
 *  given persona ("survivor" | "attorney" | "advocate"). This is the entry
 *  point most scripts want; call the individual mock* functions directly
 *  only if you need finer control over ordering. */
export async function mockLoggedIn(
  page,
  { persona = "survivor", user: userOverrides = {}, serverFnHandlers = {}, restHandlers = {} } = {},
) {
  const user = fakeUser(userOverrides);
  const { session } = await seedAuth(page, user);
  await mockSupabaseNetwork(page, { session, handlers: restHandlers });
  await mockServerFunctions(page, { persona, handlers: serverFnHandlers });
  return { user, session };
}
