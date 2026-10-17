import { expect, test, type Page } from "@playwright/test";
// @ts-expect-error JavaScript QA helper has no declaration file.
import { mockLoggedIn } from "../scripts/qa/mock-session.mjs";

test.use({ serviceWorkers: "block", viewport: { width: 390, height: 844 }, hasTouch: true });

const SHOTS = process.env.HOME_GUIDE_SHOTS;

function stats(over: Record<string, unknown>) {
  return {
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
    ...over,
  };
}

const LISTS = {
  listProposedIncidents: () => [],
  findCrossReferences: () => ({ clusters: [] }),
  listPendingAdvocateInvitesForMe: () => ({ invites: [] }),
  listPendingAttorneyInvitesForMe: () => ({ invites: [] }),
  listMyAdvocateAccess: () => ({ links: [] }),
  listMyAccessAudit: () => ({ events: [] }),
  listUnseenConnections: () => [],
  getAssistantAccess: () => ({ on: false, hasPassword: true }),
  listMyOauthConsents: () => [],
  listMyAttorneyCaseNotes: () => [],
  acknowledgeConnections: () => ({ ok: true }),
};

async function setup(page: Page, s: () => Record<string, unknown>, init?: () => void) {
  await mockLoggedIn(page, {
    persona: "survivor",
    serverFnHandlers: { ...LISTS, getDashboardStats: () => stats(s()) },
    // Home reads her newest Note's created_at (memory only) to see a Note was saved.
    restHandlers: {
      incidents: (route: import("@playwright/test").Route) =>
        route.fulfill({
          status: 200,
          headers: {
            "access-control-allow-origin": route.request().headers().origin || "*",
          },
          json:
            Number(s().incident_count ?? 0) > 0
              ? [{ id: "n1", date: null, description: "x", created_at: new Date().toISOString() }]
              : [],
        }),
    },
  });
  if (init) await page.addInitScript(init);
}

const card = (page: Page) => page.getByTestId("home-guide-card");

async function noBlur(page: Page) {
  const blurred = await page.evaluate(() =>
    Array.from(document.querySelectorAll("body *")).some((el) => {
      const cs = getComputedStyle(el);
      return /blur/.test(cs.filter) || /blur/.test(cs.backdropFilter || "");
    }),
  );
  expect(blurred, "no blur or backdrop-filter in calm view").toBe(false);
}

