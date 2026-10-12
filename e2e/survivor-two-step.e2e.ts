import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * Two-step code screen (/mfa) with MOCKED auth. No real account, no network to
 * Supabase: every /auth/v1 and /rest/v1 call is intercepted. The fake session is
 * an unsigned JWT at aal1 with one verified TOTP factor (enrolled, code not yet entered).
 */
function supabaseUrl(): string {
  const fromEnv = process.env["VITE_SUPABASE_URL"];
  if (fromEnv) return fromEnv;
  const env = readFileSync(".env", "utf8");
  return /VITE_SUPABASE_URL="?([^"\n]+)"?/.exec(env)?.[1] ?? "";
}

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const USER_ID = "00000000-0000-4000-8000-0000000000aa";

async function mockEnrolledAal1(page: Page) {
  const url = supabaseUrl();
  const ref = new URL(url).hostname.split(".")[0];
  const now = Math.floor(Date.now() / 1000);
  const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
    sub: USER_ID,
    role: "authenticated",
    aal: "aal1",
    amr: [{ method: "password", timestamp: now }],
    exp: now + 3600,
    iat: now,
    session_id: "s1",
  })}.sig`;
  const user = {
    id: USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: "fictional-qa@example.invalid",
    app_metadata: {},
    user_metadata: { onboarding_complete: true },
    created_at: new Date().toISOString(),
    factors: [
      {
        id: "factor-1",
        factor_type: "totp",
        status: "verified",
        friendly_name: "Authenticator",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  };
  const session = {
    access_token: token,
    refresh_token: "fake-refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    user,
  };
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
    `sb-${ref}-auth-token`,
    JSON.stringify(session),
  ] as const);
  await page.route(`${url}/auth/v1/**`, (route) => {
    const u = route.request().url();
    if (u.includes("/auth/v1/user")) return route.fulfill({ json: user });
    if (u.includes("/logout")) return route.fulfill({ status: 204, body: "" });
    return route.fulfill({ status: 400, json: { msg: "mocked" } });
  });
  await page.route(`${url}/rest/v1/**`, (route) => route.fulfill({ json: [] }));
  await page.route("https://weather.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<title>Weather</title>neutral page" }),
  );
  return ref;
}

test.describe("survivor two-step code screen (mocked auth)", () => {
  test.skip(!supabaseUrl(), "no Supabase URL configured for the local build");

  test("asks for the code and offers a support path, not SMS", async ({ page }) => {
    await mockEnrolledAal1(page);
    await page.goto("/mfa", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Authenticator code" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByPlaceholder("000000")).toBeVisible();
    await expect(page.getByRole("link", { name: "contact support" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/text you a code|sms/i);
  });

  test("Quick Exit works on the code screen and clears the session", async ({ page, baseURL }) => {
    const ref = await mockEnrolledAal1(page);
    await page.goto("/mfa", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Authenticator code" })).toBeVisible({
      timeout: 30_000,
    });
    const exit = page.locator("[data-quick-exit]").first();
    await expect(exit).toBeVisible();
    await exit.click();
    await page.waitForURL(/weather\.com/, { timeout: 15_000 });
    // Back on our origin, the auth token is gone.
    await page.unroute("https://weather.com/**");
    const leftover = await page
      .context()
      .storageState()
      .then((s) =>
        s.origins
          .filter((o) => o.origin === new URL(baseURL!).origin)
          .flatMap((o) => o.localStorage)
          .filter((e) => e.name === `sb-${ref}-auth-token`),
      );
    expect(leftover).toHaveLength(0);
  });
});
