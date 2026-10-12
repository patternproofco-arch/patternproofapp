import { readFileSync } from "node:fs";
import type { BrowserContext, Page, Route } from "@playwright/test";

/**
 * Signed-in survivor layout WITHOUT real credentials and WITHOUT touching any backend.
 *
 * - Seeds a fictional, unsigned session into the Supabase auth key so supabase-js believes it is
 *   signed in (it does not verify signatures client-side).
 * - Every request to the Supabase host is answered locally (empty rows / the fake user) or aborted.
 * - Every TanStack server function call is answered locally by export name. Nothing reaches the dev
 *   server's handlers, so no production read or write can happen.
 *
 * REQUIRED: create the context with `serviceWorkers: "block"`. In WebKit, requests issued through the
 * app's service worker bypass Playwright routing (observed: rejected 401 reads to the Supabase host
 * with the fake token). `mockSignedInSurvivor` refuses to run otherwise.
 *
 * This proves LAYOUT only (overflow, sticky, Quick Exit position). It is not a sign-in test; real
 * signed-in behaviour still needs Verifier on a fictional account.
 */

export const FAKE_USER_ID = "00000000-0000-4000-8000-00000000e2e0";

function supabaseUrl(): string {
  const fromEnv = process.env["VITE_SUPABASE_URL"];
  if (fromEnv) return fromEnv;
  try {
    const env = readFileSync(new URL("../../.env", import.meta.url), "utf8");
    const m = /^VITE_SUPABASE_URL=["']?([^"'\n]+)/m.exec(env);
    if (m?.[1]) return m[1].trim();
  } catch {
    /* no .env */
  }
  return "https://example.supabase.co";
}

function b64url(v: unknown): string {
  return Buffer.from(JSON.stringify(v)).toString("base64url");
}

export function fakeSession() {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;
  const user = {
    id: FAKE_USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: "layout-fixture@example.invalid",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { onboarding_complete: true, state: "NJ" },
    factors: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
  const access_token = [
    b64url({ alg: "HS256", typ: "JWT" }),
    b64url({
      sub: FAKE_USER_ID,
      aud: "authenticated",
      role: "authenticated",
      aal: "aal1",
      amr: [{ method: "password", timestamp: now }],
      session_id: "00000000-0000-4000-8000-0000000000aa",
      exp,
      iat: now,
    }),
    "fixture-not-a-real-signature",
  ].join(".");
  return {
    access_token,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: exp,
    refresh_token: "fixture-refresh",
    user,
  };
}

/** Long, unbroken labels — the shape that pushed /dashboard to 788px on Pixel 7. */
const LONG =
  "Picked the kids up at 6:40pm and he was already in the driveway shouting about the schedule again and";
const ROWS = Array.from({ length: 6 }, (_, i) => ({
  id: `00000000-0000-4000-8000-0000000001${String(i).padStart(2, "0")}`,
  date: "2026-09-1" + (i % 9),
  description: `${LONG} ${i}`,
  title: `Screenshot_2026-09-1${i}_at_10.42.11_PM_text_thread_export_${"x".repeat(40)}.png`,
  created_at: `2026-09-1${i % 9}T12:00:00Z`,
  date_precision: "exact",
  date_range_start: null,
  date_range_end: null,
  anchor_label: null,
  abuse_types: ["verbal"],
  location: "Parking lot behind the elementary school on the corner of Main",
  source: "manual",
  confirmed_at: `2026-09-1${i % 9}T12:00:00Z`,
  anchor_incident_id: null,
  time: "18:40",
  witnesses: null,
  emotional_impact: null,
  share_readiness: null,
  deleted_at: null,
}));

/** Answers per server-function export name. Unknown functions get `null`. */
const SERVER_FN_ANSWERS: Record<string, unknown> = {
  ensureSurvivorRole: { roles: ["survivor"], is_survivor: true, is_org_partner: false },
  getPinLockState: {
    app_lock_enabled: false,
    has_pin: false,
    biometric_enabled: false,
  },
  getDashboardStats: {
    incident_count: 6,
    evidence_count: 6,
    voice_note_count: 0,
    unconfirmed_ai_count: 0,
    has_case: false,
  },
};

function serverFnName(url: string): string {
  // Dev ids are base64url JSON {file, export}; production ids are hashes. Match either way.
  const id = decodeURIComponent(new URL(url).pathname.split("/_serverFn/")[1] ?? "");
  try {
    const decoded = Buffer.from(id, "base64url").toString("utf8");
    const m = /"export"\s*:\s*"([A-Za-z0-9_$]+?)(?:_createServerFn_handler)?"/.exec(decoded);
    if (m?.[1]) return m[1];
  } catch {
    /* not base64 */
  }
  return id;
}

export const unknownServerFns = new Set<string>();

export async function mockSignedInSurvivor(context: BrowserContext): Promise<void> {
  const opts = (context as unknown as { _options?: { serviceWorkers?: string } })._options;
  if (opts && opts.serviceWorkers !== "block") {
    throw new Error('mockSignedInSurvivor: create the context with serviceWorkers: "block"');
  }
  const base = supabaseUrl();
  const host = new URL(base).hostname;
  const storageKey = `sb-${host.split(".")[0]}-auth-token`;
  const session = fakeSession();

  await context.addInitScript(
    ([key, value]) => {
      try {
        if (!window.sessionStorage.getItem("__e2e_seeded")) {
          window.localStorage.setItem(key, value);
          window.sessionStorage.setItem("__e2e_seeded", "1");
        }
      } catch {
        /* ignore */
      }
    },
    [storageKey, JSON.stringify(session)] as const,
  );

  // Supabase: answer locally, never forward.
  await context.route(
    (url) => url.hostname === host,
    async (route: Route) => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith("/auth/v1/user")) {
        return route.fulfill({ json: session.user });
      }
      if (url.pathname.startsWith("/auth/v1/logout")) {
        return route.fulfill({ status: 204, body: "" });
      }
      if (url.pathname.startsWith("/rest/v1/")) {
        const table = url.pathname.split("/rest/v1/")[1] ?? "";
        const rows = ["incidents", "evidence"].includes(table) ? ROWS : [];
        return route.fulfill({
          json: rows,
          headers: { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
        });
      }
      return route.abort();
    },
  );

  // Server functions: answer locally by export name.
  await context.route("**/_serverFn/**", async (route: Route) => {
    const name = serverFnName(route.request().url());
    if (!(name in SERVER_FN_ANSWERS)) unknownServerFns.add(name);
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      // Plain-JSON (non-seroval) envelope the client RPC accepts: { result, context }.
      body: JSON.stringify({ result: SERVER_FN_ANSWERS[name] ?? null, context: {} }),
    });
  });
}

export async function waitForAppShell(page: Page): Promise<void> {
  await page.locator(".pp-app-shell").first().waitFor({ state: "visible", timeout: 45_000 });
  await page.locator('[aria-label="Quick exit"]').first().waitFor({ state: "visible", timeout: 15_000 });
}