test("new account sees Add your first Note; after saving a Note the rest card shows; Show everything works", async ({
  page,
}) => {
  let entries = 0;
  await setup(page, () => ({ incident_count: entries }));
  await page.goto("/dashboard");
  await expect(card(page)).toHaveAttribute("data-state", "first-mark");
  await expect(card(page)).toContainText("Add your first Note");
  await expect(page.getByText("Start here", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "See my notes" })).toHaveCount(0);
  await noBlur(page);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/390-first-note.png` });

  await card(page).getByRole("button", { name: "Add a Note" }).click();
  await expect(page).toHaveURL(/\/journal/);
  // The Note is saved (the fixture's stats now report one entry) and she returns Home.
  entries = 1;
  // She returns Home with the Home tab. A second full page load races the move to
  // /journal in WebKit ("interrupted by another navigation"), and Back can restore a
  // frozen page; the tab remounts Home, which re-reads its stats.
  await page.locator("nav[aria-label='Main']").getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(card(page)).toHaveAttribute("data-state", "rest");
  await expect(card(page)).toContainText("That's enough for today.");
  await expect(card(page).getByRole("link", { name: "Add another Note" })).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/390-rest.png` });

  await page.getByRole("button", { name: "Show everything" }).click();
  await expect(page.getByRole("button", { name: "Show less" })).toBeVisible();
  await expect(page.getByRole("link", { name: "See my notes" })).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/390-expanded.png` });
  await page.reload();
  await expect(page.getByRole("link", { name: "See my notes" })).toBeVisible(); // remembered
  await page.getByRole("button", { name: "Show less" }).click();
  await expect(page.getByRole("link", { name: "See my notes" })).toHaveCount(0);
});

test("draft, Not now → default; Quick Exit practice never exits and returns to Home", async ({
  page,
}) => {
  await setup(page, () => ({ incident_count: 2, unconfirmed_ai_count: 1 }));
  await page.goto("/dashboard");
  await expect(card(page)).toHaveAttribute("data-state", "draft");
  await expect(card(page)).toContainText("Look over your draft");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/390-draft.png` });
  await card(page).getByRole("button", { name: "Not now" }).click();
  // Quick Exit not tried yet is the next suggestion, but Not now shows the default.
  await expect(card(page)).toHaveAttribute("data-state", "default");
  await expect(card(page)).toContainText("Add what happened, then rest");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/390-default.png` });
});

test("Quick Exit practice shows what happens and comes back, without leaving", async ({ page }) => {
  await setup(page, () => ({ incident_count: 2 }));
  await page.goto("/dashboard");
  await expect(card(page)).toHaveAttribute("data-state", "quick-exit");
  await card(page).getByRole("button", { name: "Practice Quick Exit" }).click();
  await expect(card(page)).toContainText("Here's what happens");
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByTestId("quick-exit-practice-done").click();
  await expect(card(page)).toHaveAttribute("data-state", "rest");
  // Quick Exit itself is still the one top-right button.
  await expect(page.locator("[data-phone-dock]")).toBeVisible();
});

test("header: mark, Help, Settings and Quick Exit stay inside the viewport", async ({ page }) => {
  await setup(page, () => ({ incident_count: 1 }));
  await page.goto("/dashboard");
  for (const name of ["Help", "Settings", "Quick exit"]) {
    const b = (await page
      .getByRole(name === "Quick exit" ? "button" : "link", { name, exact: true })
      .first()
      .boundingBox())!;
    expect(b.x, name).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, name).toBeLessThanOrEqual(390);
    expect(b.height, name).toBeGreaterThanOrEqual(44);
  }
  await expect(page.locator("header [aria-label='Sign out']")).toHaveCount(0);
});

const PAGES: Array<[string, string]> = [
  ["Home", "/dashboard"],
  ["Notes", "/journal"],
  ["Timeline", "/timeline"],
  ["Sharing", "/access"],
  ["Settings", "/settings"],
  ["Drafts", "/drafts"],
  ["PIN", "/settings?pin"],
];

for (const width of [320, 360, 390, 414]) {
  test(`no horizontal overflow at ${width}px on survivor pages`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const bad: string[] = [];
    for (const [name, path] of PAGES) {
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await mockLoggedIn(page, {
        persona: "survivor",
        serverFnHandlers: {
          ...LISTS,
          getDashboardStats: () => stats({ incident_count: 1 }),
          ...(name === "PIN"
            ? {
                getPinLockState: () => ({
                  app_lock_enabled: true,
                  has_pin: true,
                  biometric_enabled: false,
                }),
              }
            : {}),
        },
      });
      await page.goto(path);
      await page.waitForTimeout(600);
      const m = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        iw: window.innerWidth,
      }));
      if (m.sw > m.iw) bad.push(`${name} ${m.sw}>${m.iw}`);
      if (SHOTS && width === 320 && name === "Home") {
        await card(page).waitFor();
        await page.screenshot({ path: `${SHOTS}/320-home.png` });
      }
    }
    expect(bad).toEqual([]);
  });
}

const BANNED =
  /\b(abuse|abusive|abuser|violence|violent|escape|danger|dangerous|unsafe|assault|domestic)\b/i;

test("poster: no blur, gradient or shadow, and no banned words in titles, header or nav", async ({
  page,
}) => {
  const found: string[] = [];
  for (const [name, path] of PAGES.slice(0, 4)) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await mockLoggedIn(page, {
      persona: "survivor",
      serverFnHandlers: { ...LISTS, getDashboardStats: () => stats({ incident_count: 1 }) },
    });
    await page.goto(path);
    await page.waitForTimeout(600);
    const r = await page.evaluate((src) => {
      const banned = new RegExp(src, "i");
      const soft: string[] = [];
      for (const el of Array.from(document.querySelectorAll(".pp-app-shell, .pp-app-shell *"))) {
        for (const pseudo of [null, "::before", "::after"]) {
          const cs = getComputedStyle(el, pseudo);
          if (/blur/.test(cs.filter) || /blur/.test(cs.backdropFilter || ""))
            soft.push(`blur ${el.tagName}${pseudo ?? ""}`);
          if (/gradient/.test(cs.backgroundImage))
            soft.push(`gradient ${el.tagName}.${el.className}${pseudo ?? ""}`);
          if (cs.boxShadow && cs.boxShadow !== "none") soft.push(`shadow ${el.tagName}`);
        }
      }
      const words = [
        document.title,
        ...Array.from(document.querySelectorAll("header, nav, h1, h2")).map(
          (e) => (e as HTMLElement).innerText,
        ),
      ].filter((t) => banned.test(t));
      return { soft: soft.slice(0, 5), words };
    }, BANNED.source);
    for (const s of r.soft) found.push(`${name}: ${s}`);
    for (const w of r.words) found.push(`${name} word: ${w.slice(0, 60)}`);
    if (SHOTS && name === "Notes") await page.screenshot({ path: `${SHOTS}/390-notes-band.png` });
  }
  expect(found).toEqual([]);
});

test("Guardian: storage holds only dates/state names under hashed keys", async ({ page }) => {
  await setup(page, () => ({ incident_count: 2, unconfirmed_ai_count: 1 }));
  await page.goto("/dashboard");
  await card(page).getByRole("button", { name: "Not now" }).click();
  await page.getByRole("button", { name: "Show everything" }).click();
  const ls = await page.evaluate(() =>
    Object.fromEntries(
      Object.keys(localStorage)
        .filter((k) => k.startsWith("pp.home"))
        .map((k) => [k, localStorage.getItem(k)]),
    ),
  );
  const keys = Object.keys(ls);
  expect(keys.length).toBeGreaterThan(0);
  for (const k of keys) expect(k).toMatch(/^pp\.home\.(salt|(guide|view)\.[0-9a-f]{16})$/);
  const guide = keys.find((k) => k.startsWith("pp.home.guide."))!;
  expect(JSON.parse(ls[guide]!)).toEqual({
    dismissed: { draft: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
  });
});

test("Guardian: practice 'Try it now' runs the real Quick Exit and clears Home keys", async ({
  page,
}) => {
  await page.route(/weather\.com/, (r) =>
    r.fulfill({ status: 200, contentType: "text/html", body: "<title>Weather</title>ok" }),
  );
  await setup(page, () => ({ incident_count: 2 }));
  await page.goto("/dashboard");
  await expect(card(page)).toHaveAttribute("data-state", "quick-exit");
  await page.getByRole("button", { name: "Show everything" }).click(); // writes a view key
  await card(page).getByRole("button", { name: "Practice Quick Exit" }).click();
  await page.getByTestId("quick-exit-practice-try").click();
  await page.waitForURL(/weather\.com/);
  // Back on the app origin (the mock re-signs in, but Home/guide memory must be gone).
  await page.goto("/robots.txt");
  const left = await page.evaluate(() => ({
    home: Object.keys(localStorage).filter((k) => k.startsWith("pp.home")),
    tried: localStorage.getItem("pp.quickexit.tried"),
  }));
  expect(left.home).toEqual([]);
  expect(left.tried).toBe("1");
});
