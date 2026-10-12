import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { mockSignedInSurvivor, waitForAppShell } from "./fixtures/mock-survivor";

/**
 * Phones 320–430px (widths 320/360/375/390/412/414): the page must never be wider than the screen, and Quick Exit must be fully on
 * screen with a >=44px target. Public pages run as-is. Signed-in survivor pages run with a MOCKED
 * session (e2e/fixtures/mock-survivor.ts): layout only, no backend, NOT a real signed-in test.
 *
 * Runs once per engine: desktop-chromium (Chromium, isMobile) and mobile-ios (WebKit).
 */
const WIDTHS = [320, 360, 375, 390, 412, 414] as const;
const PUBLIC = [
  "/",
  "/demo",
  "/pricing",
  "/for-attorneys",
  "/for-organizations",
  "/how-it-works",
  "/safety",
  "/signin",
  "/resources",
  "/support",
];
const SIGNED_IN = ["/dashboard", "/journal", "/timeline"];

test.beforeEach(({ browserName }, info) => {
  test.skip(
    info.project.name === "mobile-android" || browserName === "firefox",
    "chromium + webkit only",
  );
});

async function phone(browser: Browser, width: number, height = 800): Promise<BrowserContext> {
  return browser.newContext({
    viewport: { width, height },
    isMobile: browser.browserType().name() !== "firefox",
    hasTouch: true,
    deviceScaleFactor: 2,
    // Requests made by a service worker bypass Playwright routing; block it so every Supabase /
    // server-function call is guaranteed to hit the local mocks.
    serviceWorkers: "block",
  });
}

async function measure(page: Page, exitSelector: string) {
  return page.evaluate((sel) => {
    const de = document.documentElement;
    const exits = [...document.querySelectorAll<HTMLElement>(sel)]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }));
    const vv = window.visualViewport;
    return {
      innerWidth: window.innerWidth,
      scrollWidth: de.scrollWidth,
      vvWidth: vv ? vv.width : window.innerWidth,
      vvHeight: vv ? vv.height : window.innerHeight,
      exits,
    };
  }, exitSelector);
}

function assertFits(m: Awaited<ReturnType<typeof measure>>, width: number, label: string) {
  expect(m.scrollWidth, `${label}: document scrollWidth`).toBeLessThanOrEqual(width);
  expect(m.innerWidth, `${label}: layout viewport grew`).toBeLessThanOrEqual(width);
  expect(m.exits.length, `${label}: an Exit control is rendered`).toBeGreaterThan(0);
  const e = m.exits[0]!;
  expect(e.x, `${label}: exit left`).toBeGreaterThanOrEqual(0);
  expect(e.y, `${label}: exit top`).toBeGreaterThanOrEqual(0);
  expect(e.right, `${label}: exit right`).toBeLessThanOrEqual(Math.min(width, m.vvWidth));
  expect(e.bottom, `${label}: exit bottom`).toBeLessThanOrEqual(m.vvHeight);
  expect(e.h, `${label}: exit tap height`).toBeGreaterThanOrEqual(44);
  expect(e.w, `${label}: exit tap width`).toBeGreaterThanOrEqual(44);
}

for (const width of WIDTHS) {
  test(`public pages fit a ${width}px phone and keep Exit on screen`, async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await phone(browser, width);
    const page = await ctx.newPage();
    for (const path of PUBLIC) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page
        .locator("[data-quick-exit]")
        .first()
        .waitFor({ state: "visible", timeout: 45_000 });
      await page.waitForTimeout(300);
      assertFits(await measure(page, "[data-quick-exit]"), width, `${path}@${width}`);
      // Still on screen after scrolling (sticky public header).
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(200);
      assertFits(await measure(page, "[data-quick-exit]"), width, `${path}@${width} scrolled`);
    }
    await ctx.close();
  });

  for (const path of SIGNED_IN) {
    test(`signed-in ${path} (mocked session) fits a ${width}px phone`, async ({ browser }) => {
      // Fresh context per route: the mocked session is seeded per context.
      const ctx = await phone(browser, width);
      await mockSignedInSurvivor(ctx);
      const page = await ctx.newPage();
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await waitForAppShell(page);
      await page.waitForTimeout(1200); // mocked rows render
      assertFits(await measure(page, '[aria-label="Quick exit"]'), width, `${path}@${width}`);
      await ctx.close();
    });
  }
}

test("a remembered Exit position from a wider screen is pulled back on screen", async ({
  browser,
}) => {
  const ctx = await phone(browser, 320);
  await mockSignedInSurvivor(ctx);
  await ctx.addInitScript(() =>
    localStorage.setItem("pp.exit.pos", JSON.stringify({ left: 900, top: 2000 })),
  );
  const page = await ctx.newPage();
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await waitForAppShell(page);
  await page.waitForTimeout(500);
  assertFits(await measure(page, '[aria-label="Quick exit"]'), 320, "dragged@320");
  await ctx.close();
});

