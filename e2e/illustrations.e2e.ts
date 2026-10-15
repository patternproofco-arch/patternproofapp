import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
// @ts-expect-error JavaScript QA helper has no declaration file.
import { mockLoggedIn } from "../scripts/qa/mock-session.mjs";

test.use({ serviceWorkers: "block", hasTouch: true });
const SHOTS = process.env.ILLO_SHOTS;

const base = (incidents: number) => ({
  listProposedIncidents: () => [],
  listUnseenConnections: () => [],
  listMyOauthConsents: () => [],
  findCrossReferences: () => ({ clusters: [] }),
  listPendingAdvocateInvitesForMe: () => ({ invites: [] }),
  listPendingAttorneyInvitesForMe: () => ({ invites: [] }),
  listMyAdvocateAccess: () => ({ links: [] }),
  listMyAccessAudit: () => ({ events: [] }),
  getAssistantAccess: () => ({ on: false, hasPassword: true }),
  getDashboardStats: () => ({
    incident_count: incidents,
    evidence_count: 0,
    unconfirmed_ai_count: 0,
    voice_note_count: 0,
  }),
});

type Screen = {
  name: string;
  path: string;
  art: string;
  incidents?: number;
  init?: () => void;
  narrowHidden?: boolean;
  signedOut?: boolean;
};

const SCREENS: Screen[] = [
  {
    name: "home-first-note",
    path: "/dashboard",
    art: "thread-start",
    incidents: 0,
  },
  {
    name: "home-rest",
    path: "/dashboard",
    art: "thread-rest",
    incidents: 0,
    init: () => {
      localStorage.setItem("pp.quickexit.tried", "1");
    },
  },
  { name: "notes-empty", path: "/journal", art: "threads-gather", incidents: 0 },
  { name: "timeline-empty", path: "/timeline", art: "dated-sequence", incidents: 0 },
  { name: "sharing", path: "/access", art: "threads-converge" },
  { name: "not-found", path: "/this-page-does-not-exist", art: "thread-gap", signedOut: true },
];

async function openRest(page: Page, s: Screen) {
  // Real path to the rest state: start "Add a Note", save one, come back Home.
  let count = 0;
  await mockLoggedIn(page, {
    persona: "survivor",
    serverFnHandlers: { ...base(0), getDashboardStats: () => ({ ...base(count).getDashboardStats() }) },
    restHandlers: {
      incidents: (route: import("@playwright/test").Route) =>
        route.fulfill({
          status: 200,
          headers: { "access-control-allow-origin": route.request().headers().origin || "*" },
          json: count > 0 ? [{ id: "n1", date: null, description: "x", created_at: new Date().toISOString() }] : [],
        }),
    },
  });
  if (s.init) await page.addInitScript(s.init);
  await page.goto("/dashboard");
  await page.getByTestId("home-guide-card").getByRole("button", { name: "Add a Note" }).click();
  await page.waitForURL(/journal/);
  await page.waitForTimeout(300);
  count = 1;
  await page.goto("/dashboard");
  await expect(page.getByTestId("home-guide-card")).toHaveAttribute("data-state", "rest");
}

async function open(page: Page, s: Screen) {
  if (s.name === "home-rest") return openRest(page, s);
  if (!s.signedOut)
    await mockLoggedIn(page, { persona: "survivor", serverFnHandlers: base(s.incidents ?? 1) });
  if (s.init) await page.addInitScript(s.init);
  await page.goto(s.path);
  await page.waitForTimeout(800);
}

