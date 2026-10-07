import { expect, test, type Request } from "@playwright/test";

/**
 * Fictional, no-account demo portals. Signed out (fresh context, no storage):
 * each page renders with the read-only banner, the portal switcher stays under
 * /demo/*, and the page makes no Supabase or server-function requests.
 */
const DEMO_PATHS = ["/demo", "/demo/attorney", "/demo/org", "/demo/prep"] as const;

function isLiveDataRequest(r: Request): boolean {
  try {
    const u = new URL(r.url());
    return u.hostname.endsWith("supabase.co") || u.pathname.includes("/_serverFn");
  } catch {
    return false;
  }
}

for (const path of DEMO_PATHS) {
  test(`demo portal ${path} renders signed-out with no live-data requests`, async ({ page }) => {
    const live: string[] = [];
    page.on("request", (r) => {
      if (isLiveDataRequest(r)) live.push(r.url());
    });
    const res = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByText("DEMO · Fictional · Read-only.").first()).toBeVisible();
    const switcher = page.getByRole("navigation", { name: "Demo portals" });
    await expect(switcher).toBeVisible();
    const hrefs = await switcher
      .locator("a")
      .evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    for (const h of hrefs) expect(h).toMatch(/^\/demo(\/(attorney|org|prep))?$/);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    expect(live).toEqual([]);
    expect(page.url()).toContain(path);
  });
}

async function waitForHydration(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () => (window as unknown as { __ppQuickExitHydrated?: boolean }).__ppQuickExitHydrated === true,
    undefined,
    { timeout: 30_000 },
  );
}

test("demo prep practice shows the practice-only notice and is not saved", async ({ page }) => {
  await page.goto("/demo/prep", { waitUntil: "domcontentloaded" });
  await waitForHydration(page);
  await page.getByRole("button", { name: /^Practice/ }).click();
  await expect(
    page.getByText(
      "Practice only. Don't type real names, addresses, or details. Nothing is saved.",
    ),
  ).toBeVisible();
  const box = page.locator("textarea");
  await expect(box).toHaveAttribute("autocomplete", "off");
  await box.fill("pretend words");
  const stored = await page.evaluate(() => [
    ...Object.keys(window.localStorage),
    ...Object.keys(window.sessionStorage),
  ]);
  expect(stored.filter((k) => /demo|practice/i.test(k))).toEqual([]);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForHydration(page);
  await page.getByRole("button", { name: /^Practice/ }).click();
  await expect(page.locator("textarea")).toHaveValue("");
});