test("entry form: Save privately stays visible above the tab bar at 390x450", async ({
  browser,
}) => {
  const ctx = await phone(browser, 390, 450);
  await mockSignedInSurvivor(ctx);
  const page = await ctx.newPage();
  await page.goto("/journal", { waitUntil: "domcontentloaded" });
  await waitForAppShell(page);
  await page
    .getByRole("button", { name: /add an entry/i })
    .first()
    .click();
  const what = page.locator("#entry-what");
  await what.waitFor({ state: "visible" });
  await what.scrollIntoViewIfNeeded();
  await what.click();
  await what.pressSequentially("He was waiting outside again.");
  await page.waitForTimeout(400);

  const save = page
    .getByTestId("journal-save-bar")
    .getByRole("button", { name: /save privately/i });
  const box = await save.boundingBox();
  const bar = await page.locator(".pp-bottom-tab-bar").boundingBox();
  expect(box, "save button rendered").not.toBeNull();
  expect(bar, "tab bar rendered").not.toBeNull();
  // On screen…
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(450);
  // …and not under the tab bar.
  expect(box!.y + box!.height).toBeLessThanOrEqual(bar!.y);
  // The tab bar is not on top of it at its centre point.
  const hit = await page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return !!el?.closest('[data-testid="journal-save-bar"]');
    },
    { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
  );
  expect(hit, "save button is the top element at its centre").toBe(true);

  // Simulated on-screen keyboard (iOS: layout viewport does not shrink). The bar must ride above it.
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--pp-kb-inset", "260px");
    document.documentElement.setAttribute("data-pp-kb", "1");
  });
  await page.waitForTimeout(150);
  const withKb = await save.boundingBox();
  expect(withKb, "save still rendered with keyboard").not.toBeNull();
  expect(withKb!.y + withKb!.height).toBeLessThanOrEqual(450 - 260 + 1);
  expect(withKb!.y).toBeGreaterThanOrEqual(0);
  await ctx.close();
});

test("Quick Exit in a real browser wipes app storage, IndexedDB and caches", async ({
  browser,
  baseURL,
}) => {
  const ctx = await phone(browser, 390);
  // The exit destination is answered locally; nothing leaves the machine.
  await ctx.route(/weather\.com/, (r) =>
    r.fulfill({ contentType: "text/html", body: "<title>Weather</title>ok" }),
  );
  const page = await ctx.newPage();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => (window as unknown as { __ppQuickExitHydrated?: boolean }).__ppQuickExitHydrated === true,
    undefined,
    { timeout: 45_000 },
  );
  await page.evaluate(async () => {
    const local = [
      "pp_settings_v1",
      "pp.settings.account.v2",
      "pp.exit.pos",
      "pp.mic.pos",
      "pp_record_warned",
      "pp.attorney.lastOpened",
      "pp_settings_v1:3f1c2a9e-1111-4222-8333-444455556666",
      "sb-muyfixture-auth-token",
      "sb-muyfixture-auth-token-code-verifier",
    ];
    const session = [
      "pp_oauth_return",
      "pp_return_to",
      "pp_password_recovery",
      "pp_unlock_token_v2",
      "pp.team_invite",
      "pp.att.security_dismissed",
      "pp.prep.county",
      "pp.prep.court_branch",
      "pp.prep.intake_draft",
      "pp.prep.quiet_tab",
      "pp.prep.safety_copy",
      "patternproof-team-invite",
      "att-security-dismissed",
    ];
    for (const k of local) localStorage.setItem(k, "x");
    for (const k of session) sessionStorage.setItem(k, "x");
    await new Promise<void>((res, rej) => {
      const req = indexedDB.open("pp-intake", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("queued-files", { keyPath: "id" });
      req.onsuccess = () => {
        req.result.close();
        res();
      };
      req.onerror = () => rej(req.error);
    });
    if ("caches" in window)
      await (
        await caches.open("patternproof-v7-prep-no-store")
      ).put("/e2e-probe", new Response("x"));
  });

  await page
    .getByRole("button", { name: /(quick exit|exit safely)/i })
    .first()
    .click();
  await page.waitForURL(/weather\.com/, { timeout: 30_000 });

  // Synchronous part: nothing of ours left in localStorage the moment she is on the exit page
  // (checked from a static file on our origin, so no app code runs).
  const check = await ctx.newPage();
  await check.goto(`${baseURL}/version.json`);
  const lsRightAfter = await check.evaluate(() =>
    Object.keys(localStorage).filter(
      (k) => /^(pp[._-]|patternproof|att-|sb-|supabase\.auth\.)/.test(k) && k !== "pp_wipe_pending",
    ),
  );
  expect(lsRightAfter).toEqual([]);
  // Async part (IndexedDB / Cache Storage) is not guaranteed to finish before navigation; the
  // pending marker makes the next app open finish it. Open the app once, then check everything.
  await check.goto(`${baseURL}/`, { waitUntil: "domcontentloaded" });
  await check.waitForTimeout(2500);
  const left = await check.evaluate(async () => {
    const owned = (k: string) => /^(pp[._-]|patternproof|att-|sb-|supabase\.auth\.)/.test(k);
    // #203's pending-wipe marker ("1", no identifier) may outlive the page; it is cleared once the
    // pp-intake database is confirmed gone (dbs below must be empty either way).
    const ls = Object.keys(localStorage).filter((k) => owned(k) && k !== "pp_wipe_pending");
    const dbs = indexedDB.databases
      ? (await indexedDB.databases()).map((d) => d.name).filter((n) => n && owned(n))
      : ["(databases() unsupported)"];
    const cs =
      "caches" in window ? (await caches.keys()).filter((n) => n.startsWith("patternproof-")) : [];
    return { ls, dbs, cs };
  });
  expect(left.ls).toEqual([]);
  expect(left.cs).toEqual([]);
  if (!left.dbs.includes("(databases() unsupported)")) expect(left.dbs).toEqual([]);
  await ctx.close();
});