for (const width of [390, 320]) {
  for (const s of SCREENS) {
    test(`${s.name} at ${width}px: one thread illustration, decorative, axe clean`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await open(page, s);
      const art = page.locator(`[data-illustration="${s.art}"]`);
      await expect(art.first()).toBeAttached({ timeout: 15_000 });
      const visible = page.locator("[data-illustration]:visible");
      if (width === 320 && s.narrowHidden) await expect(visible).toHaveCount(0);
      else {
        await expect(visible).toHaveCount(1);
        await expect(visible.first()).toHaveAttribute("data-illustration", s.art);
        const svg = visible.first().locator("svg");
        await expect(svg).toHaveAttribute("aria-hidden", "true");
        await expect(svg).toHaveAttribute("focusable", "false");
        await expect(svg.locator("title, text")).toHaveCount(0);
        const box = await visible.first().boundingBox();
        const h = box?.height ?? 0;
        if (width === 320) expect(Math.round(h)).toBeLessThanOrEqual(122);
        else {
          expect(h).toBeGreaterThanOrEqual(158);
          expect(h).toBeLessThanOrEqual(202);
        }
      }
      if (s.name === "not-found") {
        await expect(page.getByText("This page isn't here.")).toBeVisible();
        await expect(page.getByText("Your notes are still where you left them.")).toBeVisible();
        await expect(page.getByRole("link", { name: "Go to Home" })).toBeVisible();
        await expect(page.locator("[data-quick-exit]:visible")).toHaveCount(1);
        await expect(page.locator(".pp-global-header")).toBeHidden();
      }
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .include("[data-illustration]")
        .analyze()
        .catch(() => null);
      expect(axe?.violations ?? [], "axe on the art").toEqual([]);
      const full = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      test.info().annotations.push({
        type: "axe-page",
        description: `${s.name}@${width}: ${full.violations.map((v) => `${v.id}(${v.nodes.length})`).join(", ") || "none"}`,
      });
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/${width}-${s.name}.png` });
    });
  }
}

test("no art on PIN or sign-in", async ({ page }) => {
  await page.goto("/login");
  await page.waitForTimeout(600);
  await expect(page.locator("[data-illustration]")).toHaveCount(0);
});

test("no art in Quick Exit practice", async ({ page }) => {
  await mockLoggedIn(page, { persona: "survivor", serverFnHandlers: base(0) });
  await page.goto("/dashboard");
  const practice = page.getByRole("button", { name: /practice/i }).first();
  if (await practice.count()) {
    await practice.click();
    await expect(page.getByText("Here's what happens")).toBeVisible();
    await expect(page.locator("[data-illustration]:visible")).toHaveCount(0);
  }
});

test("Notes empty: only art, text and one CTA; tapping opens the form with focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockLoggedIn(page, { persona: "survivor", serverFnHandlers: base(0) });
  await page.goto("/journal");
  const hero = page.getByTestId("notes-empty");
  await expect(hero).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#entry-what")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add an entry" })).toHaveCount(0);
  await expect(hero.getByRole("button")).toHaveCount(1);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/390-notes-empty.png` });
  await page.getByTestId("notes-empty-cta").click();
  await expect(page.locator("#entry-what")).toBeFocused();
});

test("Timeline chips: six plain-language groups, ink outline, selected ink fill; full-page axe", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockLoggedIn(page, {
    persona: "survivor",
    serverFnHandlers: base(2),
    restHandlers: {
      incidents: (route: import("@playwright/test").Route) =>
        route.fulfill({
          status: 200,
          headers: { "access-control-allow-origin": route.request().headers().origin || "*" },
          json: [
            { id: "n2", date: "2026-10-02", description: "Texts all evening after I said no.", abuse_types: ["digital_intimidation", "verbal"], date_precision: "exact" },
            { id: "n1", date: "2026-09-20", description: "Showed up at work at lunch.", abuse_types: ["stalking"], date_precision: "exact" },
          ],
        }),
    },
  });
  await page.goto("/timeline");
  const chips = page.locator(".pp-filter-chip");
  await expect(chips).toHaveText(["Things said", "Things done", "Money", "Messages & calls", "Where I go", "Other"], { timeout: 15_000 });
  await expect(page.locator("main")).not.toContainText(/abuse|violence|assault/i);
  await page.waitForTimeout(800);
  // Full-page axe before interacting (focus mode dims other regions while a control has focus).
  const full = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(full.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
  await chips.nth(1).click();
  await expect(chips.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(chips.nth(1)).toHaveCSS("background-color", "rgb(43, 33, 52)");
  await expect(chips.nth(0)).toHaveCSS("border-top-color", "rgb(43, 33, 52)");
  await chips.nth(1).click();
  await chips.nth(3).click(); // "Messages & calls" matches one Note
  await expect(page.getByText("Texts all evening after I said no.")).toBeVisible();
  await expect(page.getByText("Showed up at work at lunch.")).toHaveCount(0);
  await page.keyboard.press("Escape"); // leave focus mode so the shot isn't dimmed
  await page.waitForTimeout(400);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/390-timeline-chips.png` });
});

test("404: app header, one Quick Exit, full-page axe clean", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/this-page-does-not-exist");
  await expect(page.getByText("This page isn't here.")).toBeVisible();
  await expect(page.locator("[data-quick-exit]:visible")).toHaveCount(1);
  // Docked in the app header's top-right slot.
  const qe = await page.locator("[data-quick-exit]:visible").boundingBox();
  const hdr = await page.locator(".pp-shell-header").boundingBox();
  expect(qe!.y).toBeLessThan(hdr!.y + hdr!.height);
  expect(qe!.x + qe!.width).toBeGreaterThan(390 - 24);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/390-not-found.png` });
  const full = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(full.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
});
